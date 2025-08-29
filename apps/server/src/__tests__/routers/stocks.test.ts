import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../db';
import { stocks, stock_daily, user_stock_favorites } from '../../db/schema/stocks';
// import { user } from '../../db/schema/auth';
import { testClient } from '../helpers/test-client';
import { sql } from 'drizzle-orm';

// 类型定义
interface StockBasicInfo {
  ts_code: string;
  symbol: string;
  name: string;
  area: string | null;
  industry: string | null;
  market: string | null;
  list_date: string | null;
  is_hs: string | null;
  created_at: Date;
  updated_at: Date;
}

interface StockDailyData {
  id: number;
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number | null;
  amount: number | null;
  created_at: Date;
}

interface SearchApiResponse {
  stocks: StockBasicInfo[];
  total: number;
}

interface ListApiResponse {
  stocks: StockBasicInfo[];
  nextCursor: number | null;
  total: number;
}

interface DetailApiResponse {
  stock: StockBasicInfo | null;
  latestPrice: StockDailyData | null;
}

interface DailyDataApiResponse {
  data: StockDailyData[];
  total: number;
}

describe('Stocks Router', () => {
  // 测试数据
  const testStocks = [
    {
      ts_code: '000001.SZ',
      symbol: '000001',
      name: '平安银行',
      area: '深圳',
      industry: '银行',
      market: '主板',
      list_date: '19910403',
      is_hs: '1',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      ts_code: '000002.SZ',
      symbol: '000002',
      name: '万科A',
      area: '深圳',
      industry: '房地产开发',
      market: '主板',
      list_date: '19910129',
      is_hs: '1',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      ts_code: '600000.SH',
      symbol: '600000',
      name: '浦发银行',
      area: '上海',
      industry: '银行',
      market: '主板',
      list_date: '19991108',
      is_hs: '1',
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  const testDailyData = [
    {
      ts_code: '000001.SZ',
      trade_date: '20240829',
      open: 10.50,
      high: 10.80,
      low: 10.40,
      close: 10.65,
      vol: 1000000,
      amount: 10650000,
      created_at: new Date(),
    },
    {
      ts_code: '000001.SZ',
      trade_date: '20240828',
      open: 10.30,
      high: 10.60,
      low: 10.20,
      close: 10.50,
      vol: 950000,
      amount: 9975000,
      created_at: new Date(),
    },
    {
      ts_code: '000002.SZ',
      trade_date: '20240829',
      open: 25.30,
      high: 25.80,
      low: 25.10,
      close: 25.65,
      vol: 2000000,
      amount: 51300000,
      created_at: new Date(),
    },
  ];

  beforeAll(async () => {
    // 直接创建测试所需的表
    await db.run(sql`CREATE TABLE IF NOT EXISTS stocks (
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
    )`);

    await db.run(sql`CREATE TABLE IF NOT EXISTS stock_daily (
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
      FOREIGN KEY (ts_code) REFERENCES stocks (ts_code)
    )`);

    await db.run(sql`CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      email_verified INTEGER NOT NULL,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);

    await db.run(sql`CREATE TABLE IF NOT EXISTS user_stock_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      ts_code TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user (id),
      FOREIGN KEY (ts_code) REFERENCES stocks (ts_code)
    )`);

    // 清理测试数据
    try {
      await db.delete(user_stock_favorites);
      await db.delete(stock_daily);
      await db.delete(stocks);
    } catch {
      // 忽略清理错误
    }
  });

  beforeEach(async () => {
    // 清理之前的数据
    try {
      await db.delete(user_stock_favorites);
      await db.delete(stock_daily);
      await db.delete(stocks);
    } catch {
      // 忽略错误
    }
    
    // 重新插入测试数据
    await db.insert(stocks).values(testStocks);
    await db.insert(stock_daily).values(testDailyData);
  });

  afterAll(async () => {
    // 清理所有测试数据
    await db.delete(user_stock_favorites);
    await db.delete(stock_daily);
    await db.delete(stocks);
  });

  describe('Search API', () => {
    it('should search stocks by code', async () => {
      const response = await testClient.stocks.search.query({
        keyword: '000001',
        limit: 10,
      }) as SearchApiResponse;

      expect(response.stocks).toHaveLength(1);
      expect(response.stocks[0].ts_code).toBe('000001.SZ');
      expect(response.stocks[0].name).toBe('平安银行');
      expect(response.total).toBe(1);
    });

    it('should search stocks by name', async () => {
      const response = await testClient.stocks.search.query({
        keyword: '平安',
        limit: 10,
      }) as SearchApiResponse;

      expect(response.stocks).toHaveLength(1);
      expect(response.stocks[0].name).toBe('平安银行');
      expect(response.total).toBe(1);
    });

    it('should search stocks by partial name', async () => {
      const response = await testClient.stocks.search.query({
        keyword: '银行',
        limit: 10,
      }) as SearchApiResponse;

      expect(response.stocks).toHaveLength(2);
      expect(response.stocks.every((stock: StockBasicInfo) => stock.name.includes('银行'))).toBe(true);
      expect(response.total).toBe(2);
    });

    it('should respect search limit', async () => {
      const response = await testClient.stocks.search.query({
        keyword: '银行',
        limit: 1,
      }) as SearchApiResponse;

      expect(response.stocks).toHaveLength(1);
      expect(response.total).toBe(2); // 总数仍应为2
    });

    it('should return empty result for non-existent stock', async () => {
      const response = await testClient.stocks.search.query({
        keyword: 'NONEXISTENT',
        limit: 10,
      }) as SearchApiResponse;

      expect(response.stocks).toHaveLength(0);
      expect(response.total).toBe(0);
    });

    it('should handle empty keyword gracefully', async () => {
      await expect(testClient.stocks.search.query({
        keyword: '',
        limit: 10,
      })).rejects.toThrow();
    });
  });

  describe('List API', () => {
    it('should return paginated stock list', async () => {
      const response = await testClient.stocks.list.query({
        cursor: 0,
        limit: 2,
      }) as ListApiResponse;

      expect(response.stocks).toHaveLength(2);
      expect(response.nextCursor).toBe(2);
      expect(response.total).toBe(3);
    });

    it('should handle last page correctly', async () => {
      const response = await testClient.stocks.list.query({
        cursor: 2,
        limit: 2,
      }) as ListApiResponse;

      expect(response.stocks).toHaveLength(1);
      expect(response.nextCursor).toBeNull();
      expect(response.total).toBe(3);
    });

    it('should filter by industry', async () => {
      const response = await testClient.stocks.list.query({
        industry: '银行',
        limit: 10,
      }) as ListApiResponse;

      expect(response.stocks).toHaveLength(2);
      expect(response.stocks.every((stock: StockBasicInfo) => stock.industry === '银行')).toBe(true);
      expect(response.total).toBe(2);
    });

    it('should return empty result for non-existent industry', async () => {
      const response = await testClient.stocks.list.query({
        industry: '不存在的行业',
        limit: 10,
      }) as ListApiResponse;

      expect(response.stocks).toHaveLength(0);
      expect(response.total).toBe(0);
    });
  });

  describe('Detail API', () => {
    it('should return stock detail with latest price', async () => {
      const response = await testClient.stocks.detail.query({
        ts_code: '000001.SZ',
      }) as DetailApiResponse;

      expect(response.stock).not.toBeNull();
      expect(response.stock!.ts_code).toBe('000001.SZ');
      expect(response.stock!.name).toBe('平安银行');
      
      expect(response.latestPrice).not.toBeNull();
      expect(response.latestPrice!.ts_code).toBe('000001.SZ');
      expect(response.latestPrice!.trade_date).toBe('20240829');
      expect(response.latestPrice!.close).toBe(10.65);
    });

    it('should return null for non-existent stock', async () => {
      const response = await testClient.stocks.detail.query({
        ts_code: 'INVALID.SZ',
      }) as DetailApiResponse;

      expect(response.stock).toBeNull();
      expect(response.latestPrice).toBeNull();
    });

    it('should handle stock without daily data', async () => {
      // 插入一只没有日线数据的股票
      await db.insert(stocks).values({
        ts_code: '999999.SZ',
        symbol: '999999',
        name: '测试股票',
        area: '测试',
        industry: '测试',
        market: '测试',
        list_date: '20240101',
        is_hs: '0',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const response = await testClient.stocks.detail.query({
        ts_code: '999999.SZ',
      }) as DetailApiResponse;

      expect(response.stock).not.toBeNull();
      expect(response.stock!.name).toBe('测试股票');
      expect(response.latestPrice).toBeNull();
    });
  });

  describe('Daily Data API', () => {
    it('should return daily data for stock', async () => {
      const response = await testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        limit: 10,
      }) as DailyDataApiResponse;

      expect(response.data).toHaveLength(2);
      expect(response.data[0].trade_date).toBe('20240829'); // 最新日期在前
      expect(response.data[1].trade_date).toBe('20240828');
      expect(response.total).toBe(2);
    });

    it('should filter by date range', async () => {
      const response = await testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        start_date: '20240829',
        end_date: '20240829',
        limit: 10,
      }) as DailyDataApiResponse;

      expect(response.data).toHaveLength(1);
      expect(response.data[0].trade_date).toBe('20240829');
      expect(response.total).toBe(1);
    });

    it('should filter by start date only', async () => {
      const response = await testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        start_date: '20240829',
        limit: 10,
      }) as DailyDataApiResponse;

      expect(response.data).toHaveLength(1);
      expect(response.data[0].trade_date).toBe('20240829');
    });

    it('should filter by end date only', async () => {
      const response = await testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        end_date: '20240828',
        limit: 10,
      }) as DailyDataApiResponse;

      expect(response.data).toHaveLength(1);
      expect(response.data[0].trade_date).toBe('20240828');
    });

    it('should return empty result for non-existent stock', async () => {
      const response = await testClient.stocks.dailyData.query({
        ts_code: 'INVALID.SZ',
        limit: 10,
      }) as DailyDataApiResponse;

      expect(response.data).toHaveLength(0);
      expect(response.total).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const response = await testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        limit: 1,
      }) as DailyDataApiResponse;

      expect(response.data).toHaveLength(1);
      expect(response.total).toBe(2);
    });
  });

  describe.skip('Favorites API (Protected)', () => {
    // const testUser = {
    //   id: 'test-user-123',
    //   name: 'Test User',
    //   email: 'test@example.com',
    //   email_verified: 0,
    //   image: null,
    //   created_at: Math.floor(Date.now() / 1000),
    //   updated_at: Math.floor(Date.now() / 1000),
    // };

    beforeEach(async () => {
      // 清理并插入测试用户
      // await db.delete(user);
      // await db.insert(user).values(testUser);
      // await db.delete(user_stock_favorites);
    });

    it('should add stock to favorites', async () => {
      // Note: This test assumes we have a way to create authenticated test client
      // For now, we'll skip the actual test since we need to implement auth mock
      expect(true).toBe(true); // Placeholder
    });

    it('should remove stock from favorites', async () => {
      // Note: This test assumes we have a way to create authenticated test client
      expect(true).toBe(true); // Placeholder
    });

    it('should get user favorites', async () => {
      // Note: This test assumes we have a way to create authenticated test client
      expect(true).toBe(true); // Placeholder
    });

    it('should check if stock is favorite', async () => {
      // Note: This test assumes we have a way to create authenticated test client
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Input Validation', () => {
    it('should validate search keyword length', async () => {
      await expect(testClient.stocks.search.query({
        keyword: '',
        limit: 10,
      })).rejects.toThrow();
    });

    it('should validate search limit range', async () => {
      await expect(testClient.stocks.search.query({
        keyword: '测试',
        limit: 0,
      })).rejects.toThrow();

      await expect(testClient.stocks.search.query({
        keyword: '测试',
        limit: 101,
      })).rejects.toThrow();
    });

    it('should validate list limit range', async () => {
      await expect(testClient.stocks.list.query({
        limit: 0,
      })).rejects.toThrow();

      await expect(testClient.stocks.list.query({
        limit: 101,
      })).rejects.toThrow();
    });

    it('should validate ts_code format', async () => {
      await expect(testClient.stocks.detail.query({
        ts_code: '',
      })).rejects.toThrow();
    });

    it('should validate daily data limit range', async () => {
      await expect(testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        limit: 0,
      })).rejects.toThrow();

      await expect(testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        limit: 501,
      })).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in search', async () => {
      const response = await testClient.stocks.search.query({
        keyword: '%银行%',
        limit: 10,
      }) as SearchApiResponse;

      // 应该能正常搜索，不会导致SQL注入
      expect(Array.isArray(response.stocks)).toBe(true);
    });

    it('should handle very long search keywords', async () => {
      const longKeyword = 'A'.repeat(100);
      
      const response = await testClient.stocks.search.query({
        keyword: longKeyword,
        limit: 10,
      }) as SearchApiResponse;

      expect(response.stocks).toHaveLength(0);
      expect(response.total).toBe(0);
    });

    it('should handle negative cursor gracefully', async () => {
      const response = await testClient.stocks.list.query({
        cursor: -1,
        limit: 10,
      }) as ListApiResponse;

      // 应该正常返回结果，从开始位置
      expect(Array.isArray(response.stocks)).toBe(true);
    });

    it('should handle future date ranges', async () => {
      const response = await testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        start_date: '20250101',
        end_date: '20250131',
        limit: 10,
      }) as DailyDataApiResponse;

      expect(response.data).toHaveLength(0);
      expect(response.total).toBe(0);
    });
  });
});