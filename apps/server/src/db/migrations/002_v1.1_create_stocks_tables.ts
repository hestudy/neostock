import type { Migration } from './migrator';
import type { DatabaseWrapper } from './migrator';

export const migration_002_v1_1_create_stocks_tables: Migration = {
	id: '002_v1.1_create_stocks_tables',
	name: '创建股票相关数据表',
	
	async up(db: DatabaseWrapper): Promise<void> {
		console.log('🔄 开始创建股票相关数据表...');
		
		// 启用外键约束
		await db.run('PRAGMA foreign_keys = ON');
		
		// 1. 创建股票基础信息表
		await db.run(`
			CREATE TABLE IF NOT EXISTS stocks (
				ts_code TEXT PRIMARY KEY,
				symbol TEXT NOT NULL,
				name TEXT NOT NULL,
				area TEXT,
				industry TEXT,
				market TEXT,
				list_date TEXT,
				is_hs TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);
		
		// 2. 为股票表创建索引
		await db.run('CREATE INDEX IF NOT EXISTS stocks_symbol_idx ON stocks (symbol)');
		await db.run('CREATE INDEX IF NOT EXISTS stocks_name_idx ON stocks (name)');
		await db.run('CREATE INDEX IF NOT EXISTS stocks_industry_idx ON stocks (industry)');
		await db.run('CREATE INDEX IF NOT EXISTS stocks_market_idx ON stocks (market)');
		await db.run('CREATE INDEX IF NOT EXISTS stocks_industry_market_idx ON stocks (industry, market)');
		
		// 3. 创建日线数据表
		await db.run(`
			CREATE TABLE IF NOT EXISTS stock_daily (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				ts_code TEXT NOT NULL,
				trade_date TEXT NOT NULL,
				open REAL NOT NULL,
				high REAL NOT NULL,
				low REAL NOT NULL,
				close REAL NOT NULL,
				vol REAL DEFAULT 0,
				amount REAL DEFAULT 0,
				created_at INTEGER NOT NULL,
				FOREIGN KEY (ts_code) REFERENCES stocks (ts_code) ON DELETE CASCADE ON UPDATE CASCADE
			)
		`);
		
		// 4. 为日线数据表创建索引
		await db.run('CREATE UNIQUE INDEX IF NOT EXISTS stock_daily_ts_code_trade_date_idx ON stock_daily (ts_code, trade_date)');
		await db.run('CREATE INDEX IF NOT EXISTS stock_daily_trade_date_idx ON stock_daily (trade_date)');
		await db.run('CREATE INDEX IF NOT EXISTS stock_daily_ts_code_idx ON stock_daily (ts_code)');
		await db.run('CREATE INDEX IF NOT EXISTS stock_daily_ts_code_date_range_idx ON stock_daily (ts_code, trade_date)');
		
		// 5. 创建用户收藏股票关联表
		await db.run(`
			CREATE TABLE IF NOT EXISTS user_stock_favorites (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT NOT NULL,
				ts_code TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE ON UPDATE CASCADE,
				FOREIGN KEY (ts_code) REFERENCES stocks (ts_code) ON DELETE CASCADE ON UPDATE CASCADE
			)
		`);
		
		// 6. 为用户收藏表创建索引
		await db.run('CREATE UNIQUE INDEX IF NOT EXISTS user_stock_favorites_user_ts_code_idx ON user_stock_favorites (user_id, ts_code)');
		await db.run('CREATE INDEX IF NOT EXISTS user_stock_favorites_user_id_idx ON user_stock_favorites (user_id)');
		await db.run('CREATE INDEX IF NOT EXISTS user_stock_favorites_ts_code_idx ON user_stock_favorites (ts_code)');
		
		console.log('✅ 股票相关数据表创建完成');
	},
	
	async down(db: DatabaseWrapper): Promise<void> {
		console.log('🔄 开始回滚股票相关数据表...');
		
		// 按照依赖关系逆序删除表
		// 1. 删除用户收藏表（依赖其他表）
		await db.run('DROP INDEX IF EXISTS user_stock_favorites_user_ts_code_idx');
		await db.run('DROP INDEX IF EXISTS user_stock_favorites_user_id_idx');
		await db.run('DROP INDEX IF EXISTS user_stock_favorites_ts_code_idx');
		await db.run('DROP TABLE IF EXISTS user_stock_favorites');
		
		// 2. 删除日线数据表（依赖股票表）
		await db.run('DROP INDEX IF EXISTS stock_daily_ts_code_trade_date_idx');
		await db.run('DROP INDEX IF EXISTS stock_daily_trade_date_idx');
		await db.run('DROP INDEX IF EXISTS stock_daily_ts_code_idx');
		await db.run('DROP INDEX IF EXISTS stock_daily_ts_code_date_range_idx');
		await db.run('DROP TABLE IF EXISTS stock_daily');
		
		// 3. 删除股票基础信息表
		await db.run('DROP INDEX IF EXISTS stocks_symbol_idx');
		await db.run('DROP INDEX IF EXISTS stocks_name_idx');
		await db.run('DROP INDEX IF EXISTS stocks_industry_idx');
		await db.run('DROP INDEX IF EXISTS stocks_market_idx');
		await db.run('DROP INDEX IF EXISTS stocks_industry_market_idx');
		await db.run('DROP TABLE IF EXISTS stocks');
		
		console.log('✅ 股票相关数据表回滚完成');
	}
};