// import { DatabaseMigrator } from '../db/migrations/migrator';
import { EnhancedMigrator } from '../db/migrations/enhanced-migrator';
import { migration_002_v1_1_create_stocks_tables } from '../db/migrations/002_v1.1_create_stocks_tables';
import { CompatibilityValidator } from './compatibility-validator';
import { promises as fs } from 'fs';
import { join } from 'path';

type DatabaseInstance = {
	prepare: (sql: string) => {
		get: (params?: unknown[]) => Record<string, unknown>;
		all: (params?: unknown[]) => Record<string, unknown>[];
		run: (params?: unknown[]) => { changes: number };
	};
	exec: (sql: string) => void;
	close: () => void;
};

interface TestEnvironment {
	name: string;
	databasePath: string;
	description: string;
	dataSet?: string;
	migrator?: EnhancedMigrator;
	validator?: CompatibilityValidator;
}

interface TestResult {
	environment: string;
	success: boolean;
	duration: number;
	steps: {
		name: string;
		success: boolean;
		duration: number;
		details?: Record<string, unknown>;
		error?: string;
	}[];
	summary: {
		total_steps: number;
		passed_steps: number;
		failed_steps: number;
		compatibility_score: number;
	};
}

export class MigrationTestEnvironmentManager {
	private testEnvironments = new Map<string, TestEnvironment>();
	private readonly TEST_DIR = process.env.TEST_DB_DIR || './test-databases';
	private readonly TEST_DATA_DIR = process.env.TEST_DATA_DIR || './test-data';

	constructor() {
		this.initializeTestEnvironments();
	}

	private async initializeTestEnvironments() {
		await this.ensureDirectories();
		
		// 定义测试环境
		const environments: Omit<TestEnvironment, 'migrator' | 'validator'>[] = [
			{
				name: 'fresh_install',
				databasePath: join(this.TEST_DIR, 'fresh_install.db'),
				description: '全新安装环境 - 从空数据库开始',
				dataSet: 'empty'
			},
			{
				name: 'existing_auth_only',
				databasePath: join(this.TEST_DIR, 'existing_auth_only.db'),
				description: '仅有认证表的现有系统',
				dataSet: 'auth_only'
			},
			{
				name: 'production_like',
				databasePath: join(this.TEST_DIR, 'production_like.db'),
				description: '模拟生产环境 - 包含用户数据',
				dataSet: 'production_sample'
			},
			{
				name: 'stress_test',
				databasePath: join(this.TEST_DIR, 'stress_test.db'),
				description: '压力测试环境 - 大数据量',
				dataSet: 'large_dataset'
			}
		];

		for (const env of environments) {
			this.testEnvironments.set(env.name, {
				...env,
				migrator: undefined,
				validator: undefined
			});
		}

		console.log(`🧪 初始化了 ${environments.length} 个测试环境`);
	}

	private async ensureDirectories() {
		try {
			await fs.mkdir(this.TEST_DIR, { recursive: true });
			await fs.mkdir(this.TEST_DATA_DIR, { recursive: true });
		} catch (error) {
			console.warn('⚠️  创建测试目录失败:', error);
		}
	}

	// 准备测试环境
	async prepareTestEnvironment(environmentName: string): Promise<void> {
		const env = this.testEnvironments.get(environmentName);
		if (!env) {
			throw new Error(`测试环境不存在: ${environmentName}`);
		}

		console.log(`🔧 准备测试环境: ${env.name}`);

		try {
			// 清理现有数据库文件
			try {
				await fs.unlink(env.databasePath);
			} catch {
				// 文件不存在，忽略
			}

			// 创建并配置迁移器
			env.migrator = new EnhancedMigrator(env.databasePath, {
				onProgress: (progress) => {
					console.log(`  📊 迁移进度: ${progress.completed}/${progress.total} - ${progress.current}`);
				}
			});

			// 添加迁移
			env.migrator.addMigration(migration_002_v1_1_create_stocks_tables);

			// 创建兼容性验证器
			env.validator = new CompatibilityValidator();

			// 根据数据集初始化测试数据
			await this.initializeTestData(env);

			console.log(`✅ 测试环境 ${env.name} 准备完成`);

		} catch (error) {
			console.error(`❌ 准备测试环境失败:`, error);
			throw error;
		}
	}

	private async initializeTestData(env: TestEnvironment) {
		if (!env.migrator) {
			throw new Error('迁移器未初始化');
		}

		const db = env.migrator!.getDbForTesting() as DatabaseInstance;

		switch (env.dataSet) {
			case 'empty':
				// 空数据库，不需要初始化数据
				break;

			case 'auth_only':
				// 创建认证表并插入基础数据
				await this.createAuthTables(db);
				await this.insertBasicAuthData(db);
				break;

			case 'production_sample':
				// 创建认证表并插入生产样本数据
				await this.createAuthTables(db);
				await this.insertProductionSampleData(db);
				break;

			case 'large_dataset':
				// 创建认证表并插入大量测试数据
				await this.createAuthTables(db);
				await this.insertLargeDataset(db);
				break;

			default:
				console.warn(`未知的数据集类型: ${env.dataSet}`);
		}
	}

	private async createAuthTables(db: DatabaseInstance) {
		// 创建认证相关表（模拟现有系统）
		db.exec(`
			CREATE TABLE IF NOT EXISTS user (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				email TEXT NOT NULL UNIQUE,
				emailVerified INTEGER NOT NULL,
				image TEXT,
				createdAt INTEGER NOT NULL,
				updatedAt INTEGER NOT NULL
			)
		`);

		db.exec(`
			CREATE TABLE IF NOT EXISTS session (
				id TEXT PRIMARY KEY,
				expiresAt INTEGER NOT NULL,
				token TEXT NOT NULL UNIQUE,
				createdAt INTEGER NOT NULL,
				updatedAt INTEGER NOT NULL,
				ipAddress TEXT,
				userAgent TEXT,
				userId TEXT NOT NULL REFERENCES user(id)
			)
		`);

		db.exec(`
			CREATE TABLE IF NOT EXISTS account (
				id TEXT PRIMARY KEY,
				accountId TEXT NOT NULL,
				providerId TEXT NOT NULL,
				userId TEXT NOT NULL REFERENCES user(id),
				accessToken TEXT,
				refreshToken TEXT,
				idToken TEXT,
				accessTokenExpiresAt INTEGER,
				refreshTokenExpiresAt INTEGER,
				scope TEXT,
				password TEXT,
				createdAt INTEGER NOT NULL,
				updatedAt INTEGER NOT NULL
			)
		`);

		db.exec(`
			CREATE TABLE IF NOT EXISTS verification (
				id TEXT PRIMARY KEY,
				identifier TEXT NOT NULL,
				value TEXT NOT NULL,
				expiresAt INTEGER NOT NULL,
				createdAt INTEGER,
				updatedAt INTEGER
			)
		`);
	}

	private async insertBasicAuthData(db: DatabaseInstance) {
		const now = Date.now();
		
		// 插入测试用户
		db.prepare(`
			INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) 
			VALUES (?, ?, ?, ?, ?, ?)
		`).run(['test-user-1', '测试用户', 'test@example.com', 1, now, now]);

		// 插入测试会话
		db.prepare(`
			INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, userId) 
			VALUES (?, ?, ?, ?, ?, ?)
		`).run(['test-session-1', now + 86400000, 'test-token-123', now, now, 'test-user-1']);
	}

	private async insertProductionSampleData(db: DatabaseInstance) {
		const now = Date.now();
		
		// 插入多个用户模拟生产环境
		const users = [
			{ id: 'user-1', name: '张三', email: 'zhang@example.com' },
			{ id: 'user-2', name: '李四', email: 'li@example.com' },
			{ id: 'user-3', name: '王五', email: 'wang@example.com' }
		];

		for (const user of users) {
			db.prepare(`
				INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) 
				VALUES (?, ?, ?, ?, ?, ?)
			`).run([user.id, user.name, user.email, 1, now - Math.random() * 86400000 * 30, now]);

			// 为每个用户创建会话
			db.prepare(`
				INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, userId) 
				VALUES (?, ?, ?, ?, ?, ?)
			`).run([
				`session-${user.id}`, 
				now + 86400000, 
				`token-${user.id}-${Math.random().toString(36).slice(2)}`, 
				now - Math.random() * 3600000, 
				now, 
				user.id
			]);
		}
	}

	private async insertLargeDataset(db: DatabaseInstance) {
		const now = Date.now();
		
		// 批量插入大量用户数据
		const batchSize = 100;
		const totalUsers = 1000;

		for (let i = 0; i < totalUsers; i += batchSize) {
			const batch = [];
			for (let j = 0; j < batchSize && (i + j) < totalUsers; j++) {
				const userId = `user-${i + j + 1}`;
				batch.push([
					userId,
					`用户${i + j + 1}`,
					`user${i + j + 1}@example.com`,
					1,
					now - Math.random() * 86400000 * 365, // 随机创建时间（一年内）
					now
				]);
			}

			// 批量插入用户
			const stmt = db.prepare(`
				INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) 
				VALUES (?, ?, ?, ?, ?, ?)
			`);

			for (const userData of batch) {
				stmt.run(userData);
			}
		}

		console.log(`📊 已插入 ${totalUsers} 个测试用户`);
	}

	// 运行迁移测试
	async runMigrationTest(environmentName: string): Promise<TestResult> {
		const env = this.testEnvironments.get(environmentName);
		if (!env || !env.migrator || !env.validator) {
			throw new Error(`测试环境未准备: ${environmentName}`);
		}

		const result: TestResult = {
			environment: environmentName,
			success: true,
			duration: 0,
			steps: [],
			summary: {
				total_steps: 0,
				passed_steps: 0,
				failed_steps: 0,
				compatibility_score: 0
			}
		};

		const startTime = Date.now();
		console.log(`🧪 开始迁移测试: ${env.name}`);

		try {
			// 步骤 1: 预迁移兼容性验证
			await this.runTestStep(result, '预迁移兼容性验证', async () => {
				const compatResult = await env.validator!.validateAuthCompatibility();
				return {
					compatible: compatResult.compatible,
					issues: compatResult.issues.length,
					warnings: compatResult.warnings.length
				};
			});

			// 步骤 2: 数据完整性验证
			await this.runTestStep(result, '数据完整性验证', async () => {
				const integrityResult = await env.migrator!.validateDataIntegrity();
				return {
					valid: integrityResult.valid,
					issues: integrityResult.issues
				};
			});

			// 步骤 3: 执行迁移
			await this.runTestStep(result, '执行数据库迁移', async () => {
				const migrationResult = await env.migrator!.runEnhancedMigrations();
				return {
					success: migrationResult.success,
					applied: migrationResult.applied.length,
					errors: migrationResult.errors.length,
					backups: migrationResult.backups.length
				};
			});

			// 步骤 4: 后迁移验证
			await this.runTestStep(result, '后迁移验证', async () => {
				const postValidation = await env.migrator!.validateDataIntegrity();
				return {
					valid: postValidation.valid,
					issues: postValidation.issues.length
				};
			});

			// 步骤 5: 功能完整性测试
			await this.runTestStep(result, '功能完整性测试', async () => {
				return await this.runFunctionalTests(env);
			});

			// 步骤 6: 性能验证
			await this.runTestStep(result, '性能验证', async () => {
				return await this.runPerformanceTests(env);
			});

			// 计算总体得分
			result.summary.compatibility_score = Math.round(
				(result.summary.passed_steps / result.summary.total_steps) * 100
			);

			result.duration = Date.now() - startTime;
			result.success = result.summary.failed_steps === 0;

			console.log(`${result.success ? '✅' : '❌'} 测试完成: ${env.name} (${result.duration}ms)`);
			console.log(`📊 通过率: ${result.summary.passed_steps}/${result.summary.total_steps} (${result.summary.compatibility_score}%)`);

		} catch (error) {
			result.success = false;
			result.duration = Date.now() - startTime;
			console.error(`❌ 测试执行异常:`, error);
		}

		return result;
	}

	private async runTestStep(result: TestResult, stepName: string, testFn: () => Promise<Record<string, unknown>>): Promise<void> {
		const stepStartTime = Date.now();
		result.summary.total_steps++;

		try {
			console.log(`  🔄 ${stepName}...`);
			const stepResult = await testFn();
			
			const stepDuration = Date.now() - stepStartTime;
			result.steps.push({
				name: stepName,
				success: true,
				duration: stepDuration,
				details: stepResult
			});
			
			result.summary.passed_steps++;
			console.log(`  ✅ ${stepName} (${stepDuration}ms)`);

		} catch (error) {
			const stepDuration = Date.now() - stepStartTime;
			result.steps.push({
				name: stepName,
				success: false,
				duration: stepDuration,
				error: error instanceof Error ? error.message : String(error)
			});
			
			result.summary.failed_steps++;
			console.error(`  ❌ ${stepName} 失败 (${stepDuration}ms):`, error);
		}
	}

	private async runFunctionalTests(env: TestEnvironment): Promise<Record<string, unknown>> {
		const db = env.migrator!.getDbForTesting() as DatabaseInstance;
		const tests = [];

		// 测试股票表功能
		tests.push(await this.testStockTableOperations(db));
		
		// 测试用户收藏功能
		tests.push(await this.testUserFavoritesOperations(db));
		
		// 测试数据关联
		tests.push(await this.testDataRelationships(db));

		return {
			total_tests: tests.length,
			passed_tests: tests.filter(t => t.success).length,
			details: tests
		};
	}

	private async testStockTableOperations(db: DatabaseInstance) {
		try {
			// 插入测试股票数据
			const now = Date.now();
			db.prepare(`
				INSERT INTO stocks (ts_code, symbol, name, area, industry, market, list_date, is_hs, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).run(['000001.SZ', '000001', '平安银行', '深圳', '银行', '主板', '19910403', '1', now, now]);

			// 查询验证
			const stock = db.prepare('SELECT * FROM stocks WHERE ts_code = ?').get(['000001.SZ']) as Record<string, unknown> | undefined;
			
			return {
				test: 'stock_table_operations',
				success: Boolean(stock && stock.name === '平安银行'),
				details: { inserted: 1, queried: Boolean(stock) }
			};
		} catch (error) {
			return {
				test: 'stock_table_operations',
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	private async testUserFavoritesOperations(db: DatabaseInstance) {
		try {
			const now = Date.now();
			
			// 插入收藏记录（需要先确保用户和股票存在）
			db.prepare(`
				INSERT OR IGNORE INTO user_stock_favorites (user_id, ts_code, created_at)
				VALUES (?, ?, ?)
			`).run(['test-user-1', '000001.SZ', now]);

			// 查询验证
			const favorite = db.prepare(`
				SELECT * FROM user_stock_favorites 
				WHERE user_id = ? AND ts_code = ?
			`).get(['test-user-1', '000001.SZ']) as Record<string, unknown> | undefined;

			return {
				test: 'user_favorites_operations',
				success: Boolean(favorite),
				details: { inserted: 1, queried: Boolean(favorite) }
			};
		} catch (error) {
			return {
				test: 'user_favorites_operations',
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	private async testDataRelationships(db: DatabaseInstance) {
		try {
			// 测试联表查询
			const result = db.prepare(`
				SELECT u.name, s.name as stock_name 
				FROM user_stock_favorites usf
				JOIN user u ON u.id = usf.user_id
				JOIN stocks s ON s.ts_code = usf.ts_code
				WHERE usf.user_id = ?
			`).get(['test-user-1']) as Record<string, unknown> | undefined;

			return {
				test: 'data_relationships',
				success: Boolean(result),
				details: { join_result: Boolean(result) }
			};
		} catch (error) {
			return {
				test: 'data_relationships',
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	private async runPerformanceTests(env: TestEnvironment): Promise<Record<string, unknown>> {
		const db = env.migrator!.getDbForTesting() as DatabaseInstance;
		const results: Record<string, unknown>[] = [];

		// 测试查询性能
		const queryTests = [
			{ name: 'stock_lookup', query: 'SELECT * FROM stocks WHERE ts_code = ?', params: ['000001.SZ'] },
			{ name: 'user_favorites', query: 'SELECT COUNT(*) FROM user_stock_favorites WHERE user_id = ?', params: ['test-user-1'] },
			{ name: 'index_performance', query: 'SELECT * FROM stocks WHERE industry = ?', params: ['银行'] }
		];

		for (const test of queryTests) {
			const startTime = performance.now();
			
			try {
				db.prepare(test.query).get(test.params);
				const duration = performance.now() - startTime;
				
				results.push({
					test: test.name,
					success: duration < 200, // 200ms 阈值
					duration: Math.round(duration * 100) / 100,
					threshold: 200
				});
			} catch (error) {
				results.push({
					test: test.name,
					success: false,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}

		return {
			performance_tests: results,
			average_duration: results.reduce((sum, r) => sum + (typeof r.duration === 'number' ? r.duration : 0), 0) / results.length,
			passed_tests: results.filter(r => r.success).length,
			total_tests: results.length
		};
	}

	// 运行所有环境的测试
	async runAllTests(): Promise<Map<string, TestResult>> {
		const results = new Map<string, TestResult>();

		console.log('🚀 开始运行所有测试环境...');

		for (const [envName] of this.testEnvironments) {
			try {
				await this.prepareTestEnvironment(envName);
				const result = await this.runMigrationTest(envName);
				results.set(envName, result);
			} catch (error) {
				console.error(`❌ 环境 ${envName} 测试失败:`, error);
				results.set(envName, {
					environment: envName,
					success: false,
					duration: 0,
					steps: [],
					summary: { total_steps: 0, passed_steps: 0, failed_steps: 1, compatibility_score: 0 }
				});
			}
		}

		// 生成测试摘要
		this.generateTestSummary(results);

		return results;
	}

	private generateTestSummary(results: Map<string, TestResult>) {
		const totalTests = results.size;
		const passedTests = Array.from(results.values()).filter(r => r.success).length;
		const avgScore = Array.from(results.values()).reduce((sum, r) => sum + r.summary.compatibility_score, 0) / totalTests;

		console.log('\n📋 测试摘要报告');
		console.log('='.repeat(50));
		console.log(`总测试环境: ${totalTests}`);
		console.log(`通过环境: ${passedTests}`);
		console.log(`失败环境: ${totalTests - passedTests}`);
		console.log(`平均兼容性得分: ${Math.round(avgScore)}%`);
		console.log('='.repeat(50));

		// 详细结果
		for (const [envName, result] of results) {
			const status = result.success ? '✅' : '❌';
			console.log(`${status} ${envName}: ${result.summary.compatibility_score}% (${result.duration}ms)`);
		}
	}

	// 清理测试环境
	async cleanup(): Promise<void> {
		console.log('🧹 清理测试环境...');

		for (const [envName, env] of this.testEnvironments) {
			try {
				env.migrator?.close();
				await fs.unlink(env.databasePath).catch(() => {}); // 忽略文件不存在的错误
			} catch (error) {
				console.warn(`⚠️  清理环境 ${envName} 失败:`, error);
			}
		}

		this.testEnvironments.clear();
		console.log('✅ 测试环境清理完成');
	}
}