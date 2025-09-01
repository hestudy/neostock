import { DatabaseMigrator, type Migration, type DatabaseWrapper } from './migrator';
import { promises as fs } from 'fs';
import { join } from 'path';

type DatabaseInstance = {
	exec: (sql: string) => void;
	prepare: (sql: string) => {
		get: (...args: unknown[]) => Record<string, unknown> | undefined;
		all: (...args: unknown[]) => Record<string, unknown>[];
		run: (...args: unknown[]) => { changes: number; lastInsertRowid: number };
	};
	close: () => void;
};

interface MigrationLog {
	id: string;
	name: string;
	status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
	started_at?: number;
	completed_at?: number;
	error_message?: string;
	backup_path?: string;
	attempt_count: number;
}

interface BackupInfo {
	path: string;
	created_at: number;
	migration_id: string;
	file_size: number;
}

export class EnhancedMigrator extends DatabaseMigrator {
	private migrationLogs = new Map<string, MigrationLog>();
	private readonly MAX_RETRY_ATTEMPTS: number;
	private readonly BACKUP_DIR = process.env.BACKUP_DIR || './backups';
	private failureCount = 0;
	private readonly isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
	
	protected get database(): DatabaseInstance {
		return (this as unknown as { db: DatabaseInstance }).db;
	}
	
	
	
	// 仅用于测试的数据库访问方法
	public getDbForTesting(): DatabaseInstance {
		return this.database;
	}

	// 日志控制方法
	private log(...args: unknown[]): void {
		if (!this.isTestEnvironment) {
			this.log(...args);
		}
	}

	constructor(
		databasePath: string = ':memory:', 
		options?: { 
			batchSize?: number; 
			maxRetries?: number;
			onProgress?: (progress: { completed: number; total: number; current: string }) => void;
		}
	) {
		super(databasePath, options);
		this.MAX_RETRY_ATTEMPTS = options?.maxRetries ?? 3;
		this.initializeEnhancedTracking();
		this.ensureBackupDirectory();
	}

	private initializeEnhancedTracking() {
		// 扩展迁移跟踪表，添加状态管理字段
		const db = this.database;
		db.exec(`
			CREATE TABLE IF NOT EXISTS __migration_logs (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				status TEXT NOT NULL,
				started_at INTEGER,
				completed_at INTEGER,
				error_message TEXT,
				backup_path TEXT,
				attempt_count INTEGER DEFAULT 0,
				created_at INTEGER DEFAULT (strftime('%s', 'now'))
			)
		`);

		// 创建备份信息表
		db.exec(`
			CREATE TABLE IF NOT EXISTS __migration_backups (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				migration_id TEXT NOT NULL,
				backup_path TEXT NOT NULL,
				file_size INTEGER NOT NULL,
				created_at INTEGER DEFAULT (strftime('%s', 'now'))
			)
		`);
	}

	private async ensureBackupDirectory() {
		try {
			await fs.mkdir(this.BACKUP_DIR, { recursive: true });
		} catch (error) {
			console.warn(`⚠️  无法创建备份目录: ${this.BACKUP_DIR}`, error);
		}
	}

	// 数据完整性验证 (带重试机制)
	async validateDataIntegrity(retries: number = 3): Promise<{ valid: boolean; issues: string[] }> {
		for (let attempt = 1; attempt <= retries; attempt++) {
			const issues: string[] = [];
			const db = this.database;

			try {
				// 等待一小段时间确保数据库操作完成
				await new Promise(resolve => setTimeout(resolve, 50 * attempt));

				// 1. 外键约束检查
				try {
					const foreignKeyCheck = db.prepare('PRAGMA foreign_key_check').all();
					if (foreignKeyCheck && foreignKeyCheck.length > 0) {
						issues.push(`外键约束违反: ${foreignKeyCheck.length} 条记录`);
					}
				} catch (fkError) {
					// 忽略外键检查失败（某些数据库不支持）
					console.warn('外键检查失败:', fkError);
				}

				// 2. 数据库完整性检查
				try {
					const integrityCheck = db.prepare('PRAGMA integrity_check').get() as Record<string, string> | null;
					if (integrityCheck && integrityCheck.integrity_check !== 'ok') {
						issues.push(`数据库完整性检查失败: ${integrityCheck.integrity_check}`);
					}
				} catch (integrityError) {
					// 忽略完整性检查失败
					console.warn('完整性检查失败:', integrityError);
				}

				// 3. 检查索引一致性 (只在表存在时检查)
				const stocksTableExists = db.prepare(`
					SELECT name FROM sqlite_master 
					WHERE type='table' AND name = 'stocks'
				`).all();
				
				if (stocksTableExists.length > 0) {
					try {
						const indexCheck = db.prepare('PRAGMA index_list(stocks)').all();
						const expectedIndexes = ['stocks_symbol_idx', 'stocks_name_idx', 'stocks_industry_idx'];
						const actualIndexes = (indexCheck || []).map((idx: Record<string, unknown>) => idx.name);
						
						for (const expectedIndex of expectedIndexes) {
							if (!actualIndexes.includes(expectedIndex)) {
								issues.push(`缺失索引: ${expectedIndex}`);
							}
						}
					} catch (indexError) {
						console.warn('索引检查失败:', indexError);
					}
				}

				// 4. 检查表结构 (只在需要时检查)
				const appliedMigrations = await this.getAppliedMigrations();
				const stocksMigrationApplied = appliedMigrations.some(m => m.id === '002_v1.1_create_stocks_tables');
				
				if (stocksMigrationApplied) {
					const tablesInfo = db.prepare(`
						SELECT name FROM sqlite_master 
						WHERE type='table' AND name IN ('stocks', 'stock_daily', 'user_stock_favorites')
					`).all();
					
					const expectedTables = ['stocks', 'stock_daily', 'user_stock_favorites'];
					const actualTables = tablesInfo.map((t: Record<string, unknown>) => t.name);
					
					for (const expectedTable of expectedTables) {
						if (!actualTables.includes(expectedTable)) {
							issues.push(`缺失数据表: ${expectedTable}`);
						}
					}
				}

				// 如果没有问题或者是最后一次尝试，返回结果
				if (issues.length === 0 || attempt === retries) {
					return { valid: issues.length === 0, issues };
				}

				// 如果有问题且不是最后一次尝试，继续重试
				this.log(`⚠️  数据完整性验证失败 (尝试 ${attempt}/${retries}): ${issues.join(', ')}`);

			} catch (error) {
				if (attempt === retries) {
					issues.push(`数据完整性验证失败: ${error instanceof Error ? error.message : String(error)}`);
					return { valid: false, issues };
				}
				this.log(`⚠️  数据完整性验证异常 (尝试 ${attempt}/${retries}): ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		return { valid: false, issues: ['验证失败'] };
	}

	// 创建数据库备份
	async createBackup(migrationId: string): Promise<BackupInfo | null> {
		try {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupFileName = `backup_${migrationId}_${timestamp}.db`;
			const backupPath = join(this.BACKUP_DIR, backupFileName);

			// 对于文件数据库，复制数据库文件
			const dbPath = (this.database as DatabaseInstance & { filename?: string }).filename;
			if (dbPath && dbPath !== ':memory:') {
				await fs.copyFile(dbPath, backupPath);
				
				const stats = await fs.stat(backupPath);
				const backupInfo: BackupInfo = {
					path: backupPath,
					created_at: Date.now(),
					migration_id: migrationId,
					file_size: stats.size
				};

				// 记录备份信息
				const db = this.database;
				db.prepare(`
					INSERT INTO __migration_backups (migration_id, backup_path, file_size) 
					VALUES (?, ?, ?)
				`).run(migrationId, backupPath, stats.size);

				this.log(`💾 数据库备份已创建: ${backupPath}`);
				return backupInfo;
			} else {
				this.log('📝 内存数据库无需备份');
				return null;
			}
		} catch (error) {
			console.error(`❌ 创建备份失败:`, error);
			return null;
		}
	}

	// 恢复数据库备份
	async restoreFromBackup(backupPath: string): Promise<boolean> {
		try {
			const dbPath = (this.database as DatabaseInstance & { filename?: string }).filename;
			if (dbPath && dbPath !== ':memory:') {
				// 关闭当前数据库连接
				this.database.close();
				
				// 恢复备份文件
				await fs.copyFile(backupPath, dbPath);
				
				// 重新连接数据库
				const DatabaseClass = this.constructor as new (path: string) => { db: DatabaseInstance };
				(this as unknown as { db: DatabaseInstance }).db = new DatabaseClass(dbPath).db;
				
				this.log(`🔄 数据库已从备份恢复: ${backupPath}`);
				return true;
			}
			return false;
		} catch (error) {
			console.error(`❌ 恢复备份失败:`, error);
			return false;
		}
	}

	// 增强的迁移执行，包含完整性验证和自动重试
	async runEnhancedMigrations(timeoutMs: number = 60000): Promise<{
		success: boolean;
		applied: string[];
		errors: string[];
		backups: string[];
	}> {
		const result = {
			success: true,
			applied: [] as string[],
			errors: [] as string[],
			backups: [] as string[]
		};

		try {
			// 1. 预迁移数据完整性验证
			this.log('🔍 执行预迁移数据完整性验证...');
			const preValidation = await this.validateDataIntegrity();
			if (!preValidation.valid) {
				result.errors.push(`预迁移验证失败: ${preValidation.issues.join(', ')}`);
				return { ...result, success: false };
			}
			this.log('✅ 预迁移验证通过');

			// 2. 获取待执行的迁移
			const pendingMigrations = [];
			const db = this.database;
			
			// Access protected migrations property via reflection
			const migrations = (this as unknown as { migrations: Migration[] }).migrations;
			if (!migrations || !Array.isArray(migrations)) {
				result.errors.push('无法访问迁移列表');
				return { ...result, success: false };
			}
			
			for (const migration of migrations) {
				const existing = db.prepare('SELECT id FROM __migrations WHERE id = ?').get(migration.id);
				if (!existing) {
					pendingMigrations.push(migration);
				}
			}

			if (pendingMigrations.length === 0) {
				this.log('📋 没有待执行的迁移');
				return result;
			}

			this.log(`🚀 开始执行 ${pendingMigrations.length} 个迁移`);

			// 3. 逐个执行迁移
			for (const migration of pendingMigrations) {
				let attemptCount = 0;
				let migrationSuccess = false;
				let lastError: Error | null = null;
				let backupInfo: BackupInfo | null = null;

				// 记录迁移开始
				this.logMigrationStart(migration.id, migration.name);

				while (attemptCount < this.MAX_RETRY_ATTEMPTS && !migrationSuccess) {
					attemptCount++;
					
					try {
						this.log(`📦 执行迁移 ${migration.name} (尝试 ${attemptCount}/${this.MAX_RETRY_ATTEMPTS})`);

						// 创建备份（仅第一次尝试）
						if (attemptCount === 1) {
							backupInfo = await this.createBackup(migration.id);
							if (backupInfo) {
								result.backups.push(backupInfo.path);
							}
						}

						// 执行迁移（带超时）
						const migrationPromise = this.executeSingleMigration(migration);
						const timeoutPromise = new Promise<never>((_, reject) => {
							setTimeout(() => reject(new Error(`迁移超时 ${timeoutMs}ms`)), timeoutMs);
						});

						await Promise.race([migrationPromise, timeoutPromise]);

						// 迁移后验证
						const postValidation = await this.validateDataIntegrity();
						if (!postValidation.valid) {
							throw new Error(`迁移后验证失败: ${postValidation.issues.join(', ')}`);
						}

						// 记录成功
						migrationSuccess = true;
						result.applied.push(migration.id);
						this.logMigrationSuccess(migration.id);
						this.log(`✅ 迁移 ${migration.name} 执行成功`);

					} catch (error) {
						lastError = error instanceof Error ? error : new Error(String(error));
						this.failureCount++;
						
						console.error(`❌ 迁移 ${migration.name} 执行失败 (尝试 ${attemptCount}/${this.MAX_RETRY_ATTEMPTS}):`, lastError.message);

						// 如果还有重试机会，等待一段时间后重试
						if (attemptCount < this.MAX_RETRY_ATTEMPTS) {
							const waitTime = Math.pow(2, attemptCount) * 1000; // 指数退避
							this.log(`⏱️  等待 ${waitTime}ms 后重试...`);
							await new Promise(resolve => setTimeout(resolve, waitTime));
						}
					}
				}

				// 检查迁移是否最终成功
				if (!migrationSuccess) {
					this.logMigrationFailure(migration.id, lastError?.message || '未知错误', attemptCount);
					
					// 如果有备份，尝试恢复
					if (backupInfo && await this.restoreFromBackup(backupInfo.path)) {
						this.log(`🔄 已从备份恢复数据库`);
					}

					result.success = false;
					result.errors.push(`迁移 ${migration.id} 失败: ${lastError?.message}`);
					
					// 检查是否需要触发自动回滚
					if (this.failureCount >= this.MAX_RETRY_ATTEMPTS) {
						console.error(`🚨 连续失败次数达到阈值 (${this.MAX_RETRY_ATTEMPTS})，触发自动回滚`);
						await this.triggerAutoRollback(result.applied);
					}
					
					break; // 停止执行后续迁移
				}
			}

			// 4. 最终验证
			if (result.success) {
				const finalValidation = await this.validateDataIntegrity();
				if (!finalValidation.valid) {
					result.success = false;
					result.errors.push(`最终验证失败: ${finalValidation.issues.join(', ')}`);
				} else {
					this.log('🎉 所有迁移执行成功，数据完整性验证通过');
				}
			}

		} catch (error) {
			result.success = false;
			result.errors.push(`迁移系统错误: ${error instanceof Error ? error.message : String(error)}`);
		}

		return result;
	}

	// 执行单个迁移
	private async executeSingleMigration(migration: Migration): Promise<void> {
		// Access protected wrapper property via reflection
		const wrapper = (this as unknown as { wrapper: DatabaseWrapper }).wrapper;
		if (!wrapper) {
			throw new Error('无法访问数据库包装器');
		}
		const db = this.database;
		
		try {
			await migration.up(wrapper as DatabaseWrapper);
			
			// 记录到迁移表
			db.prepare('INSERT INTO __migrations (id, name) VALUES (?, ?)').run(migration.id, migration.name);
			
			// 确保所有操作完成后再继续
			await new Promise(resolve => setTimeout(resolve, 10));
			
		} catch (error) {
			// 如果迁移失败，检查是否需要回滚事务
			try {
				// 检查事务状态，如果有活跃事务则回滚
				db.exec('ROLLBACK');
				this.log('🔄 迁移失败，事务已回滚');
			} catch (rollbackError) {
				// 忽略"no transaction is active"错误，因为事务可能已经自动回滚
				if (rollbackError instanceof Error && !rollbackError.message?.includes('no transaction is active')) {
					console.error('❌ 事务回滚失败:', rollbackError);
				}
			}
			throw error;
		}
	}

	// 自动回滚机制
	private async triggerAutoRollback(appliedMigrations: string[]): Promise<void> {
		this.log('🔄 开始自动回滚流程...');
		
		// 按逆序回滚已应用的迁移
		for (const migrationId of appliedMigrations.reverse()) {
			try {
				this.log(`↩️  回滚迁移: ${migrationId}`);
				const rollbackResult = await this.rollbackMigration(migrationId);
				
				if (rollbackResult.success) {
					this.logMigrationRollback(migrationId);
					this.log(`✅ 迁移 ${migrationId} 回滚成功`);
				} else {
					console.error(`❌ 迁移 ${migrationId} 回滚失败: ${rollbackResult.error}`);
					break;
				}
			} catch (error) {
				console.error(`❌ 回滚迁移 ${migrationId} 时发生错误:`, error);
				break;
			}
		}
	}

	// 迁移状态记录方法
	private logMigrationStart(id: string, name: string) {
		const db = this.database;
		db.prepare(`
			INSERT OR REPLACE INTO __migration_logs 
			(id, name, status, started_at, attempt_count) 
			VALUES (?, ?, 'running', ?, 1)
		`).run(id, name, Date.now());
	}

	private logMigrationSuccess(id: string) {
		const db = this.database;
		db.prepare(`
			UPDATE __migration_logs 
			SET status = 'completed', completed_at = ? 
			WHERE id = ?
		`).run(Date.now(), id);
	}

	private logMigrationFailure(id: string, errorMessage: string, attemptCount: number) {
		const db = this.database;
		db.prepare(`
			UPDATE __migration_logs 
			SET status = 'failed', error_message = ?, attempt_count = ? 
			WHERE id = ?
		`).run(errorMessage, attemptCount, id);
	}

	private logMigrationRollback(id: string) {
		const db = this.database;
		db.prepare(`
			UPDATE __migration_logs 
			SET status = 'rolled_back', completed_at = ? 
			WHERE id = ?
		`).run(Date.now(), id);
	}

	// 获取迁移历史日志
	async getMigrationLogs(): Promise<MigrationLog[]> {
		const db = this.database;
		const logs = db.prepare(`
			SELECT * FROM __migration_logs 
			ORDER BY created_at DESC
		`).all();
		return logs as unknown as MigrationLog[];
	}

	// 清理旧备份文件
	async cleanupOldBackups(retainDays: number = 7): Promise<void> {
		try {
			const db = this.database;
			const cutoffTime = Date.now() - (retainDays * 24 * 60 * 60 * 1000);
			
			const oldBackups = db.prepare(`
				SELECT backup_path FROM __migration_backups 
				WHERE created_at < ?
			`).all(cutoffTime);

			for (const backup of oldBackups) {
				try {
					// Type guard to ensure backup has required properties
					const backupPath = (backup as Record<string, unknown>).backup_path as string;
					await fs.unlink(backupPath);
					this.log(`🗑️  已删除旧备份: ${backupPath}`);
				} catch (error) {
					const backupPath = (backup as Record<string, unknown>).backup_path as string;
					console.warn(`⚠️  删除备份文件失败: ${backupPath}`, error);
				}
			}

			// 清理数据库记录
			db.prepare('DELETE FROM __migration_backups WHERE created_at < ?').run(cutoffTime);
			
		} catch (error) {
			console.error('❌ 清理旧备份失败:', error);
		}
	}
}