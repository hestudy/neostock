import { describe, test, expect, beforeEach } from "vitest";
import type { StockBasicInfo, StockDailyData } from "../../../types/data-sources";
import { 
  CrossDataSourceValidator, 
  type DataSourceSample 
} from "../../../lib/validators/cross-datasource-validator";

describe("跨数据源一致性验证测试", () => {
  let validator: CrossDataSourceValidator;

  beforeEach(() => {
    validator = new CrossDataSourceValidator();
  });

  describe("基础信息一致性验证", () => {
    test("相同的基础信息应该通过一致性验证", () => {
      const basicInfo: StockBasicInfo = {
        ts_code: "000001.SZ",
        symbol: "000001",
        name: "平安银行",
        area: "深圳",
        industry: "银行",
        market: "主板",
        list_date: "19910403",
        is_hs: "1",
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "tushare",
          basicInfo,
          timestamp: new Date(),
        },
        {
          sourceName: "sina",
          basicInfo: { ...basicInfo }, // 完全相同
          timestamp: new Date(),
        },
      ];

      const result = validator.validateBasicInfoConsistency(samples);

      expect(result.isConsistent).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.details.basicInfoConsistency.isConsistent).toBe(true);
      expect(result.details.basicInfoConsistency.inconsistentFields).toHaveLength(0);
    });

    test("不同的基础信息应该被识别为不一致", () => {
      const tushareInfo: StockBasicInfo = {
        ts_code: "000001.SZ",
        symbol: "000001",
        name: "平安银行",
        area: "深圳",
        industry: "银行",
        market: "主板",
        list_date: "19910403",
        is_hs: "1",
      };

      const sinaInfo: StockBasicInfo = {
        ts_code: "000001.SZ",
        symbol: "000001",
        name: "平安银行股份有限公司", // 名称不同
        area: "深圳",
        industry: "金融", // 行业分类不同
        market: "主板",
        list_date: "19910403",
        is_hs: "1",
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "tushare",
          basicInfo: tushareInfo,
          timestamp: new Date(),
        },
        {
          sourceName: "sina",
          basicInfo: sinaInfo,
          timestamp: new Date(),
        },
      ];

      const result = validator.validateBasicInfoConsistency(samples);

      expect(result.isConsistent).toBe(false);
      expect(result.details.basicInfoConsistency.isConsistent).toBe(false);
      expect(result.details.basicInfoConsistency.inconsistentFields).toContain("name");
      expect(result.details.basicInfoConsistency.inconsistentFields).toContain("industry");
    });

    test("应该正确识别关键字段的不一致", () => {
      const baseInfo: StockBasicInfo = {
        ts_code: "000001.SZ",
        symbol: "000001",
        name: "平安银行",
        area: "深圳",
        industry: "银行",
        market: "主板",
        list_date: "19910403",
        is_hs: "1",
      };

      const inconsistentInfo: StockBasicInfo = {
        ...baseInfo,
        ts_code: "000002.SZ", // 股票代码不同 - 这是严重问题
        list_date: "19910404", // 上市日期不同
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "source1",
          basicInfo: baseInfo,
          timestamp: new Date(),
        },
        {
          sourceName: "source2",
          basicInfo: inconsistentInfo,
          timestamp: new Date(),
        },
      ];

      const result = validator.validateBasicInfoConsistency(samples);

      expect(result.isConsistent).toBe(false);
      expect(result.details.basicInfoConsistency.inconsistentFields).toContain("ts_code");
      expect(result.details.basicInfoConsistency.inconsistentFields).toContain("list_date");
    });
  });

  describe("日线数据一致性验证", () => {
    test("相似的价格数据应该通过一致性验证", () => {
      const baseDailyData: StockDailyData = {
        ts_code: "000001.SZ",
        trade_date: "20231201",
        open: 10.50,
        high: 11.20,
        low: 10.30,
        close: 11.00,
        vol: 1000000,
        amount: 10500000,
      };

      const similarDailyData: StockDailyData = {
        ...baseDailyData,
        open: 10.52, // 0.19% 差异 (在5%阈值内)
        high: 11.22, // 0.18% 差异
        low: 10.32, // 0.19% 差异
        close: 11.02, // 0.18% 差异
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "tushare",
          dailyData: baseDailyData,
          timestamp: new Date(),
        },
        {
          sourceName: "sina",
          dailyData: similarDailyData,
          timestamp: new Date(),
        },
      ];

      const result = validator.validateDailyDataConsistency(samples);

      expect(result.isConsistent).toBe(true);
      expect(result.details.priceConsistency.isConsistent).toBe(true);
      expect(result.details.priceConsistency.maxPriceDeviation).toBeLessThan(5); // 小于5%阈值
    });

    test("价格差异过大应该被识别为不一致", () => {
      const baseDailyData: StockDailyData = {
        ts_code: "000001.SZ",
        trade_date: "20231201",
        open: 10.00,
        high: 11.00,
        low: 9.50,
        close: 10.80,
        vol: 1000000,
        amount: 10500000,
      };

      const inconsistentDailyData: StockDailyData = {
        ...baseDailyData,
        open: 12.00, // 20% 差异 (超过5%阈值)
        high: 13.50, // 22.7% 差异
        low: 11.00, // 15.8% 差异
        close: 12.50, // 15.7% 差异
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "tushare",
          dailyData: baseDailyData,
          timestamp: new Date(),
        },
        {
          sourceName: "sina",
          dailyData: inconsistentDailyData,
          timestamp: new Date(),
        },
      ];

      const result = validator.validateDailyDataConsistency(samples);

      expect(result.isConsistent).toBe(false);
      expect(result.details.priceConsistency.isConsistent).toBe(false);
      expect(result.details.priceConsistency.maxPriceDeviation).toBeGreaterThan(5);
      expect(result.issues.length).toBeGreaterThan(0);

      // 检查具体的错误消息
      const priceIssues = result.issues.filter(issue => 
        issue.message.includes("价格一致性问题")
      );
      expect(priceIssues.length).toBeGreaterThan(0);
    });

    test("成交量差异过大应该被识别为不一致", () => {
      const baseDailyData: StockDailyData = {
        ts_code: "000001.SZ",
        trade_date: "20231201",
        open: 10.50,
        high: 11.20,
        low: 10.30,
        close: 11.00,
        vol: 1000000,
        amount: 10500000,
      };

      const inconsistentVolumeData: StockDailyData = {
        ...baseDailyData,
        vol: 2000000, // 100% 差异 (超过10%阈值)
        amount: 22000000, // 109% 差异 (但成交额在容忍字段中)
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "tushare",
          dailyData: baseDailyData,
          timestamp: new Date(),
        },
        {
          sourceName: "sina",
          dailyData: inconsistentVolumeData,
          timestamp: new Date(),
        },
      ];

      const result = validator.validateDailyDataConsistency(samples);

      expect(result.isConsistent).toBe(false);
      expect(result.details.volumeConsistency.isConsistent).toBe(false);
      expect(result.details.volumeConsistency.maxVolumeDeviation).toBeGreaterThan(10);

      // 成交量问题应该被识别
      const volumeIssues = result.issues.filter(issue => 
        issue.message.includes("成交量一致性问题")
      );
      expect(volumeIssues.length).toBeGreaterThan(0);
    });

    test("应该处理缺失数据的情况", () => {
      const completeData: StockDailyData = {
        ts_code: "000001.SZ",
        trade_date: "20231201",
        open: 10.50,
        high: 11.20,
        low: 10.30,
        close: 11.00,
        vol: 1000000,
        amount: 10500000,
      };

      const incompleteData: StockDailyData = {
        ts_code: "000001.SZ",
        trade_date: "20231201",
        open: 10.52,
        high: 11.22,
        low: 10.32,
        close: 11.02,
        // vol 和 amount 缺失
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "tushare",
          dailyData: completeData,
          timestamp: new Date(),
        },
        {
          sourceName: "sina",
          dailyData: incompleteData,
          timestamp: new Date(),
        },
      ];

      const result = validator.validateDailyDataConsistency(samples);

      // 价格应该仍然能够比较
      expect(result.details.priceConsistency.isConsistent).toBe(true);
      
      // 成交量由于数据不足应该不会报告不一致
      expect(result.details.volumeConsistency.isConsistent).toBe(true);
    });
  });

  describe("综合一致性验证", () => {
    test("同时验证基础信息和日线数据", () => {
      const basicInfo: StockBasicInfo = {
        ts_code: "000001.SZ",
        symbol: "000001",
        name: "平安银行",
        area: "深圳",
        industry: "银行",
        market: "主板",
        list_date: "19910403",
        is_hs: "1",
      };

      const dailyData: StockDailyData = {
        ts_code: "000001.SZ",
        trade_date: "20231201",
        open: 10.50,
        high: 11.20,
        low: 10.30,
        close: 11.00,
        vol: 1000000,
        amount: 10500000,
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "tushare",
          basicInfo,
          dailyData,
          timestamp: new Date(),
        },
        {
          sourceName: "sina",
          basicInfo: { ...basicInfo },
          dailyData: { ...dailyData },
          timestamp: new Date(),
        },
      ];

      const result = validator.validateComprehensiveConsistency(samples);

      expect(result.isConsistent).toBe(true);
      expect(result.details.basicInfoConsistency.isConsistent).toBe(true);
      expect(result.details.priceConsistency.isConsistent).toBe(true);
      expect(result.details.volumeConsistency.isConsistent).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test("多个方面的不一致都应该被识别", () => {
      const tushareBasicInfo: StockBasicInfo = {
        ts_code: "000001.SZ",
        symbol: "000001",
        name: "平安银行",
        area: "深圳",
        industry: "银行",
        market: "主板",
        list_date: "19910403",
        is_hs: "1",
      };

      const sinaBasicInfo: StockBasicInfo = {
        ...tushareBasicInfo,
        name: "平安银行股份", // 名称不一致
        industry: "金融服务", // 行业不一致
      };

      const tushareDailyData: StockDailyData = {
        ts_code: "000001.SZ",
        trade_date: "20231201",
        open: 10.00,
        high: 11.00,
        low: 9.50,
        close: 10.80,
        vol: 1000000,
        amount: 10500000,
      };

      const sinaDailyData: StockDailyData = {
        ...tushareDailyData,
        open: 12.00, // 价格差异过大
        high: 13.00,
        vol: 2500000, // 成交量差异过大
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "tushare",
          basicInfo: tushareBasicInfo,
          dailyData: tushareDailyData,
          timestamp: new Date(),
        },
        {
          sourceName: "sina",
          basicInfo: sinaBasicInfo,
          dailyData: sinaDailyData,
          timestamp: new Date(),
        },
      ];

      const result = validator.validateComprehensiveConsistency(samples);

      expect(result.isConsistent).toBe(false);
      
      // 基础信息不一致
      expect(result.details.basicInfoConsistency.isConsistent).toBe(false);
      expect(result.details.basicInfoConsistency.inconsistentFields).toContain("name");
      expect(result.details.basicInfoConsistency.inconsistentFields).toContain("industry");
      
      // 价格不一致
      expect(result.details.priceConsistency.isConsistent).toBe(false);
      
      // 成交量不一致
      expect(result.details.volumeConsistency.isConsistent).toBe(false);
      
      // 应该有多个问题
      expect(result.issues.length).toBeGreaterThan(2);
    });
  });

  describe("配置和阈值管理", () => {
    test("应该能够调整价格偏差阈值", () => {
      const customValidator = new CrossDataSourceValidator({
        priceDeviationThreshold: 1.0, // 更严格的1%阈值
      });

      const baseDailyData: StockDailyData = {
        ts_code: "000001.SZ",
        trade_date: "20231201",
        open: 10.00,
        high: 11.00,
        low: 9.50,
        close: 10.80,
        vol: 1000000,
        amount: 10500000,
      };

      const slightlyDifferentData: StockDailyData = {
        ...baseDailyData,
        open: 10.15, // 1.5% 差异，在默认5%阈值内，但超过自定义1%阈值
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "source1",
          dailyData: baseDailyData,
          timestamp: new Date(),
        },
        {
          sourceName: "source2",
          dailyData: slightlyDifferentData,
          timestamp: new Date(),
        },
      ];

      const result = customValidator.validateDailyDataConsistency(samples);

      expect(result.isConsistent).toBe(false);
      expect(result.details.priceConsistency.isConsistent).toBe(false);
    });

    test("应该能够设置容忍字段", () => {
      const customValidator = new CrossDataSourceValidator({
        tolerantFields: ['name', 'industry'], // 容忍名称和行业差异
      });

      const baseInfo: StockBasicInfo = {
        ts_code: "000001.SZ",
        symbol: "000001",
        name: "平安银行",
        area: "深圳",
        industry: "银行",
        market: "主板",
        list_date: "19910403",
        is_hs: "1",
      };

      const differentNameInfo: StockBasicInfo = {
        ...baseInfo,
        name: "平安银行股份有限公司", // 不同的名称
        industry: "金融服务", // 不同的行业
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "source1",
          basicInfo: baseInfo,
          timestamp: new Date(),
        },
        {
          sourceName: "source2",
          basicInfo: differentNameInfo,
          timestamp: new Date(),
        },
      ];

      const result = customValidator.validateBasicInfoConsistency(samples);

      // 由于设置了容忍字段，应该通过验证
      expect(result.isConsistent).toBe(true);
      expect(result.details.basicInfoConsistency.isConsistent).toBe(true);
    });

    test("应该能够更新和获取配置", () => {
      const config = validator.getConfig();
      expect(config.priceDeviationThreshold).toBe(5.0);
      expect(config.volumeDeviationThreshold).toBe(10.0);

      validator.updateConfig({
        priceDeviationThreshold: 3.0,
        volumeDeviationThreshold: 8.0,
      });

      const updatedConfig = validator.getConfig();
      expect(updatedConfig.priceDeviationThreshold).toBe(3.0);
      expect(updatedConfig.volumeDeviationThreshold).toBe(8.0);
      expect(updatedConfig.requireExactMatch).toEqual(['ts_code', 'trade_date', 'name']); // 其他配置保持不变
    });
  });

  describe("边界条件和错误处理", () => {
    test("单个数据源样本应该抛出错误", () => {
      const samples: DataSourceSample[] = [
        {
          sourceName: "only_one",
          basicInfo: {
            ts_code: "000001.SZ",
            symbol: "000001",
            name: "平安银行",
            area: "深圳",
            industry: "银行",
            market: "主板",
            list_date: "19910403",
            is_hs: "1",
          },
          timestamp: new Date(),
        },
      ];

      expect(() => {
        validator.validateBasicInfoConsistency(samples);
      }).toThrow("需要至少两个数据源样本进行一致性验证");
    });

    test("空样本数组应该抛出错误", () => {
      expect(() => {
        validator.validateBasicInfoConsistency([]);
      }).toThrow("需要至少两个数据源样本进行一致性验证");
    });

    test("处理空值和undefined值", () => {
      const baseData: StockDailyData = {
        ts_code: "000001.SZ",
        trade_date: "20231201",
        open: 10.00,
        high: 11.00,
        low: 9.50,
        close: 10.80,
        vol: 1000000,
        // amount 未定义
      };

      const nullData: StockDailyData = {
        ts_code: "000001.SZ",
        trade_date: "20231201",
        open: 10.05,
        high: 11.05,
        low: 9.55,
        close: 10.85,
        // vol 未定义
        amount: 11000000,
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "source1",
          dailyData: baseData,
          timestamp: new Date(),
        },
        {
          sourceName: "source2",
          dailyData: nullData,
          timestamp: new Date(),
        },
      ];

      // 应该能处理部分数据缺失的情况，不抛出错误
      expect(() => {
        validator.validateDailyDataConsistency(samples);
      }).not.toThrow();
    });

    test("验证结果应该包含正确的元信息", () => {
      const basicInfo: StockBasicInfo = {
        ts_code: "000001.SZ",
        symbol: "000001",
        name: "平安银行",
        area: "深圳",
        industry: "银行",
        market: "主板",
        list_date: "19910403",
        is_hs: "1",
      };

      const samples: DataSourceSample[] = [
        {
          sourceName: "tushare",
          basicInfo,
          timestamp: new Date(),
        },
        {
          sourceName: "sina",
          basicInfo: { ...basicInfo },
          timestamp: new Date(),
        },
      ];

      const result = validator.validateBasicInfoConsistency(samples);

      expect(result.stockCode).toBe("000001.SZ");
      expect(result.sources).toEqual(["tushare", "sina"]);
      expect(result.validationTimestamp).toBeInstanceOf(Date);
      expect(result.details).toBeDefined();
    });
  });
});