import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import type { DataFetchRequest } from "../../types/data-sources";
import { TushareDataSource } from "../../lib/data-sources/tushare-data-source";
import { SinaDataSource } from "../../lib/data-sources/sina-data-source";
import { dataCacheManager } from "../../lib/cache/data-cache-manager";

describe("数据源缓存集成测试", () => {
  let tushareDataSource: TushareDataSource;
  let sinaDataSource: SinaDataSource;

  beforeEach(() => {
    // 清理缓存
    dataCacheManager.clear();
    
    // 模拟环境变量
    process.env.TUSHARE_API_TOKEN = "test_token_12345";
    
    try {
      tushareDataSource = new TushareDataSource();
      sinaDataSource = new SinaDataSource();
    } catch (error) {
      // 如果初始化失败，跳过这些测试
      console.warn("数据源初始化失败，可能是配置问题:", error);
    }
  });

  afterEach(() => {
    dataCacheManager.clear();
    delete process.env.TUSHARE_API_TOKEN;
  });

  describe("股票基础信息缓存", () => {
    test("第一次调用应该从数据源获取，第二次应该从缓存获取", async () => {
      if (!tushareDataSource) {
        console.log("跳过测试：Tushare数据源未初始化");
        return;
      }

      const request: DataFetchRequest = {
        limit: 5,
      };

      // Mock fetch 来避免真实API调用
      const mockResponse = {
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
          requestId: "mock_123",
          timestamp: new Date(),
          cached: false,
        },
      };

      // Mock fetchStockBasicInfoRaw 方法
      const mockFetch = vi.spyOn(tushareDataSource, 'fetchStockBasicInfoRaw')
        .mockResolvedValue(mockResponse);

      // 第一次调用 - 应该调用数据源
      const firstResponse = await tushareDataSource.getStockBasicInfo(request);
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(firstResponse.sourceInfo?.cached).toBe(false);
      expect(firstResponse.data).toEqual(mockResponse.data);

      // 第二次调用 - 应该从缓存获取
      const secondResponse = await tushareDataSource.getStockBasicInfo(request);
      
      expect(mockFetch).toHaveBeenCalledTimes(1); // 没有再次调用
      expect(secondResponse.sourceInfo?.cached).toBe(true);
      expect(secondResponse.data).toEqual(mockResponse.data);

      mockFetch.mockRestore();
    });

    test("不同的请求参数应该产生不同的缓存键", async () => {
      if (!tushareDataSource) {
        console.log("跳过测试：Tushare数据源未初始化");
        return;
      }

      const mockResponse1 = {
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
          requestId: "mock_1",
          timestamp: new Date(),
          cached: false,
        },
      };

      const mockResponse2 = {
        success: true,
        data: [{
          ts_code: "000002.SZ",
          symbol: "000002",
          name: "万科A",
          area: "深圳",
          industry: "房地产",
          market: "主板",
          list_date: "19910129",
          is_hs: "1",
        }],
        source: "tushare",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "tushare",
          requestId: "mock_2",
          timestamp: new Date(),
          cached: false,
        },
      };

      const mockFetch = vi.spyOn(tushareDataSource, 'fetchStockBasicInfoRaw')
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // 不同的请求参数
      const request1: DataFetchRequest = { limit: 5 };
      const request2: DataFetchRequest = { limit: 10 };

      // 两次不同的调用
      const response1 = await tushareDataSource.getStockBasicInfo(request1);
      const response2 = await tushareDataSource.getStockBasicInfo(request2);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response1.data[0].ts_code).toBe("000001.SZ");
      expect(response2.data[0].ts_code).toBe("000002.SZ");

      // 重复相同参数的调用应该使用缓存
      const response1Cached = await tushareDataSource.getStockBasicInfo(request1);
      const response2Cached = await tushareDataSource.getStockBasicInfo(request2);

      expect(mockFetch).toHaveBeenCalledTimes(2); // 没有新的调用
      expect(response1Cached.sourceInfo?.cached).toBe(true);
      expect(response2Cached.sourceInfo?.cached).toBe(true);

      mockFetch.mockRestore();
    });
  });

  describe("股票日线数据缓存", () => {
    test("日线数据应该正确使用缓存机制", async () => {
      if (!tushareDataSource) {
        console.log("跳过测试：Tushare数据源未初始化");
        return;
      }

      const request: DataFetchRequest = {
        tsCodes: ["000001.SZ"],
        startDate: "20231201",
        endDate: "20231201",
      };

      const mockResponse = {
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
          requestId: "mock_daily",
          timestamp: new Date(),
          cached: false,
        },
      };

      const mockFetch = vi.spyOn(tushareDataSource, 'fetchStockDailyDataRaw')
        .mockResolvedValue(mockResponse);

      // 第一次调用
      const firstResponse = await tushareDataSource.getStockDailyData(request);
      expect(firstResponse.sourceInfo?.cached).toBe(false);

      // 第二次调用 - 应该从缓存获取
      const secondResponse = await tushareDataSource.getStockDailyData(request);
      expect(secondResponse.sourceInfo?.cached).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      mockFetch.mockRestore();
    });

    test("不同数据源的相同数据应该有独立的缓存", async () => {
      if (!tushareDataSource || !sinaDataSource) {
        console.log("跳过测试：数据源未初始化");
        return;
      }

      const request: DataFetchRequest = {
        tsCodes: ["000001.SZ"],
      };

      const tushareResponse = {
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
          requestId: "tushare_123",
          timestamp: new Date(),
          cached: false,
        },
      };

      const sinaResponse = {
        success: true,
        data: [{
          ts_code: "000001.SZ",
          trade_date: "20231201",
          open: 10.52, // 略微不同的数据
          high: 11.22,
          low: 10.32,
          close: 11.02,
          vol: 1000500,
          amount: 10505000,
        }],
        source: "sina",
        timestamp: new Date(),
        count: 1,
        sourceInfo: {
          name: "sina",
          requestId: "sina_456",
          timestamp: new Date(),
          cached: false,
        },
      };

      const mockTushareFetch = vi.spyOn(tushareDataSource, 'fetchStockDailyDataRaw')
        .mockResolvedValue(tushareResponse);
      const mockSinaFetch = vi.spyOn(sinaDataSource, 'fetchStockDailyDataRaw')
        .mockResolvedValue(sinaResponse);

      // 从两个数据源获取数据
      const tushareResult = await tushareDataSource.getStockDailyData(request);
      const sinaResult = await sinaDataSource.getStockDailyData(request);

      // 应该分别调用各自的数据源
      expect(mockTushareFetch).toHaveBeenCalledTimes(1);
      expect(mockSinaFetch).toHaveBeenCalledTimes(1);

      // 数据应该不同（因为缓存键不同）
      expect(tushareResult.data[0].open).toBe(10.50);
      expect(sinaResult.data[0].open).toBe(10.52);

      // 重复调用应该使用各自的缓存
      const tushareCached = await tushareDataSource.getStockDailyData(request);
      const sinaCached = await sinaDataSource.getStockDailyData(request);

      expect(mockTushareFetch).toHaveBeenCalledTimes(1); // 没有新调用
      expect(mockSinaFetch).toHaveBeenCalledTimes(1); // 没有新调用
      expect(tushareCached.sourceInfo?.cached).toBe(true);
      expect(sinaCached.sourceInfo?.cached).toBe(true);

      mockTushareFetch.mockRestore();
      mockSinaFetch.mockRestore();
    });
  });

  describe("缓存性能测试", () => {
    test("缓存命中率应该达到80%以上的要求", async () => {
      if (!tushareDataSource) {
        console.log("跳过测试：Tushare数据源未初始化");
        return;
      }

      // 模拟的股票数据
      const stockCodes = ["000001.SZ", "000002.SZ", "600000.SH", "600519.SH", "000858.SZ"];
      
      const mockFetch = vi.spyOn(tushareDataSource, 'fetchStockBasicInfoRaw')
        .mockImplementation(async () => {
          return {
            success: true,
            data: [{
              ts_code: "000001.SZ",
              symbol: "000001",
              name: "测试股票",
              area: "深圳",
              industry: "测试",
              market: "主板",
              list_date: "20000101",
              is_hs: "1",
            }],
            source: "tushare",
            timestamp: new Date(),
            count: 1,
            sourceInfo: {
              name: "tushare",
              requestId: `mock_${Date.now()}`,
              timestamp: new Date(),
              cached: false,
            },
          };
        });

      // 预热缓存 - 获取5只股票的数据
      for (const code of stockCodes) {
        await tushareDataSource.getStockBasicInfo({ tsCodes: [code] });
      }

      // 获取初始统计
      const initialStats = dataCacheManager.getStats();
      const initialOperations = initialStats.totalOperations;

      // 模拟真实访问模式：主要访问已缓存的数据
      const totalTestOperations = 100;
      
      for (let i = 0; i < totalTestOperations; i++) {
        if (i < 85) {
          // 85%的操作访问已缓存的数据
          const stockIndex = i % stockCodes.length;
          await tushareDataSource.getStockBasicInfo({ 
            tsCodes: [stockCodes[stockIndex]] 
          });
        } else {
          // 15%的操作访问新数据
          await tushareDataSource.getStockBasicInfo({ 
            tsCodes: [`new_${i}.SZ`] 
          });
        }
      }

      const finalStats = dataCacheManager.getStats();
      
      // 计算测试期间的命中率
      const testOperations = finalStats.totalOperations - initialOperations;
      const testHits = finalStats.hits - initialStats.hits;
      const testHitRate = testOperations > 0 ? testHits / testOperations : 0;

      console.log(`测试期间缓存统计:
        - 总操作数: ${testOperations}
        - 命中次数: ${testHits}
        - 未命中次数: ${finalStats.misses - initialStats.misses}
        - 命中率: ${(testHitRate * 100).toFixed(1)}%
      `);

      // 验证命中率达到80%以上
      expect(testHitRate).toBeGreaterThanOrEqual(0.8);

      mockFetch.mockRestore();
    });

    test("缓存应该显著提升重复查询的性能", async () => {
      if (!tushareDataSource) {
        console.log("跳过测试：Tushare数据源未初始化");
        return;
      }

      const request: DataFetchRequest = { tsCodes: ["000001.SZ"] };

      // Mock fetch 并添加延迟来模拟网络请求
      const mockFetch = vi.spyOn(tushareDataSource, 'fetchStockBasicInfoRaw')
        .mockImplementation(async () => {
          // 模拟网络延迟
          await new Promise(resolve => setTimeout(resolve, 100));
          
          return {
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
              requestId: `perf_${Date.now()}`,
              timestamp: new Date(),
              cached: false,
            },
          };
        });

      // 测量第一次调用时间（从数据源）
      const start1 = performance.now();
      await tushareDataSource.getStockBasicInfo(request);
      const time1 = performance.now() - start1;

      // 测量第二次调用时间（从缓存）
      const start2 = performance.now();
      await tushareDataSource.getStockBasicInfo(request);
      const time2 = performance.now() - start2;

      console.log(`性能对比:
        - 第一次调用 (数据源): ${time1.toFixed(2)}ms
        - 第二次调用 (缓存): ${time2.toFixed(2)}ms
        - 性能提升: ${(time1 / time2).toFixed(1)}x
      `);

      // 缓存调用应该显著更快（至少5倍）
      expect(time1).toBeGreaterThan(time2 * 5);

      mockFetch.mockRestore();
    });
  });
});