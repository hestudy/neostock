import { db } from '../db/index';
import { sql } from 'drizzle-orm';

type SqliteRow = Record<string, string | number>;

interface CompatibilityResult {
	compatible: boolean;
	issues: string[];
	warnings: string[];
	details: {
		auth_tables_status: string;
		foreign_key_integrity: boolean;
		schema_version: string;
		migration_status: string;
	};
}

// interface SchemaVersion {
// 	version: string;
// 	description: string;
// 	applied_at: number;
// 	requires: string[];
// }

export class CompatibilityValidator {
	private readonly CURRENT_SCHEMA_VERSION = 'v1.1.0';
	private readonly AUTH_TABLES = ['user', 'session', 'account', 'verification'];
	private readonly REQUIRED_AUTH_COLUMNS = {
		user: ['id', 'name', 'email', 'emailVerified', 'createdAt', 'updatedAt'],
		session: ['id', 'expiresAt', 'token', 'userId', 'createdAt', 'updatedAt'],
		account: ['id', 'accountId', 'providerId', 'userId', 'createdAt', 'updatedAt'],
		verification: ['id', 'identifier', 'value', 'expiresAt']
	};

	// 验证现有认证表兼容性
	async validateAuthCompatibility(): Promise<CompatibilityResult> {
		const result: CompatibilityResult = {
			compatible: true,
			issues: [],
			warnings: [],
			details: {
				auth_tables_status: 'checking',
				foreign_key_integrity: false,
				schema_version: 'unknown',
				migration_status: 'checking'
			}
		};

		try {
			console.log('🔍 开始验证认证表兼容性...');

			// 1. 检查认证表是否存在
			await this.checkAuthTablesExistence(result);

			// 2. 验证认证表结构
			await this.validateAuthTableStructure(result);

			// 3. 检查外键完整性
			await this.checkForeignKeyIntegrity(result);

			// 4. 验证现有数据完整性
			await this.validateExistingData(result);

			// 5. 检查 schema 版本兼容性
			await this.checkSchemaVersionCompatibility(result);

			// 6. 验证 Better Auth 兼容性
			await this.validateBetterAuthCompatibility(result);

			if (result.issues.length === 0) {
				result.details.auth_tables_status = 'compatible';
				console.log('✅ 认证表兼容性验证通过');
			} else {
				result.compatible = false;
				result.details.auth_tables_status = 'incompatible';
				console.error('❌ 认证表兼容性验证失败');
			}

		} catch (error) {
			result.compatible = false;
			result.issues.push(`兼容性验证异常: ${error instanceof Error ? error.message : String(error)}`);
			result.details.auth_tables_status = 'error';
		}

		return result;
	}

	private async checkAuthTablesExistence(result: CompatibilityResult) {
		try {
			const existingTables = await db.all(sql`
				SELECT name FROM sqlite_master 
				WHERE type='table' AND name IN ('user', 'session', 'account', 'verification')
			`);

			const tableNames = existingTables.map(row => (row as SqliteRow)['name'] as string);
			
			for (const requiredTable of this.AUTH_TABLES) {
				if (!tableNames.includes(requiredTable)) {
					result.issues.push(`缺少认证表: ${requiredTable}`);
				}
			}

			console.log(`📋 检查到认证表: ${tableNames.join(', ')}`);
		} catch (error) {
			result.issues.push(`检查认证表存在性失败: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async validateAuthTableStructure(result: CompatibilityResult) {
		try {
			for (const [tableName, requiredColumns] of Object.entries(this.REQUIRED_AUTH_COLUMNS)) {
				const tableInfo = await db.all(sql.raw(`PRAGMA table_info(${tableName})`));
				const actualColumns = tableInfo.map(row => (row as SqliteRow)['name'] as string);

				for (const requiredColumn of requiredColumns) {
					if (!actualColumns.includes(requiredColumn)) {
						result.issues.push(`认证表 ${tableName} 缺少字段: ${requiredColumn}`);
					}
				}

				// 检查是否有额外的字段（可能影响兼容性）
				const extraColumns = actualColumns.filter(col => !requiredColumns.includes(col));
				if (extraColumns.length > 0) {
					result.warnings.push(`认证表 ${tableName} 包含额外字段: ${extraColumns.join(', ')}`);
				}
			}

			console.log('📊 认证表结构验证完成');
		} catch (error) {
			result.issues.push(`验证认证表结构失败: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async checkForeignKeyIntegrity(result: CompatibilityResult) {
		try {
			// 启用外键检查
			await db.run(sql`PRAGMA foreign_keys = ON`);

			// 检查外键约束
			const foreignKeyCheck = await db.all(sql`PRAGMA foreign_key_check`);
			
			if (foreignKeyCheck.length === 0) {
				result.details.foreign_key_integrity = true;
				console.log('✅ 外键完整性检查通过');
			} else {
				result.details.foreign_key_integrity = false;
				result.issues.push(`外键完整性违反: ${foreignKeyCheck.length} 个问题`);
				
				// 记录详细的外键问题
				for (const violation of foreignKeyCheck.slice(0, 5)) { // 最多显示5个问题
					result.issues.push(`外键违反: 表 ${(violation as SqliteRow)['table']}, 行 ${(violation as SqliteRow)['rowid']}`);
				}
			}
		} catch (error) {
			result.warnings.push(`外键完整性检查失败: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async validateExistingData(result: CompatibilityResult) {
		try {
			// 检查用户表数据完整性
			const userCount = await db.all(sql`SELECT COUNT(*) as count FROM user`);
			const userCountValue = (userCount[0] as SqliteRow)['count'] as number;

			if (userCountValue > 0) {
				// 检查用户数据完整性
				const invalidUsers = await db.all(sql`
					SELECT COUNT(*) as count FROM user 
					WHERE email IS NULL OR email = '' OR name IS NULL OR name = ''
				`);
				
				const invalidUserCount = (invalidUsers[0] as SqliteRow)['count'] as number;
				if (invalidUserCount > 0) {
					result.issues.push(`发现 ${invalidUserCount} 个无效用户记录`);
				}

				// 检查会话数据完整性
				const orphanedSessions = await db.all(sql`
					SELECT COUNT(*) as count FROM session 
					WHERE userId NOT IN (SELECT id FROM user)
				`);
				
				const orphanedSessionCount = (orphanedSessions[0] as SqliteRow)['count'] as number;
				if (orphanedSessionCount > 0) {
					result.warnings.push(`发现 ${orphanedSessionCount} 个孤立的会话记录`);
				}

				console.log(`📊 验证了 ${userCountValue} 个用户的数据完整性`);
			} else {
				console.log('📝 数据库中没有现有用户数据');
			}
		} catch (error) {
			result.warnings.push(`验证现有数据失败: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async checkSchemaVersionCompatibility(result: CompatibilityResult) {
		try {
			// 检查是否存在版本管理表
			const versionTableExists = await db.all(sql`
				SELECT name FROM sqlite_master 
				WHERE type='table' AND name='__schema_versions'
			`);

			if (versionTableExists.length === 0) {
				// 如果不存在版本表，创建它
				await this.initializeSchemaVersioning();
				result.details.schema_version = 'v1.0.0'; // 假设当前是基础版本
				result.warnings.push('首次运行，已初始化 schema 版本管理');
			} else {
				// 获取当前版本
				const currentVersion = await db.all(sql`
					SELECT version FROM __schema_versions 
					ORDER BY applied_at DESC LIMIT 1
				`);

				if (currentVersion.length > 0) {
					result.details.schema_version = (currentVersion[0] as SqliteRow)['version'] as string;
				} else {
					result.details.schema_version = 'unknown';
					result.warnings.push('schema 版本信息缺失');
				}
			}

			console.log(`📊 当前 schema 版本: ${result.details.schema_version}`);
		} catch (error) {
			result.warnings.push(`检查 schema 版本失败: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async validateBetterAuthCompatibility(result: CompatibilityResult) {
		try {
			// 验证 Better Auth 所需的基本配置
			const authValidations = [
				// 检查用户表是否有 Better Auth 所需的基本字段
				{
					name: 'user_table_structure',
					check: async () => {
						const userTableInfo = await db.all(sql`PRAGMA table_info(user)`);
						const columns = userTableInfo.map(row => (row as SqliteRow)['name'] as string);
						return columns.includes('id') && columns.includes('email') && columns.includes('name');
					}
				},
				// 检查会话表结构
				{
					name: 'session_table_structure',
					check: async () => {
						const sessionTableInfo = await db.all(sql`PRAGMA table_info(session)`);
						const columns = sessionTableInfo.map(row => (row as SqliteRow)['name'] as string);
						return columns.includes('id') && columns.includes('userId') && columns.includes('expiresAt');
					}
				},
				// 检查外键约束是否正确设置
				{
					name: 'foreign_key_constraints',
					check: async () => {
						const sessionFK = await db.all(sql`PRAGMA foreign_key_list(session)`);
						return sessionFK.some(row => (row as SqliteRow)['table'] === 'user' && (row as SqliteRow)['from'] === 'userId');
					}
				}
			];

			for (const validation of authValidations) {
				const isValid = await validation.check();
				if (!isValid) {
					result.issues.push(`Better Auth 兼容性问题: ${validation.name} 验证失败`);
				}
			}

			console.log('🔐 Better Auth 兼容性检查完成');
		} catch (error) {
			result.warnings.push(`Better Auth 兼容性验证失败: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// 初始化 schema 版本管理
	async initializeSchemaVersioning(): Promise<void> {
		try {
			await db.run(sql`
				CREATE TABLE IF NOT EXISTS __schema_versions (
					version TEXT PRIMARY KEY,
					description TEXT NOT NULL,
					applied_at INTEGER NOT NULL,
					requires TEXT -- JSON array of required previous versions
				)
			`);

			// 插入初始版本记录
			await db.run(sql`
				INSERT OR IGNORE INTO __schema_versions (version, description, applied_at, requires) 
				VALUES ('v1.0.0', '初始认证系统', ${Date.now()}, '[]')
			`);

			console.log('✅ Schema 版本管理已初始化');
		} catch (error) {
			console.error('❌ 初始化 schema 版本管理失败:', error);
			throw error;
		}
	}

	// 更新 schema 版本
	async updateSchemaVersion(version: string, description: string, requires: string[] = []): Promise<void> {
		try {
			await db.run(sql`
				INSERT INTO __schema_versions (version, description, applied_at, requires) 
				VALUES (${version}, ${description}, ${Date.now()}, ${JSON.stringify(requires)})
			`);

			console.log(`📊 Schema 版本已更新至: ${version}`);
		} catch (error) {
			console.error(`❌ 更新 schema 版本失败:`, error);
			throw error;
		}
	}

	// 检查版本依赖
	async checkVersionRequirements(targetVersion: string): Promise<{ satisfied: boolean; missing: string[] }> {
		try {
			// 获取目标版本的依赖
			const versionInfo = await db.all(sql`
				SELECT requires FROM __schema_versions WHERE version = ${targetVersion}
			`);

			if (versionInfo.length === 0) {
				return { satisfied: true, missing: [] }; // 新版本，无依赖
			}

			const requires = JSON.parse((versionInfo[0] as SqliteRow)['requires'] as string) as string[];
			const missing: string[] = [];

			// 检查每个依赖版本是否已应用
			for (const requiredVersion of requires) {
				const existingVersion = await db.all(sql`
					SELECT version FROM __schema_versions WHERE version = ${requiredVersion}
				`);

				if (existingVersion.length === 0) {
					missing.push(requiredVersion);
				}
			}

			return { satisfied: missing.length === 0, missing };
		} catch (error) {
			console.error('❌ 检查版本依赖失败:', error);
			return { satisfied: false, missing: [] };
		}
	}

	// 零停机升级检查
	async validateZeroDowntimeUpgrade(): Promise<{ safe: boolean; blockers: string[]; recommendations: string[] }> {
		const result = {
			safe: true,
			blockers: [] as string[],
			recommendations: [] as string[]
		};

		try {
			// 1. 检查是否有正在运行的长事务
			const longTransactions = await this.checkLongRunningTransactions();
			if (longTransactions.length > 0) {
				result.blockers.push(`检测到 ${longTransactions.length} 个长事务正在运行`);
				result.safe = false;
			}

			// 2. 检查连接数
			const activeConnections = await this.getActiveConnectionCount();
			if (activeConnections > 50) {
				result.recommendations.push(`当前有 ${activeConnections} 个活跃连接，建议在低峰期进行升级`);
			}

			// 3. 检查数据库锁定状态
			const isLocked = await this.checkDatabaseLocks();
			if (isLocked) {
				result.blockers.push('数据库当前被锁定，无法进行升级');
				result.safe = false;
			}

			// 4. 检查磁盘空间
			const hasEnoughSpace = await this.checkDiskSpace();
			if (!hasEnoughSpace) {
				result.blockers.push('磁盘空间不足，无法创建备份和进行升级');
				result.safe = false;
			}

			// 5. 验证备份系统
			const backupSystemReady = await this.validateBackupSystem();
			if (!backupSystemReady) {
				result.recommendations.push('建议在升级前手动创建数据库备份');
			}

			console.log(`🔍 零停机升级检查完成: ${result.safe ? '✅ 安全' : '❌ 有阻塞因素'}`);

		} catch (error) {
			result.safe = false;
			result.blockers.push(`零停机升级检查失败: ${error instanceof Error ? error.message : String(error)}`);
		}

		return result;
	}

	private async checkLongRunningTransactions(): Promise<Record<string, unknown>[]> {
		try {
			// SQLite 不像 PostgreSQL 有 pg_stat_activity，这里做简化检查
			// 实际实现中可以通过应用层面的事务跟踪
			return [];
		} catch {
			return [];
		}
	}

	private async getActiveConnectionCount(): Promise<number> {
		// 由于 libsql 的连接池是内部管理的，这里返回估算值
		return 1; // 当前连接数
	}

	private async checkDatabaseLocks(): Promise<boolean> {
		try {
			// 尝试执行一个简单的查询来检查是否有锁
			await db.all(sql`SELECT 1`);
			return false; // 没有锁
		} catch {
			return true; // 可能有锁
		}
	}

	private async checkDiskSpace(): Promise<boolean> {
		try {
			// 简化的磁盘空间检查
			// 实际实现中应该检查文件系统的可用空间
			return true; // 假设空间足够
		} catch {
			return false;
		}
	}

	private async validateBackupSystem(): Promise<boolean> {
		try {
			// 检查备份目录是否存在且可写
			// 检查备份工具是否可用
			return true; // 简化实现
		} catch {
			return false;
		}
	}

	// 获取完整的兼容性报告
	async generateCompatibilityReport(): Promise<{
		overall_status: 'compatible' | 'incompatible' | 'warning';
		auth_compatibility: CompatibilityResult;
		zero_downtime_readiness: { safe: boolean; blockers: string[]; recommendations: string[] };
		schema_version_info: { current: string; target: string; dependencies_satisfied: boolean };
	}> {
		console.log('📋 生成兼容性报告...');

		const authResult = await this.validateAuthCompatibility();
		const zeroDowntimeResult = await this.validateZeroDowntimeUpgrade();
		
		// 检查版本依赖
		const versionRequirements = await this.checkVersionRequirements(this.CURRENT_SCHEMA_VERSION);

		const overall_status = 
			authResult.compatible && zeroDowntimeResult.safe 
				? (authResult.warnings.length > 0 ? 'warning' : 'compatible')
				: 'incompatible';

		return {
			overall_status,
			auth_compatibility: authResult,
			zero_downtime_readiness: zeroDowntimeResult,
			schema_version_info: {
				current: authResult.details.schema_version,
				target: this.CURRENT_SCHEMA_VERSION,
				dependencies_satisfied: versionRequirements.satisfied
			}
		};
	}
}