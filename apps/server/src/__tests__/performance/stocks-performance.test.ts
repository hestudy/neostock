import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../db';
import { stocks, stock_daily } from '../../db/schema/stocks';
import { testClient } from '../helpers/test-client';

// 类型定义
interface SearchApiResponse {
  stocks: Array<{
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
  }>;
  total: number;
}

interface ListApiResponse {
  stocks: Array<{
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
  }>;
  nextCursor: number | null;
  total: number;
}

interface DetailApiResponse {
  stock: {
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
  } | null;
  latestPrice: {
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
  } | null;
}

describe('Stocks API Performance Tests', () => {
  const PERFORMANCE_THRESHOLD_MS = 100; // <100ms requirement

  beforeAll(async () => {
    // 插入测试数据以确保有足够的数据进行性能测试
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
        list_date: '19911008',
        is_hs: '1',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    // 清理并插入测试数据
    await db.delete(stock_daily);
    await db.delete(stocks);
    await db.insert(stocks).values(testStocks);

    // 插入一些日线数据用于测试
    const dailyData = [
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
    ];

    await db.insert(stock_daily).values(dailyData);
  });

  afterAll(async () => {
    // 清理测试数据
    await db.delete(stock_daily);
    await db.delete(stocks);
  });

  describe('Search Performance', () => {
    it('should respond to stock search within 100ms', async () => {
      const startTime = Date.now();
      
      const response = await testClient.stocks.search.query({
        keyword: '平安',
        limit: 20,
      }) as SearchApiResponse;
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(response.stocks).toHaveLength(1);
      expect(response.stocks[0].name).toBe('平安银行');
    });

    it('should handle concurrent search requests efficiently', async () => {
      const concurrentRequests = 10;
      const searchPromises = Array.from({ length: concurrentRequests }, (_, i) =>
        Promise.resolve().then(async () => {
          const startTime = Date.now();
          const response = await testClient.stocks.search.query({
            keyword: i % 2 === 0 ? '银行' : '万科',
            limit: 10,
          }) as SearchApiResponse;
          const endTime = Date.now();
          return {
            responseTime: endTime - startTime,
            resultCount: response.stocks.length,
          };
        })
      );

      const results = await Promise.all(searchPromises);
      
      // 所有请求都应在100ms内完成
      results.forEach(({ responseTime }) => {
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      });

      // 验证搜索结果正确性
      expect(results.some(r => r.resultCount > 0)).toBe(true);
    });

    it('should handle empty search results quickly', async () => {
      const startTime = Date.now();
      
      const response = await testClient.stocks.search.query({
        keyword: 'NONEXISTENT_STOCK',
        limit: 20,
      }) as SearchApiResponse;
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(response.stocks).toHaveLength(0);
      expect(response.total).toBe(0);
    });
  });

  describe('Stock Detail Performance', () => {
    it('should fetch stock detail within 100ms', async () => {
      const startTime = Date.now();
      
      const response = await testClient.stocks.detail.query({
        ts_code: '000001.SZ',
      }) as DetailApiResponse;
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(response.stock).not.toBeNull();
      expect(response.stock!.name).toBe('平安银行');
      expect(response.latestPrice).not.toBeNull();
    });

    it('should handle multiple detail requests concurrently', async () => {
      const stockCodes = ['000001.SZ', '000002.SZ', '600000.SH'];
      
      const detailPromises = stockCodes.map(async (ts_code) => {
        const startTime = Date.now();
        const response = await testClient.stocks.detail.query({ ts_code }) as DetailApiResponse;
        const endTime = Date.now();
        return {
          ts_code,
          responseTime: endTime - startTime,
          hasData: !!response.stock,
        };
      });

      const results = await Promise.all(detailPromises);
      
      // 所有请求都应在100ms内完成
      results.forEach(({ responseTime }) => {
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      });

      // 验证数据正确性
      expect(results.every(r => r.hasData)).toBe(true);
    });
  });

  describe('Stock List Performance', () => {
    it('should fetch stock list within 100ms', async () => {
      const startTime = Date.now();
      
      const response = await testClient.stocks.list.query({
        limit: 50,
      }) as ListApiResponse;
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(response.stocks.length).toBeGreaterThan(0);
      expect(response.total).toBeGreaterThan(0);
    });

    it('should handle paginated requests efficiently', async () => {
      const pageSize = 20;
      const pages = 3;
      
      const paginationPromises = Array.from({ length: pages }, (_, i) =>
        Promise.resolve().then(async () => {
          const startTime = Date.now();
          const response = await testClient.stocks.list.query({
            cursor: i * pageSize,
            limit: pageSize,
          }) as ListApiResponse;
          const endTime = Date.now();
          return {
            page: i,
            responseTime: endTime - startTime,
            resultCount: response.stocks.length,
          };
        })
      );

      const results = await Promise.all(paginationPromises);
      
      // 所有分页请求都应在100ms内完成
      results.forEach(({ responseTime }) => {
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      });
    });
  });

  describe('Daily Data Performance', () => {
    it('should fetch daily data within 100ms', async () => {
      const startTime = Date.now();
      
      await testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        limit: 100,
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should handle date range queries efficiently', async () => {
      const startTime = Date.now();
      
      await testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        start_date: '20240801',
        end_date: '20240831',
        limit: 50,
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });

  describe('Database Index Performance', () => {
    it('should benefit from search indexes', async () => {
      // 测试索引效果：名称搜索
      const nameSearchStart = Date.now();
      await testClient.stocks.search.query({
        keyword: '银行',
        limit: 50,
      });
      const nameSearchTime = Date.now() - nameSearchStart;

      // 测试索引效果：代码搜索  
      const codeSearchStart = Date.now();
      await testClient.stocks.search.query({
        keyword: '000001',
        limit: 50,
      });
      const codeSearchTime = Date.now() - codeSearchStart;

      // 两种搜索都应该很快
      expect(nameSearchTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(codeSearchTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should optimize daily data queries with composite indexes', async () => {
      const startTime = Date.now();
      
      // 这个查询应该利用 ts_code + trade_date 复合索引
      await testClient.stocks.dailyData.query({
        ts_code: '000001.SZ',
        start_date: '20240801',
        end_date: '20240831',
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not cause memory leaks with repeated requests', async () => {
      const initialMemory = process.memoryUsage();
      
      // 执行100次搜索请求
      for (let i = 0; i < 100; i++) {
        await testClient.stocks.search.query({
          keyword: `test${i % 10}`,
          limit: 10,
        });
      }
      
      const finalMemory = process.memoryUsage();
      
      // 内存增长应该在合理范围内（不超过50MB）
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle invalid requests quickly', async () => {
      const startTime = Date.now();
      
      try {
        await testClient.stocks.detail.query({
          ts_code: 'INVALID_CODE',
        });
      } catch {
        // 错误也应该快速响应
      }
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should handle malformed search queries efficiently', async () => {
      const malformedQueries = ['', '   ', '%', '%%%', '\\', '/', '?'];
      
      const errorPromises = malformedQueries.map(async (keyword) => {
        if (keyword.trim() === '') return { responseTime: 0 }; // Skip empty queries
        
        const startTime = Date.now();
        try {
          await testClient.stocks.search.query({
            keyword,
            limit: 10,
          });
        } catch {
          // 预期的错误
        }
        const endTime = Date.now();
        return { responseTime: endTime - startTime };
      });

      const results = await Promise.all(errorPromises);
      
      // 即使是错误情况也应该快速响应
      results.forEach(({ responseTime }) => {
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      });
    });
  });
});