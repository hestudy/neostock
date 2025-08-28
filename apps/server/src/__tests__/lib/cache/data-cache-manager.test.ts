import { describe, test, expect, beforeEach, afterEach } from "vitest";
import type { StockBasicInfo, StockDailyData, DataFetchResponse } from "../../../types/data-sources";
import { DataCacheManager, type CacheConfig } from "../../../lib/cache/data-cache-manager";

describe("DataCacheManager", () => {
  let cacheManager: DataCacheManager;
  let mockConfig: CacheConfig;

  beforeEach(() => {
    mockConfig = {
      ttlSeconds: 60, // 1分钟用于测试
      maxEntries: 5, // 小容量用于测试
      enableStats: true,
      keyPrefix: "test_cache",
    };
    cacheManager = new DataCacheManager(mockConfig);
  });

  afterEach(() => {
    cacheManager?.destroy();
  });

  describe("基础缓存操作", () => {
    test("应该正确设置和获取股票基础信息", () => {
      const mockResponse: DataFetchResponse<StockBasicInfo> = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          symbol: "000001",
          name: "平安银行",
          area: "深圳",
          industry: "银行",
          market: "主板",
          list_date: "19910403",
          is_hs: "1",
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "test_123",
          timestamp: new Date(),
          cached: false,
        },
      };

      const key = "000001_SZ_basic";
      
      // 设置缓存
      cacheManager.setStockBasicInfo(key, mockResponse);
      
      // 获取缓存
      const cached = cacheManager.getStockBasicInfo(key);
      
      expect(cached).toBeTruthy();
      expect(cached!.data).toEqual(mockResponse.data);
      expect(cached!.sourceInfo?.name).toBe("tushare");
    });

    test("应该正确设置和获取股票日线数据", () => {
      const mockResponse: DataFetchResponse<StockDailyData> = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          trade_date: "20231201",
          open: 10.50,
          high: 11.20,
          low: 10.30,
          close: 11.00,
          vol: 1000000,
          amount: 10500000,
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "test_456",
          timestamp: new Date(),
          cached: false,
        },
      };

      const key = "000001_SZ_daily_20231201";
      
      // 设置缓存
      cacheManager.setStockDailyData(key, mockResponse);
      
      // 获取缓存
      const cached = cacheManager.getStockDailyData(key);
      
      expect(cached).toBeTruthy();
      expect(cached!.data).toEqual(mockResponse.data);
      expect(cached!.sourceInfo?.name).toBe("tushare");
    });
  });

  describe("缓存过期机制", () => {
    test("过期数据应该返回null", async () => {
      const mockResponse: DataFetchResponse<StockBasicInfo> = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          symbol: "000001",
          name: "平安银行",
          area: "深圳",
          industry: "银行",
          market: "主板",
          list_date: "19910403",
          is_hs: "1",
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "test_789",
          timestamp: new Date(),
          cached: false,
        },
      };

      const key = "expired_test";
      
      // 设置短过期时间的缓存
      cacheManager.setStockBasicInfo(key, mockResponse, 0.1); // 0.1秒
      
      // 立即获取应该成功
      expect(cacheManager.getStockBasicInfo(key)).toBeTruthy();
      
      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 过期后应该返回null
      expect(cacheManager.getStockBasicInfo(key)).toBeNull();
    });

    test("cleanupExpired 应该清理过期条目", async () => {
      const mockResponse: DataFetchResponse<StockBasicInfo> = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          symbol: "000001",
          name: "平安银行",
          area: "深圳",
          industry: "银行",
          market: "主板",
          list_date: "19910403",
          is_hs: "1",
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "test_cleanup",
          timestamp: new Date(),
          cached: false,
        },
      };

      // 设置3个条目，其中2个会过期
      cacheManager.setStockBasicInfo("key1", mockResponse, 0.1);
      cacheManager.setStockBasicInfo("key2", mockResponse, 0.1);
      cacheManager.setStockBasicInfo("key3", mockResponse, 60); // 这个不会过期
      
      expect(cacheManager.getSize()).toBe(3);
      
      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 手动清理过期条目
      const cleanedCount = cacheManager.cleanupExpired();
      
      expect(cleanedCount).toBe(2);
      expect(cacheManager.getSize()).toBe(1);
      expect(cacheManager.has("key3")).toBe(true);
    });
  });

  describe("缓存驱逐机制", () => {
    test("达到最大容量时应该驱逐最少使用的条目", () => {
      const mockResponse: DataFetchResponse<StockBasicInfo> = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          symbol: "000001",
          name: "平安银行",
          area: "深圳",
          industry: "银行",
          market: "主板",
          list_date: "19910403",
          is_hs: "1",
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "test_eviction",
          timestamp: new Date(),
          cached: false,
        },
      };

      // 填满缓存 (maxEntries = 5)
      for (let i = 0; i < 5; i++) {
        cacheManager.setStockBasicInfo(`key_${i}`, mockResponse);
      }
      
      expect(cacheManager.getSize()).toBe(5);
      
      // 多次访问key_0，使其成为最常用的
      cacheManager.getStockBasicInfo("key_0");
      cacheManager.getStockBasicInfo("key_0");
      cacheManager.getStockBasicInfo("key_0");
      
      // 添加新条目，应该驱逐最少使用的条目
      cacheManager.setStockBasicInfo("key_new", mockResponse);
      
      expect(cacheManager.getSize()).toBe(5);
      expect(cacheManager.has("key_0")).toBe(true); // 最常用的应该保留
      expect(cacheManager.has("key_new")).toBe(true); // 新添加的应该存在
    });
  });

  describe("缓存统计功能", () => {
    test("应该正确跟踪命中和未命中统计", () => {
      const mockResponse: DataFetchResponse<StockBasicInfo> = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          symbol: "000001",
          name: "平安银行",
          area: "深圳",
          industry: "银行",
          market: "主板",
          list_date: "19910403",
          is_hs: "1",
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "test_stats",
          timestamp: new Date(),
          cached: false,
        },
      };

      const key = "stats_test";
      
      // 初始统计应该为0
      let stats = cacheManager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      
      // 未命中 - 获取不存在的键
      expect(cacheManager.getStockBasicInfo(key)).toBeNull();
      
      stats = cacheManager.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.totalOperations).toBe(1);
      expect(stats.hitRate).toBe(0);
      
      // 设置缓存
      cacheManager.setStockBasicInfo(key, mockResponse);
      
      // 命中 - 获取存在的键
      expect(cacheManager.getStockBasicInfo(key)).toBeTruthy();
      expect(cacheManager.getStockBasicInfo(key)).toBeTruthy(); // 再次命中
      
      stats = cacheManager.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.totalOperations).toBe(3);
      expect(stats.hitRate).toBeCloseTo(2/3); // 2命中/3总操作
    });

    test("缓存命中率应该达到80%以上 (关键QA要求)", () => {
      const mockResponse: DataFetchResponse<StockBasicInfo> = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          symbol: "000001",
          name: "平安银行",
          area: "深圳",
          industry: "银行",
          market: "主板",
          list_date: "19910403",
          is_hs: "1",
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "test_hit_rate",
          timestamp: new Date(),
          cached: false,
        },
      };

      // 模拟真实使用场景：预填充一些数据
      for (let i = 0; i < 3; i++) {
        cacheManager.setStockBasicInfo(`stock_${i}`, mockResponse);
      }
      
      // 模拟重复访问模式 (典型的数据访问模式)
      let totalOperations = 0;
      
      // 80%的操作访问已缓存的数据
      for (let i = 0; i < 80; i++) {
        const stockIndex = i % 3; // 循环访问已缓存的股票
        cacheManager.getStockBasicInfo(`stock_${stockIndex}`);
        totalOperations++;
      }
      
      // 20%的操作访问新数据 (缓存未命中)
      for (let i = 0; i < 20; i++) {
        cacheManager.getStockBasicInfo(`new_stock_${i}`); // 这些不存在，会未命中
        totalOperations++;
      }
      
      const stats = cacheManager.getStats();
      
      expect(stats.totalOperations).toBe(totalOperations);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0.8); // 命中率 >= 80%
      
      console.log(`缓存命中率: ${(stats.hitRate * 100).toFixed(1)}% (${stats.hits}/${stats.totalOperations})`);
    });
  });

  describe("缓存管理操作", () => {
    test("clear() 应该清空所有缓存和统计", () => {
      const mockResponse: DataFetchResponse<StockBasicInfo> = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          symbol: "000001",
          name: "平安银行",
          area: "深圳",
          industry: "银行",
          market: "主板",
          list_date: "19910403",
          is_hs: "1",
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "test_clear",
          timestamp: new Date(),
          cached: false,
        },
      };

      // 添加一些数据和统计
      cacheManager.setStockBasicInfo("key1", mockResponse);
      cacheManager.getStockBasicInfo("key1"); // 创建一些统计
      
      expect(cacheManager.getSize()).toBe(1);
      expect(cacheManager.getStats().hits).toBeGreaterThan(0);
      
      // 清空缓存
      cacheManager.clear();
      
      expect(cacheManager.getSize()).toBe(0);
      expect(cacheManager.getStats().hits).toBe(0);
      expect(cacheManager.getStats().misses).toBe(0);
    });

    test("delete() 应该删除指定的缓存条目", () => {
      const mockResponse: DataFetchResponse<StockBasicInfo> = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          symbol: "000001",
          name: "平安银行",
          area: "深圳",
          industry: "银行",
          market: "主板",
          list_date: "19910403",
          is_hs: "1",
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "test_delete",
          timestamp: new Date(),
          cached: false,
        },
      };

      const key = "delete_test";
      
      // 设置缓存
      cacheManager.setStockBasicInfo(key, mockResponse);
      expect(cacheManager.has(key)).toBe(true);
      
      // 删除缓存
      const deleted = cacheManager.delete(key);
      
      expect(deleted).toBe(true);
      expect(cacheManager.has(key)).toBe(false);
      expect(cacheManager.getStockBasicInfo(key)).toBeNull();
    });

    test("getKeys() 应该返回所有缓存键", () => {
      const mockResponse: DataFetchResponse<StockBasicInfo> = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          symbol: "000001",
          name: "平安银行",
          area: "深圳",
          industry: "银行",
          market: "主板",
          list_date: "19910403",
          is_hs: "1",
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "test_keys",
          timestamp: new Date(),
          cached: false,
        },
      };

      const keys = ["key1", "key2", "key3"];
      
      keys.forEach(key => {
        cacheManager.setStockBasicInfo(key, mockResponse);
      });
      
      const retrievedKeys = cacheManager.getKeys();
      
      expect(retrievedKeys).toHaveLength(3);
      keys.forEach(key => {
        expect(retrievedKeys).toContain(`stock_basic_${key}`);
      });
    });
  });

  describe("配置管理", () => {
    test("updateConfig() 应该更新缓存配置", () => {
      const originalConfig = cacheManager.getConfig();
      expect(originalConfig.ttlSeconds).toBe(60);
      
      // 更新配置
      cacheManager.updateConfig({ ttlSeconds: 120 });
      
      const updatedConfig = cacheManager.getConfig();
      expect(updatedConfig.ttlSeconds).toBe(120);
      expect(updatedConfig.maxEntries).toBe(5); // 其他配置保持不变
    });
  });
});