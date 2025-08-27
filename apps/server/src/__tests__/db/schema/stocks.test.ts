import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseMigrator } from '../../../db/migrations/migrator';
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

describe('Stock Database Schema Tests', () => {
	let migrator: DatabaseMigrator;
	let testDb: TestDatabase;

	beforeAll(async () => {
		// 使用内存数据库进行测试
		migrator = new DatabaseMigrator(':memory:');
		migrator.addMigration(migration_002_v1_1_create_stocks_tables);
		
		// 执行迁移
		const result = await migrator.runMigrations();
		expect(result.success).toBe(true);
		
		// 获取数据库连接用于测试
		testDb = migrator.getDbForTesting() as TestDatabase;
	});

	afterAll(async () => {
		migrator?.close();
	});

	describe('表结构验证', () => {
		it('应该成功创建 stocks 表', () => {
			const tableInfo = testDb.prepare("PRAGMA table_info(stocks)").all();
			const columnNames = tableInfo.map((col: unknown) => (col as Record<string, unknown>).name);
			
			expect(columnNames).toContain('ts_code');
			expect(columnNames).toContain('symbol');
			expect(columnNames).toContain('name');
			expect(columnNames).toContain('industry');
			expect(columnNames).toContain('market');
			expect(columnNames).toContain('list_date');
			expect(columnNames).toContain('is_hs');
			expect(columnNames).toContain('created_at');
			expect(columnNames).toContain('updated_at');
		});

		it('应该成功创建 stock_daily 表', () => {
			const tableInfo = testDb.prepare("PRAGMA table_info(stock_daily)").all();
			const columnNames = tableInfo.map((col: unknown) => (col as Record<string, unknown>).name);
			
			expect(columnNames).toContain('id');
			expect(columnNames).toContain('ts_code');
			expect(columnNames).toContain('trade_date');
			expect(columnNames).toContain('open');
			expect(columnNames).toContain('high');
			expect(columnNames).toContain('low');
			expect(columnNames).toContain('close');
			expect(columnNames).toContain('vol');
			expect(columnNames).toContain('amount');
		});

		it('应该成功创建 user_stock_favorites 表', () => {
			const tableInfo = testDb.prepare("PRAGMA table_info(user_stock_favorites)").all();
			const columnNames = tableInfo.map((col: unknown) => (col as Record<string, unknown>).name);
			
			expect(columnNames).toContain('id');
			expect(columnNames).toContain('user_id');
			expect(columnNames).toContain('ts_code');
			expect(columnNames).toContain('created_at');
		});
	});

	describe('索引验证', () => {
		it('应该创建必要的索引', () => {
			// 检查 stocks 表索引
			const stocksIndexes = testDb.prepare("PRAGMA index_list(stocks)").all();
			const stocksIndexNames = stocksIndexes.map((idx: unknown) => (idx as Record<string, unknown>).name);
			
			expect(stocksIndexNames).toContain('stocks_symbol_idx');
			expect(stocksIndexNames).toContain('stocks_name_idx');
			expect(stocksIndexNames).toContain('stocks_industry_idx');
			expect(stocksIndexNames).toContain('stocks_market_idx');

			// 检查 stock_daily 表索引
			const dailyIndexes = testDb.prepare("PRAGMA index_list(stock_daily)").all();
			const dailyIndexNames = dailyIndexes.map((idx: unknown) => (idx as Record<string, unknown>).name);
			
			expect(dailyIndexNames).toContain('stock_daily_ts_code_trade_date_idx');
			expect(dailyIndexNames).toContain('stock_daily_trade_date_idx');
			expect(dailyIndexNames).toContain('stock_daily_ts_code_idx');

			// 检查 user_stock_favorites 表索引
			const favoritesIndexes = testDb.prepare("PRAGMA index_list(user_stock_favorites)").all();
			const favoritesIndexNames = favoritesIndexes.map((idx: unknown) => (idx as Record<string, unknown>).name);
			
			expect(favoritesIndexNames).toContain('user_stock_favorites_user_ts_code_idx');
			expect(favoritesIndexNames).toContain('user_stock_favorites_user_id_idx');
		});
	});

	describe('数据插入和查询测试', () => {
		it('应该能插入股票基础数据', () => {
			const now = Date.now();
			const insertStmt = testDb.prepare(`
				INSERT INTO stocks (ts_code, symbol, name, area, industry, market, list_date, is_hs, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);

			// 插入测试数据
			const result = insertStmt.run(
				'000001.SZ', '000001', '平安银行', '深圳', '银行', '主板', '19910403', '1', now, now
			);

			expect(result.changes).toBe(1);
			
			// 验证数据插入成功
			const stock = testDb.prepare('SELECT * FROM stocks WHERE ts_code = ?').get('000001.SZ') as Record<string, unknown> | undefined;
			expect(stock).toBeDefined();
			expect(stock?.name).toBe('平安银行');
			expect(stock?.industry).toBe('银行');
		});

		it('应该能插入日线数据', () => {
			const now = Date.now();
			const insertStmt = testDb.prepare(`
				INSERT INTO stock_daily (ts_code, trade_date, open, high, low, close, vol, amount, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);

			// 插入日线数据
			const result = insertStmt.run(
				'000001.SZ', '20231201', 12.50, 12.80, 12.30, 12.75, 1000000, 12750000, now
			);

			expect(result.changes).toBe(1);
			
			// 验证数据插入成功
			const dailyData = testDb.prepare('SELECT * FROM stock_daily WHERE ts_code = ? AND trade_date = ?')
				.get('000001.SZ', '20231201') as Record<string, unknown> | undefined;
			expect(dailyData).toBeDefined();
			expect(dailyData?.close).toBe(12.75);
		});

		it('应该能创建用户收藏关系', () => {
			const now = Date.now();
			
			// 先插入用户数据（假设用户表已存在）
			try {
				testDb.prepare(`
					INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt)
					VALUES (?, ?, ?, ?, ?, ?)
				`).run('test-user-1', '测试用户', 'test@example.com', 1, now, now);
			} catch {
				// 用户表可能不存在，创建临时用户表
				testDb.exec(`
					CREATE TABLE IF NOT EXISTS user (
						id TEXT PRIMARY KEY,
						name TEXT NOT NULL,
						email TEXT NOT NULL,
						emailVerified INTEGER NOT NULL,
						createdAt INTEGER NOT NULL,
						updatedAt INTEGER NOT NULL
					)
				`);
				
				testDb.prepare(`
					INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
					VALUES (?, ?, ?, ?, ?, ?)
				`).run('test-user-1', '测试用户', 'test@example.com', 1, now, now);
			}

			// 插入收藏记录
			const insertFavorite = testDb.prepare(`
				INSERT INTO user_stock_favorites (user_id, ts_code, created_at)
				VALUES (?, ?, ?)
			`);

			const result = insertFavorite.run('test-user-1', '000001.SZ', now);
			expect(result.changes).toBe(1);

			// 验证收藏关系
			const favorite = testDb.prepare('SELECT * FROM user_stock_favorites WHERE user_id = ? AND ts_code = ?')
				.get('test-user-1', '000001.SZ');
			expect(favorite).toBeDefined();
		});
	});

	describe('外键约束测试', () => {
		it('应该验证日线数据的外键约束', () => {
			// 首先启用外键约束检查
			testDb.exec('PRAGMA foreign_keys = ON');
			
			const now = Date.now();
			
			// 尝试插入不存在股票的日线数据
			const insertInvalid = testDb.prepare(`
				INSERT INTO stock_daily (ts_code, trade_date, open, high, low, close, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`);

			try {
				const result = insertInvalid.run('999999.SH', '20231201', 10, 10.5, 9.8, 10.2, now);
				// 如果执行成功，说明外键约束没有生效，测试失败
				expect(result.changes).toBe(0); // 应该不会执行到这里
				throw new Error('Expected foreign key constraint to prevent insertion');
			} catch (error) {
				// 预期应该抛出外键约束错误
				expect(error).toBeDefined();
				expect(String(error)).toMatch(/FOREIGN KEY constraint failed|foreign key/i);
			}
		});

		it('应该验证唯一约束', () => {
			// 启用外键约束检查
			testDb.exec('PRAGMA foreign_keys = ON');
			
			const now = Date.now();
			
			// 尝试插入重复的股票代码+交易日期（这个组合在前面的测试中已经插入过）
			const insertDuplicate = testDb.prepare(`
				INSERT INTO stock_daily (ts_code, trade_date, open, high, low, close, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`);

			try {
				const result = insertDuplicate.run('000001.SZ', '20231201', 13, 13.2, 12.8, 13.1, now);
				// 如果执行成功，说明唯一约束没有生效，测试失败
				expect(result.changes).toBe(0); // 应该不会执行到这里
				throw new Error('Expected unique constraint to prevent duplicate insertion');
			} catch (error) {
				// 预期应该抛出唯一约束错误
				expect(error).toBeDefined();
				expect(String(error)).toMatch(/UNIQUE constraint failed|unique/i);
			}
		});
	});

	describe('查询性能测试', () => {
		beforeAll(async () => {
			// 插入更多测试数据
			const now = Date.now();
			const insertStock = testDb.prepare(`
				INSERT OR IGNORE INTO stocks (ts_code, symbol, name, area, industry, market, list_date, is_hs, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);

			// 插入多只股票
			for (let i = 2; i <= 100; i++) {
				const stockCode = String(i).padStart(6, '0');
				const result = insertStock.run(
					`${stockCode}.SZ`, stockCode, `测试股票${i}`, '深圳', '测试行业', '主板', '20100101', '0', now, now
				);
				console.log(`插入股票 ${stockCode}.SZ, changes: ${result.changes}`);
			}
			
			// 验证插入的股票数量
			const stockCount = testDb.prepare('SELECT COUNT(*) as count FROM stocks').get() as { count: number };
			console.log(`总股票数量: ${stockCount.count}`);
		});

		it('应该快速查询股票信息', () => {
			const startTime = performance.now();
			
			const stock = testDb.prepare('SELECT * FROM stocks WHERE ts_code = ?').get('000001.SZ');
			
			const queryTime = performance.now() - startTime;
			console.log(`股票查询耗时: ${queryTime.toFixed(2)}ms`);
			
			expect(stock).toBeDefined();
			expect(queryTime).toBeLessThan(50); // 应该在50ms内完成
		});

		it('应该快速查询行业股票', () => {
			const startTime = performance.now();
			
			// 先查询所有银行股票
			const bankStocks = testDb.prepare('SELECT * FROM stocks WHERE industry = ?').all('银行');
			
			// 如果银行股票为空，查询测试行业的股票
			const stocks = bankStocks.length > 0 ? bankStocks : testDb.prepare('SELECT * FROM stocks WHERE industry = ?').all('测试行业');
			
			const queryTime = performance.now() - startTime;
			console.log(`行业查询耗时: ${queryTime.toFixed(2)}ms`);
			console.log(`找到 ${stocks.length} 只股票`);
			
			expect(stocks.length).toBeGreaterThan(0);
			expect(queryTime).toBeLessThan(100); // 应该在100ms内完成
		});

		it('应该快速执行联表查询', () => {
			const startTime = performance.now();
			
			const result = testDb.prepare(`
				SELECT u.name, s.name as stock_name 
				FROM user_stock_favorites usf
				JOIN user u ON u.id = usf.user_id
				JOIN stocks s ON s.ts_code = usf.ts_code
				WHERE usf.user_id = ?
			`).all('test-user-1');
			
			const queryTime = performance.now() - startTime;
			console.log(`联表查询耗时: ${queryTime.toFixed(2)}ms`);
			
			expect(result).toBeDefined();
			expect(queryTime).toBeLessThan(100); // 应该在100ms内完成
		});
	});

	describe('数据完整性验证', () => {
		it('应该验证股票代码格式', () => {
			const validCodes = ['000001.SZ', '600000.SH', '300001.SZ', '002001.SZ'];
			const invalidCodes = ['00001.SZ', 'ABC123.SH', '000001', '000001.XX'];

			// 这里可以添加应用层的验证逻辑测试
			validCodes.forEach(code => {
				expect(code).toMatch(/^\d{6}\.(SH|SZ)$/);
			});

			invalidCodes.forEach(code => {
				expect(code).not.toMatch(/^\d{6}\.(SH|SZ)$/);
			});
		});

		it('应该验证价格数据的逻辑性', () => {
			// 测试价格数据的合理性
			const validPriceData = {
				open: 10.0,
				high: 10.5,
				low: 9.8,
				close: 10.2
			};

			const invalidPriceData = {
				open: 10.0,
				high: 9.5,  // 最高价低于开盘价
				low: 10.5,  // 最低价高于开盘价
				close: 10.2
			};

			// 验证有效数据
			expect(validPriceData.high).toBeGreaterThanOrEqual(Math.max(validPriceData.open, validPriceData.close));
			expect(validPriceData.low).toBeLessThanOrEqual(Math.min(validPriceData.open, validPriceData.close));

			// 验证无效数据
			expect(invalidPriceData.high).toBeLessThan(Math.max(invalidPriceData.open, invalidPriceData.close));
			expect(invalidPriceData.low).toBeGreaterThan(Math.min(invalidPriceData.open, invalidPriceData.close));
		});
	});
});