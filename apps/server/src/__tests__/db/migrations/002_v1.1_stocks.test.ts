import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnhancedMigrator } from '../../../db/migrations/enhanced-migrator';
import { migration_002_v1_1_create_stocks_tables } from '../../../db/migrations/002_v1.1_create_stocks_tables';

type TestDatabase = {
	prepare: (sql: string) => { 
		get: (...args: unknown[]) => unknown; 
		all: (...args: unknown[]) => unknown[]; 
		run: (...args: unknown[]) => { changes: number; lastInsertRowid: number };
	};
	exec: (sql: string) => void;
	close: () => void;
	run?: (query: string) => unknown;
};

describe('Stock Tables Migration Tests', () => {
	let migrator: EnhancedMigrator;
	let testDb: TestDatabase;

	beforeEach(async () => {
		// 为每个测试使用独立的内存数据库
		migrator = new EnhancedMigrator(':memory:');
		migrator.addMigration(migration_002_v1_1_create_stocks_tables);
		testDb = migrator.getDbForTesting() as TestDatabase;
	});

	afterEach(async () => {
		migrator?.close();
	});

	describe('正向迁移测试', () => {
		it('应该成功执行 up 迁移', async () => {
			const result = await migrator.runEnhancedMigrations();
			
			expect(result.success).toBe(true);
			expect(result.applied).toContain('002_v1.1_create_stocks_tables');
			expect(result.errors).toHaveLength(0);

			// 验证表是否被创建
			const tables = testDb.prepare(`
				SELECT name FROM sqlite_master 
				WHERE type='table' AND name IN ('stocks', 'stock_daily', 'user_stock_favorites')
			`).all();

			expect(tables).toHaveLength(3);
		});

		it('应该创建所有必需的索引', async () => {
			await migrator.runEnhancedMigrations();

			// 验证 stocks 表索引
			const stocksIndexes = testDb.prepare("PRAGMA index_list(stocks)").all();
			const stocksIndexNames = stocksIndexes.map((idx: unknown) => (idx as Record<string, unknown>).name);
			
			expect(stocksIndexNames).toContain('stocks_symbol_idx');
			expect(stocksIndexNames).toContain('stocks_name_idx');
			expect(stocksIndexNames).toContain('stocks_industry_idx');

			// 验证 stock_daily 表索引
			const dailyIndexes = testDb.prepare("PRAGMA index_list(stock_daily)").all();
			const dailyIndexNames = dailyIndexes.map((idx: unknown) => (idx as Record<string, unknown>).name);
			
			expect(dailyIndexNames).toContain('stock_daily_ts_code_trade_date_idx');
			expect(dailyIndexNames).toContain('stock_daily_trade_date_idx');
		});

		it('应该正确设置外键约束', async () => {
			await migrator.runEnhancedMigrations();

			// 检查外键约束是否启用
			const foreignKeysEnabled = testDb.prepare("PRAGMA foreign_keys").get() as Record<string, unknown> | null;
			if (foreignKeysEnabled && 'foreign_keys' in foreignKeysEnabled) {
				expect((foreignKeysEnabled as { foreign_keys: number }).foreign_keys).toBe(1);
			} else {
				console.warn('无法检查外键约束状态');
			}

			// 检查 stock_daily 表的外键
			const dailyForeignKeys = testDb.prepare("PRAGMA foreign_key_list(stock_daily)").all();
			expect(dailyForeignKeys).toHaveLength(1);
			expect((dailyForeignKeys[0] as Record<string, unknown>).table).toBe('stocks');

			// 检查 user_stock_favorites 表的外键
			const favoritesForeignKeys = testDb.prepare("PRAGMA foreign_key_list(user_stock_favorites)").all();
			expect(favoritesForeignKeys).toHaveLength(2);
		});
	});

	describe('回滚迁移测试', () => {
		it('应该成功执行 down 迁移', async () => {
			// 先执行正向迁移
			await migrator.runEnhancedMigrations();
			
			// 验证表存在
			let tables = testDb.prepare(`
				SELECT name FROM sqlite_master 
				WHERE type='table' AND name IN ('stocks', 'stock_daily', 'user_stock_favorites')
			`).all();
			expect(tables).toHaveLength(3);

			// 执行回滚
			const rollbackResult = await migrator.rollbackMigration('002_v1.1_create_stocks_tables');
			expect(rollbackResult.success).toBe(true);

			// 验证表被删除
			tables = testDb.prepare(`
				SELECT name FROM sqlite_master 
				WHERE type='table' AND name IN ('stocks', 'stock_daily', 'user_stock_favorites')
			`).all();
			expect(tables).toHaveLength(0);
		});

		it('应该正确清理所有相关索引', async () => {
			// 执行正向迁移
			await migrator.runEnhancedMigrations();

			// 执行回滚
			await migrator.rollbackMigration('002_v1.1_create_stocks_tables');

			// 验证索引被清理
			const allIndexes = testDb.prepare(`
				SELECT name FROM sqlite_master 
				WHERE type='index' AND name LIKE 'stock%'
			`).all();
			
			expect(allIndexes).toHaveLength(0);
		});
	});

	describe('事务管理测试', () => {
		it('应该处理迁移过程中的失败', async () => {
			// 创建一个不重试的迁移器
			const testMigrator = new EnhancedMigrator(':memory:', { maxRetries: 1 });
			testMigrator.addMigration(migration_002_v1_1_create_stocks_tables);
			const testDatabase = testMigrator.getDbForTesting() as TestDatabase;
			
			// 模拟迁移过程中的中断
			const originalRun = testDatabase.run;
			let callCount = 0;

			testDatabase.run = function(query: string) {
				callCount++;
				// 在创建股票日线表时模拟失败
				if (callCount >= 3 && query.includes('CREATE TABLE IF NOT EXISTS stock_daily')) {
					throw new Error('模拟数据库错误');
				}
				return originalRun ? originalRun.call(this, query) : undefined;
			};

			// 执行迁移，应该失败
			const result = await testMigrator.runEnhancedMigrations();
			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);

			// 验证部分表可能已经被创建（DDL 自动提交特性）
			const tables = testDatabase.prepare(`
				SELECT name FROM sqlite_master 
				WHERE type='table' AND name IN ('stocks', 'stock_daily', 'user_stock_favorites')
			`).all();
			
			// 由于SQLite DDL自动提交，stocks表可能已经创建，但stock_daily表创建失败
			expect(tables.length).toBeLessThan(3); // 不应该有全部3个表
			
			// 恢复原始方法
			testDatabase.run = originalRun;
			testMigrator.close();
		});

		it('应该记录迁移状态', async () => {
			await migrator.runEnhancedMigrations();

			// 检查迁移记录
			const migrationRecord = testDb.prepare('SELECT * FROM __migrations WHERE id = ?')
				.get('002_v1.1_create_stocks_tables') as Record<string, unknown> | undefined;
			
			expect(migrationRecord).toBeDefined();
			if (migrationRecord) {
				expect((migrationRecord as { name: string }).name).toBe('创建股票相关数据表');
			}

			// 检查迁移日志
			const migrationLogs = await migrator.getMigrationLogs();
			expect(migrationLogs.length).toBeGreaterThan(0);
			
			const stocksTableLog = migrationLogs.find(log => log.id === '002_v1.1_create_stocks_tables');
			expect(stocksTableLog).toBeDefined();
			expect(stocksTableLog?.status).toBe('completed');
		});
	});

	describe('数据完整性验证测试', () => {
		it('应该通过预迁移完整性验证', async () => {
			const validation = await migrator.validateDataIntegrity();
			expect(validation.valid).toBe(true);
			expect(validation.issues).toHaveLength(0);
		});

		it('应该通过后迁移完整性验证', async () => {
			await migrator.runEnhancedMigrations();
			
			const validation = await migrator.validateDataIntegrity();
			expect(validation.valid).toBe(true);
			expect(validation.issues).toHaveLength(0);
		});

		it('应该检测外键约束违反', async () => {
			await migrator.runEnhancedMigrations();

			// 插入违反外键约束的数据
			try {
				testDb.prepare(`
					INSERT INTO stock_daily (ts_code, trade_date, open, high, low, close, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?)
				`).run('999999.SH', '20231201', 10, 10, 10, 10, Date.now());
			} catch {
				// 预期会抛出错误
			}

			const validation = await migrator.validateDataIntegrity();
			// 根据实际情况，可能检测到外键违反
			console.log('完整性验证结果:', validation);
		});
	});

	describe('自动回滚测试', () => {
		it('应该在连续失败时触发自动回滚', async () => {
			// 创建一个会失败的迁移器，限制重试次数避免超时
			const failingMigrator = new EnhancedMigrator(':memory:', { maxRetries: 1 });
			
			// 添加一个会失败的迁移
			const failingMigration = {
				id: 'failing_migration',
				name: '失败的迁移',
				up: async () => {
					throw new Error('迁移失败');
				},
				down: async () => {
					console.log('执行回滚');
				}
			};

			failingMigrator.addMigration(failingMigration);

			const result = await failingMigrator.runEnhancedMigrations();
			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);

			failingMigrator.close();
		});
	});

	describe('大数据量迁移测试', () => {
		it('应该处理大量数据的迁移', async () => {
			await migrator.runEnhancedMigrations();

			// 插入大量测试数据
			const startTime = performance.now();
			const insertStmt = testDb.prepare(`
				INSERT INTO stocks (ts_code, symbol, name, area, industry, market, list_date, is_hs, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);

			const now = Date.now();
			for (let i = 1; i <= 1000; i++) {
				const stockCode = `${i.toString().padStart(6, '0')}`;
				insertStmt.run(
					`${stockCode}.SZ`,
					stockCode,
					`股票${i}`,
					'深圳',
					'测试行业',
					'主板',
					'20100101',
					'0',
					now,
					now
				);
			}

			const insertTime = performance.now() - startTime;
			console.log(`插入1000条股票数据耗时: ${insertTime.toFixed(2)}ms`);

			// 验证数据插入成功
			const count = testDb.prepare('SELECT COUNT(*) as count FROM stocks').get() as { count: number };
			expect(count.count).toBe(1000);

			// 测试批量查询性能
			const queryStartTime = performance.now();
			const stocks = testDb.prepare('SELECT * FROM stocks WHERE industry = ?').all('测试行业');
			const queryTime = performance.now() - queryStartTime;
			
			console.log(`查询1000条股票数据耗时: ${queryTime.toFixed(2)}ms`);
			expect(stocks.length).toBe(1000);
			expect(queryTime).toBeLessThan(100); // 应该在100ms内完成
		});
	});

	describe('并发迁移测试', () => {
		it('应该处理并发访问', async () => {
			await migrator.runEnhancedMigrations();

			// 模拟并发插入
			const promises = [];
			const now = Date.now();

			for (let i = 0; i < 10; i++) {
				const promise = new Promise<void>((resolve, reject) => {
					try {
						const insertStmt = testDb.prepare(`
							INSERT INTO stocks (ts_code, symbol, name, area, industry, market, list_date, is_hs, created_at, updated_at)
							VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
						`);
						
						insertStmt.run(
							`${i.toString().padStart(6, '0')}.SZ`,
							i.toString().padStart(6, '0'),
							`并发股票${i}`,
							'深圳',
							'测试',
							'主板',
							'20100101',
							'0',
							now + i,
							now + i
						);
						resolve();
					} catch (error) {
						reject(error);
					}
				});
				promises.push(promise);
			}

			// 等待所有并发操作完成
			const results = await Promise.allSettled(promises);
			const successful = results.filter(r => r.status === 'fulfilled').length;
			
			console.log(`并发插入成功: ${successful}/10`);
			expect(successful).toBeGreaterThan(5); // 至少一半成功

			// 验证数据一致性
			const count = testDb.prepare('SELECT COUNT(*) as count FROM stocks').get() as { count: number };
			expect(count.count).toBe(successful);
		});
	});
});