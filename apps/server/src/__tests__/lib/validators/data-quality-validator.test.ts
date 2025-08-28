import { describe, it, expect, beforeEach } from 'vitest';
import { DataQualityValidator } from '../../../lib/validators/data-quality-validator';
import type { StockBasicInfo, StockDailyData } from '../../../types/data-sources';
import { DataQualityIssueType } from '../../../types/data-sources';

describe('DataQualityValidator', () => {
  let validator: DataQualityValidator;

  beforeEach(() => {
    validator = new DataQualityValidator();
  });

  describe('股票基础信息数据质量验证', () => {
    it('应该通过有效的基础信息验证', () => {
      const validBasicInfo: StockBasicInfo = {
        ts_code: '000001.SZ',
        symbol: '000001',
        name: '平安银行',
        area: '深圳',
        industry: '银行',
        market: '深市',
        list_date: '1991-04-03',
        is_hs: 'S',
      };

      const result = validator.validateBasicInfo(validBasicInfo);

      expect(result.isValid).toBe(true);
      expect(result.qualityScore).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.details.formatValidation.isValid).toBe(true);
      expect(result.details.rangeValidation.isValid).toBe(true);
      expect(result.details.logicalValidation.isValid).toBe(true);
    });

    it('应该检测股票代码格式错误', () => {
      const invalidBasicInfo: StockBasicInfo = {
        ts_code: 'INVALID_CODE', // 错误格式
        symbol: '000001',
        name: '平安银行',
        area: '深圳',
        industry: '银行',
        market: '深市',
        list_date: '1991-04-03',
        is_hs: 'S',
      };

      const result = validator.validateBasicInfo(invalidBasicInfo);

      expect(result.isValid).toBe(false);
      expect(result.qualityScore).toBeLessThan(100);
      expect(result.issues.some(issue => 
        issue.type === DataQualityIssueType.INVALID_FORMAT &&
        issue.message.includes('ts_code')
      )).toBe(true);
    });

    it('应该检测缺失必填字段', () => {
      const incompleteBasicInfo = {
        // 缺少 ts_code, symbol, name
        area: '深圳',
        industry: '银行',
      } as StockBasicInfo;

      const result = validator.validateBasicInfo(incompleteBasicInfo);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => 
        issue.message.includes('必填字段缺失')
      )).toBe(true);
    });

    it('应该检测日期格式错误', () => {
      const invalidDateBasicInfo: StockBasicInfo = {
        ts_code: '000001.SZ',
        symbol: '000001',
        name: '平安银行',
        area: '深圳',
        industry: '银行',
        market: '深市',
        list_date: '1991/04/03', // 错误的日期格式
        is_hs: 'S',
      };

      const result = validator.validateBasicInfo(invalidDateBasicInfo);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => 
        issue.message.includes('list_date')
      )).toBe(true);
    });

    it('应该检测未来上市日期逻辑错误', () => {
      const futureListDate = new Date();
      futureListDate.setFullYear(futureListDate.getFullYear() + 1);
      
      const invalidLogicBasicInfo: StockBasicInfo = {
        ts_code: '000001.SZ',
        symbol: '000001',
        name: '平安银行',
        area: '深圳',
        industry: '银行',
        market: '深市',
        list_date: futureListDate.toISOString().split('T')[0],
        is_hs: 'S',
      };

      const result = validator.validateBasicInfo(invalidLogicBasicInfo);

      expect(result.isValid).toBe(false);
      expect(result.details.logicalValidation.inconsistencies.some(inc =>
        inc.includes('上市日期不能晚于当前日期')
      )).toBe(true);
    });
  });

  describe('股票日线数据质量验证', () => {
    it('应该通过有效的日线数据验证', () => {
      const validDailyData: StockDailyData = {
        ts_code: '000001.SZ',
        trade_date: '2024-01-15',
        open: 10.50,
        high: 11.00,
        low: 10.20,
        close: 10.80,
        vol: 1000000,
        amount: 10800000,
      };

      const result = validator.validateDailyData(validDailyData);

      expect(result.isValid).toBe(true);
      expect(result.qualityScore).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.details.formatValidation.isValid).toBe(true);
      expect(result.details.rangeValidation.isValid).toBe(true);
      expect(result.details.logicalValidation.isValid).toBe(true);
    });

    it('应该检测价格范围错误', () => {
      const invalidPriceData: StockDailyData = {
        ts_code: '000001.SZ',
        trade_date: '2024-01-15',
        open: 0, // 价格为0，异常
        high: 11.00,
        low: 10.20,
        close: 10.80,
        vol: 1000000,
        amount: 10800000,
      };

      const result = validator.validateDailyData(invalidPriceData);

      expect(result.isValid).toBe(false);
      expect(result.details.logicalValidation.inconsistencies.some(inc =>
        inc.includes('价格为0或负数')
      )).toBe(true);
    });

    it('应该检测价格逻辑不一致', () => {
      const logicallyInconsistentData: StockDailyData = {
        ts_code: '000001.SZ',
        trade_date: '2024-01-15',
        open: 10.50,
        high: 10.00, // 最高价小于开盘价，逻辑错误
        low: 10.20,
        close: 10.80,
        vol: 1000000,
        amount: 10800000,
      };

      const result = validator.validateDailyData(logicallyInconsistentData);

      expect(result.isValid).toBe(false);
      expect(result.details.logicalValidation.inconsistencies.some(inc =>
        inc.includes('最高价') && inc.includes('小于')
      )).toBe(true);
    });

    it('应该检测涨跌幅计算不一致', () => {
      const inconsistentPctChgData: StockDailyData = {
        ts_code: '000001.SZ',
        trade_date: '2024-01-15',
        open: 10.50,
        high: 11.00,
        low: 10.20,
        close: 10.80,
        vol: 1000000,
        amount: 10800000,
      };

      const result = validator.validateDailyData(inconsistentPctChgData);

      expect(result.isValid).toBe(true); // 逻辑验证通过，但有警告
      expect(result.details.logicalValidation.warnings.some(warning =>
        warning.includes('涨跌幅') && warning.includes('差异较大')
      )).toBe(true);
    });

    it('应该检测缺失必填字段', () => {
      const incompleteDailyData = {
        ts_code: '000001.SZ',
        trade_date: '2024-01-15',
        // 缺少 open, high, low, close
        vol: 1000000,
        amount: 10800000,
      } as StockDailyData;

      const result = validator.validateDailyData(incompleteDailyData);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue =>
        issue.message.includes('必填字段缺失')
      )).toBe(true);
    });

    it('应该检测极端价格范围', () => {
      const extremePriceData: StockDailyData = {
        ts_code: '000001.SZ',
        trade_date: '2024-01-15',
        open: 15000, // 超出合理价格范围
        high: 15000,
        low: 15000,
        close: 15000,
        vol: 1000000,
        amount: 15000000000,
      };

      const result = validator.validateDailyData(extremePriceData);

      expect(result.isValid).toBe(false);
      expect(result.details.rangeValidation.outOfRangeFields.some(field =>
        field.includes('价格') && field.includes('超出合理范围')
      )).toBe(true);
    });

    it('应该处理异常涨跌幅情况', () => {
      const extremeChangeData: StockDailyData = {
        ts_code: '000001.SZ',
        trade_date: '2024-01-15',
        open: 10.00,
        high: 15.00,
        low: 10.00,
        close: 15.00,
        vol: 1000000,
        amount: 12500000,
      };

      const result = validator.validateDailyData(extremeChangeData);

      expect(result.details.rangeValidation.warnings.some(warning =>
        warning.includes('涨跌幅') && warning.includes('超过正常范围')
      )).toBe(true);
    });
  });

  describe('批量数据验证', () => {
    it('应该正确处理批量数据验证', () => {
      const batchData = [
        {
          ts_code: '000001.SZ',
          symbol: '000001',
          name: '平安银行',
          area: '深圳',
          industry: '银行',
          market: '深市',
          list_date: '1991-04-03',
          is_hs: 'S',
        } as StockBasicInfo,
        {
          ts_code: '000001.SZ',
          trade_date: '2024-01-15',
          open: 10.50,
          high: 11.00,
          low: 10.20,
          close: 10.80,
          vol: 1000000,
          amount: 10800000,
        } as StockDailyData,
        {
          // 无效数据
          ts_code: 'INVALID',
          symbol: '000002',
          name: '',
        } as StockBasicInfo,
      ];

      const result = validator.validateBatch(batchData);

      expect(result.results).toHaveLength(3);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(1);
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThan(100);
      expect(result.summary.commonIssues).toBeDefined();
      expect(result.summary.averageScore).toBeDefined();
    });

    it('应该统计常见问题', () => {
      const batchData = [
        { ts_code: 'INVALID1' } as StockBasicInfo,
        { ts_code: 'INVALID2' } as StockBasicInfo,
        { ts_code: 'INVALID3' } as StockBasicInfo,
      ];

      const result = validator.validateBatch(batchData);

      expect(result.summary.commonIssues.length).toBeGreaterThan(0);
      expect(result.summary.commonIssues[0].count).toBe(3); // 所有数据都有相同问题
    });
  });

  describe('配置管理', () => {
    it('应该允许更新验证配置', () => {
      const newConfig = {
        priceRange: { min: 1.0, max: 500.0 },
        priceDeviationThreshold: 3.0,
      };

      validator.updateConfig(newConfig);
      const config = validator.getConfig();

      expect(config.priceRange.min).toBe(1.0);
      expect(config.priceRange.max).toBe(500.0);
    });

    it('应该保持其他配置不变', () => {
      const originalConfig = validator.getConfig();
      const originalPattern = originalConfig.stockCodePattern;

      validator.updateConfig({ priceRange: { min: 1.0, max: 500.0 } });
      const newConfig = validator.getConfig();

      expect(newConfig.stockCodePattern).toBe(originalPattern);
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理null和undefined值', () => {
      const dataWithNulls = {
        ts_code: null,
        symbol: undefined,
        name: '测试股票',
      } as unknown as StockBasicInfo;

      const result = validator.validateBasicInfo(dataWithNulls);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('应该处理空字符串', () => {
      const dataWithEmptyStrings: StockBasicInfo = {
        ts_code: '',
        symbol: '',
        name: '',
        area: '深圳',
        industry: '银行',
        market: '深市',
        list_date: '1991-04-03',
        is_hs: 'S',
      };

      const result = validator.validateBasicInfo(dataWithEmptyStrings);

      expect(result.isValid).toBe(false);
    });

    it('应该处理数值类型错误', () => {
      const dataWithStringNumbers = {
        ts_code: '000001.SZ',
        trade_date: '2024-01-15',
        open: '10.50', // 字符串而不是数字
        high: '11.00',
        low: '10.20',
        close: '10.80',
      } as unknown as StockDailyData;

      // 这种情况下验证器应该能正常处理类型转换或检测类型错误
      const result = validator.validateDailyData(dataWithStringNumbers);
      expect(result).toBeDefined();
    });
  });

  describe('质量评分系统', () => {
    it('应该为完全有效的数据给出100分', () => {
      const perfectData: StockBasicInfo = {
        ts_code: '000001.SZ',
        symbol: '000001',
        name: '平安银行',
        area: '深圳',
        industry: '银行',
        market: '深市',
        list_date: '1991-04-03',
        is_hs: 'S',
      };

      const result = validator.validateBasicInfo(perfectData);
      expect(result.qualityScore).toBe(100);
    });

    it('应该根据问题严重程度递减分数', () => {
      const dataWithFormatIssue: StockBasicInfo = {
        ts_code: 'INVALID_FORMAT',
        symbol: '000001',
        name: '测试股票',
        area: '深圳',
        industry: '银行',
        market: '深市',
        list_date: '1991-04-03',
        is_hs: 'S',
      };

      const result = validator.validateBasicInfo(dataWithFormatIssue);
      expect(result.qualityScore).toBeLessThan(100);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    });

    it('应该确保质量分数不低于0', () => {
      const terribleData = {
        ts_code: 'INVALID',
        // 缺少所有必填字段
      } as StockBasicInfo;

      const result = validator.validateBasicInfo(terribleData);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('数据清洗场景', () => {
    it('应该识别需要清洗的异常数据', () => {
      const messyData: StockDailyData = {
        ts_code: '000001.SZ',
        trade_date: '2024-01-15',
        open: 0.01, // 可能是异常的极小价格
        high: 999999, // 明显异常的极大价格
        low: -1, // 负价格
        close: 10.80,
        vol: -100, // 负成交量
        amount: 10800000,
      };

      const result = validator.validateDailyData(messyData);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThan(50); // 严重问题应该大幅降低质量分数
    });
  });
});