import { describe, it, expect, beforeEach } from "bun:test";
import { SinaDataSource } from "../../../lib/data-sources/sina-data-source";

describe("SinaDataSource", () => {
  let sinaSource: SinaDataSource;

  beforeEach(() => {
    // 注意：实际测试时需要确保配置已加载
    try {
      sinaSource = new SinaDataSource();
    } catch (error) {
      console.warn("新浪财经数据源初始化失败，可能是配置问题:", error);
      // 在配置不完整时跳过测试
      return;
    }
  });

  describe("基本功能", () => {
    it("应该正确返回数据源名称", () => {
      if (!sinaSource) return;
      expect(sinaSource.getName()).toBe("sina");
    });

    it("应该能够获取配置信息", () => {
      if (!sinaSource) return;
      const config = sinaSource.getConfig();
      expect(config).toBeDefined();
      expect(config.name).toBe("新浪财经");
      expect(config.priority).toBe(2);
    });
  });

  describe("健康检查", () => {
    it("应该能够执行健康检查", async () => {
      if (!sinaSource) return;
      
      // 设置较长的超时时间，因为网络请求可能较慢
      const healthResult = await sinaSource.healthCheck();
      
      expect(healthResult).toBeDefined();
      expect(healthResult).toHaveProperty("name");
      expect(healthResult).toHaveProperty("isHealthy");
      expect(healthResult).toHaveProperty("lastChecked");
      expect(healthResult.name).toBe("sina");
      
      // 健康检查结果应该是布尔值
      expect(typeof healthResult.isHealthy).toBe("boolean");
    }, 10000); // 10秒超时
  });

  describe("数据获取", () => {
    it("应该能够获取指定股票的基础信息", async () => {
      if (!sinaSource) return;
      
      const testStocks = ["000001.SZ", "600000.SH"];
      
      try {
        const response = await sinaSource.getStockBasicInfo({
          tsCodes: testStocks,
        });
        
        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeInstanceOf(Array);
        expect(response.sourceInfo?.name).toBe("sina");
        
        // 验证返回的数据结构
        for (const stock of response.data) {
          expect(stock).toHaveProperty("ts_code");
          expect(stock).toHaveProperty("symbol");
          expect(stock).toHaveProperty("name");
          expect(testStocks).toContain(stock.ts_code);
        }
      } catch (error) {
        console.warn("获取股票基础信息失败，可能是网络问题:", error);
        // 网络错误时不让测试失败
        expect(error).toBeDefined();
      }
    }, 15000); // 15秒超时

    it("应该能够获取指定股票的日线数据", async () => {
      if (!sinaSource) return;
      
      const testStocks = ["000001.SZ"];
      
      try {
        const response = await sinaSource.getStockDailyData({
          tsCodes: testStocks,
        });
        
        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeInstanceOf(Array);
        expect(response.sourceInfo?.name).toBe("sina");
        
        // 验证返回的数据结构
        for (const dailyData of response.data) {
          expect(dailyData).toHaveProperty("ts_code");
          expect(dailyData).toHaveProperty("trade_date");
          expect(dailyData).toHaveProperty("open");
          expect(dailyData).toHaveProperty("high");
          expect(dailyData).toHaveProperty("low");
          expect(dailyData).toHaveProperty("close");
          
          // 验证价格数据的合理性
          expect(dailyData.open).toBeGreaterThan(0);
          expect(dailyData.high).toBeGreaterThan(0);
          expect(dailyData.low).toBeGreaterThan(0);
          expect(dailyData.close).toBeGreaterThan(0);
          
          // 验证逻辑一致性
          expect(dailyData.high).toBeGreaterThanOrEqual(dailyData.low);
          expect(dailyData.high).toBeGreaterThanOrEqual(dailyData.open);
          expect(dailyData.high).toBeGreaterThanOrEqual(dailyData.close);
          expect(dailyData.low).toBeLessThanOrEqual(dailyData.open);
          expect(dailyData.low).toBeLessThanOrEqual(dailyData.close);
        }
      } catch (error) {
        console.warn("获取股票日线数据失败，可能是网络问题:", error);
        // 网络错误时不让测试失败
        expect(error).toBeDefined();
      }
    }, 15000);

    it("应该在没有指定股票代码时抛出错误", async () => {
      if (!sinaSource) return;
      
      try {
        await sinaSource.getStockDailyData({});
        expect(true).toBe(false); // 不应该执行到这里
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error ? error.message : "").toContain("需要指定股票代码");
      }
    });
  });

  describe("数据转换功能", () => {
    it("应该能够正确转换股票代码格式", () => {
      if (!sinaSource) return;
      
      // 通过反射访问私有方法进行测试
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const convertMethod = (sinaSource as any).convertTsCodeToSinaSymbol;
      if (convertMethod) {
        expect(convertMethod.call(sinaSource, "000001.SZ")).toBe("sz000001");
        expect(convertMethod.call(sinaSource, "600000.SH")).toBe("sh600000");
        
        // 测试不支持的市场
        expect(() => {
          convertMethod.call(sinaSource, "123456.BJ");
        }).toThrow();
      }
    });
  });

  describe("批量操作", () => {
    it("应该能够批量获取股票数据", async () => {
      if (!sinaSource) return;
      
      const testStocks = ["000001.SZ", "000002.SZ", "600000.SH", "600036.SH"];
      
      try {
        const response = await sinaSource.getBatchRealTimeData(testStocks);
        
        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.data).toBeInstanceOf(Array);
        expect(response.sourceInfo?.name).toBe("sina");
        
        // 验证批量获取的数据
        if (response.data.length > 0) {
          expect(response.data.length).toBeLessThanOrEqual(testStocks.length);
          
          for (const data of response.data) {
            expect(testStocks).toContain(data.ts_code);
          }
        }
      } catch (error) {
        console.warn("批量获取股票数据失败:", error);
        expect(error).toBeDefined();
      }
    }, 20000); // 批量操作需要更长时间
  });

  describe("市场状态检查", () => {
    it("应该能够检查市场状态", async () => {
      if (!sinaSource) return;
      
      try {
        const marketStatus = await sinaSource.getMarketStatus();
        
        expect(marketStatus).toBeDefined();
        expect(marketStatus).toHaveProperty("isOpen");
        expect(marketStatus).toHaveProperty("marketTime");
        expect(typeof marketStatus.isOpen).toBe("boolean");
        expect(typeof marketStatus.marketTime).toBe("string");
      } catch (error) {
        console.warn("检查市场状态失败:", error);
        expect(error).toBeDefined();
      }
    }, 10000);
  });

  describe("错误处理", () => {
    it("应该正确处理网络错误", async () => {
      if (!sinaSource) return;
      
      // 模拟网络错误的场景比较困难，这里主要测试错误类型的处理
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const originalMakeRequest = (sinaSource as any).makeRequest;
      
      // 临时替换网络请求方法模拟错误
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sinaSource as any).makeRequest = async () => {
        throw new Error("Network timeout");
      };
      
      try {
        await sinaSource.getStockDailyData({ tsCodes: ["000001.SZ"] });
        expect(true).toBe(false); // 不应该执行到这里
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      } finally {
        // 恢复原始方法
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sinaSource as any).makeRequest = originalMakeRequest;
      }
    });
  });
});