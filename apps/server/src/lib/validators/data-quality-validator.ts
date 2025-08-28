import type { StockBasicInfo, StockDailyData, DataQualityIssue } from "../../types/data-sources";
import { DataQualityIssueType } from "../../types/data-sources";

// 数据质量验证配置
export interface DataQualityConfig {
  // 股票代码格式验证
  stockCodePattern: RegExp;
  // 价格范围验证
  priceRange: {
    min: number;
    max: number;
  };
  // 日期格式验证
  dateFormat: RegExp;
  // 成交量范围验证
  volumeRange: {
    min: number;
    max: number;
  };
  // 逻辑一致性检查
  enableLogicalConsistency: boolean;
}

// 数据质量验证结果
export interface DataQualityValidationResult {
  isValid: boolean;
  qualityScore: number; // 0-100 分
  issues: DataQualityIssue[];
  validationTimestamp: Date;
  details: {
    formatValidation: FormatValidationResult;
    rangeValidation: RangeValidationResult;
    logicalValidation: LogicalValidationResult;
  };
}

// 格式验证结果
export interface FormatValidationResult {
  isValid: boolean;
  passedChecks: string[];
  failedChecks: string[];
}

// 范围验证结果
export interface RangeValidationResult {
  isValid: boolean;
  outOfRangeFields: string[];
  warnings: string[];
}

// 逻辑验证结果
export interface LogicalValidationResult {
  isValid: boolean;
  inconsistencies: string[];
  warnings: string[];
}

export class DataQualityValidator {
  private config: DataQualityConfig;

  constructor(config?: Partial<DataQualityConfig>) {
    this.config = {
      stockCodePattern: /^\d{6}\.(SH|SZ)$/,
      priceRange: { min: 0.01, max: 10000 },
      dateFormat: /^\d{4}-\d{2}-\d{2}$/,
      volumeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
      enableLogicalConsistency: true,
      ...config,
    };
  }

  /**
   * 验证股票基础信息数据质量
   */
  validateBasicInfo(data: StockBasicInfo): DataQualityValidationResult {
    const issues: DataQualityIssue[] = [];
    let qualityScore = 100;

    // 格式验证
    const formatResult = this.validateBasicInfoFormat(data);
    if (!formatResult.isValid) {
      qualityScore -= 30;
      issues.push(...formatResult.failedChecks.map(check => ({
        type: DataQualityIssueType.INVALID_FORMAT,
        severity: 'high' as const,
        message: `基础信息格式错误: ${check}`,
        affectedFields: [check.split(':')[0]],
        affectedRecords: 1,
      })));
    }

    // 范围验证（基础信息主要是必填字段检查）
    const rangeResult = this.validateBasicInfoRange(data);
    if (!rangeResult.isValid) {
      qualityScore -= 20;
      issues.push(...rangeResult.outOfRangeFields.map(field => ({
        type: DataQualityIssueType.OUT_OF_RANGE,
        severity: 'medium' as const,
        message: `基础信息字段缺失或无效: ${field}`,
        affectedFields: [field],
        affectedRecords: 1,
      })));
    }

    // 逻辑验证
    const logicalResult = this.validateBasicInfoLogic(data);
    if (!logicalResult.isValid) {
      qualityScore -= 15;
      issues.push(...logicalResult.inconsistencies.map(inconsistency => ({
        type: DataQualityIssueType.INCONSISTENT_DATA,
        severity: 'medium' as const,
        message: `基础信息逻辑不一致: ${inconsistency}`,
        affectedRecords: 1,
      })));
    }

    const isValid = formatResult.isValid && rangeResult.isValid && logicalResult.isValid;

    return {
      isValid,
      qualityScore: Math.max(0, qualityScore),
      issues,
      validationTimestamp: new Date(),
      details: {
        formatValidation: formatResult,
        rangeValidation: rangeResult,
        logicalValidation: logicalResult,
      },
    };
  }

  /**
   * 验证股票日线数据质量
   */
  validateDailyData(data: StockDailyData): DataQualityValidationResult {
    const issues: DataQualityIssue[] = [];
    let qualityScore = 100;

    // 格式验证
    const formatResult = this.validateDailyDataFormat(data);
    if (!formatResult.isValid) {
      qualityScore -= 30;
      issues.push(...formatResult.failedChecks.map(check => ({
        type: DataQualityIssueType.INVALID_FORMAT,
        severity: 'high' as const,
        message: `日线数据格式错误: ${check}`,
        affectedFields: [check.split(':')[0]],
        affectedRecords: 1,
      })));
    }

    // 范围验证
    const rangeResult = this.validateDailyDataRange(data);
    if (!rangeResult.isValid) {
      qualityScore -= 25;
      issues.push(...rangeResult.outOfRangeFields.map(field => ({
        type: DataQualityIssueType.OUT_OF_RANGE,
        severity: 'high' as const,
        message: `日线数据超出合理范围: ${field}`,
        affectedFields: [field],
        affectedRecords: 1,
      })));
    }

    // 逻辑验证
    const logicalResult = this.validateDailyDataLogic(data);
    if (!logicalResult.isValid) {
      qualityScore -= 20;
      issues.push(...logicalResult.inconsistencies.map(inconsistency => ({
        type: DataQualityIssueType.INCONSISTENT_DATA,
        severity: 'high' as const,
        message: `日线数据逻辑不一致: ${inconsistency}`,
        affectedRecords: 1,
      })));
    }

    const isValid = formatResult.isValid && rangeResult.isValid && logicalResult.isValid;

    return {
      isValid,
      qualityScore: Math.max(0, qualityScore),
      issues,
      validationTimestamp: new Date(),
      details: {
        formatValidation: formatResult,
        rangeValidation: rangeResult,
        logicalValidation: logicalResult,
      },
    };
  }

  /**
   * 批量验证数据质量
   */
  validateBatch(data: Array<StockBasicInfo | StockDailyData>): {
    overallScore: number;
    validCount: number;
    invalidCount: number;
    results: DataQualityValidationResult[];
    summary: {
      commonIssues: Array<{ issue: string; count: number }>;
      averageScore: number;
    };
  } {
    const results = data.map(item => {
      if ('open' in item) {
        return this.validateDailyData(item as StockDailyData);
      } else {
        return this.validateBasicInfo(item as StockBasicInfo);
      }
    });

    const validCount = results.filter(r => r.isValid).length;
    const invalidCount = results.length - validCount;
    const averageScore = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length;

    // 统计常见问题
    const issueMap = new Map<string, number>();
    results.forEach(result => {
      result.issues.forEach(issue => {
        const key = issue.message;
        issueMap.set(key, (issueMap.get(key) || 0) + 1);
      });
    });

    const commonIssues = Array.from(issueMap.entries())
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      overallScore: averageScore,
      validCount,
      invalidCount,
      results,
      summary: {
        commonIssues,
        averageScore,
      },
    };
  }

  // 私有验证方法

  private validateBasicInfoFormat(data: StockBasicInfo): FormatValidationResult {
    const passedChecks: string[] = [];
    const failedChecks: string[] = [];

    // 验证股票代码格式
    if (data.ts_code && this.config.stockCodePattern.test(data.ts_code)) {
      passedChecks.push('ts_code: 格式正确');
    } else {
      failedChecks.push('ts_code: 格式不符合 XXXXXX.SH/SZ 标准');
    }

    // 验证上市日期格式
    if (data.list_date && this.config.dateFormat.test(data.list_date)) {
      passedChecks.push('list_date: 日期格式正确');
    } else if (data.list_date) {
      failedChecks.push('list_date: 日期格式不符合 YYYY-MM-DD 标准');
    }

    // 验证必填字段
    const requiredFields = ['ts_code', 'symbol', 'name'];
    for (const field of requiredFields) {
      if (data[field as keyof StockBasicInfo]) {
        passedChecks.push(`${field}: 必填字段存在`);
      } else {
        failedChecks.push(`${field}: 必填字段缺失`);
      }
    }

    return {
      isValid: failedChecks.length === 0,
      passedChecks,
      failedChecks,
    };
  }

  private validateBasicInfoRange(data: StockBasicInfo): RangeValidationResult {
    const outOfRangeFields: string[] = [];
    const warnings: string[] = [];

    // 检查字段长度限制
    if (data.name && data.name.length > 20) {
      warnings.push('股票名称长度超过20字符，可能存在显示问题');
    }

    if (data.symbol && (data.symbol.length < 6 || data.symbol.length > 6)) {
      outOfRangeFields.push('symbol: 股票代码应为6位数字');
    }

    return {
      isValid: outOfRangeFields.length === 0,
      outOfRangeFields,
      warnings,
    };
  }

  private validateBasicInfoLogic(data: StockBasicInfo): LogicalValidationResult {
    const inconsistencies: string[] = [];
    const warnings: string[] = [];

    // 检查股票代码和市场的一致性
    if (data.ts_code && data.market) {
      const codeMarket = data.ts_code.split('.')[1];
      const expectedMarket = codeMarket === 'SH' ? '主板' : codeMarket === 'SZ' ? '深市' : '';
      
      if (expectedMarket && data.market !== expectedMarket && !data.market.includes(expectedMarket.slice(0, 1))) {
        warnings.push(`股票代码市场标识(${codeMarket})与市场字段(${data.market})可能不一致`);
      }
    }

    // 检查上市日期合理性
    if (data.list_date) {
      const listDate = new Date(data.list_date);
      const now = new Date();
      const earliestDate = new Date('1990-01-01');
      
      if (listDate > now) {
        inconsistencies.push('上市日期不能晚于当前日期');
      }
      
      if (listDate < earliestDate) {
        warnings.push('上市日期早于1990年，请确认数据准确性');
      }
    }

    return {
      isValid: inconsistencies.length === 0,
      inconsistencies,
      warnings,
    };
  }

  private validateDailyDataFormat(data: StockDailyData): FormatValidationResult {
    const passedChecks: string[] = [];
    const failedChecks: string[] = [];

    // 验证股票代码格式
    if (data.ts_code && this.config.stockCodePattern.test(data.ts_code)) {
      passedChecks.push('ts_code: 格式正确');
    } else {
      failedChecks.push('ts_code: 格式不符合 XXXXXX.SH/SZ 标准');
    }

    // 验证交易日期格式
    if (data.trade_date && this.config.dateFormat.test(data.trade_date)) {
      passedChecks.push('trade_date: 日期格式正确');
    } else {
      failedChecks.push('trade_date: 日期格式不符合 YYYY-MM-DD 标准');
    }

    // 验证必填字段
    const requiredFields = ['ts_code', 'trade_date', 'open', 'high', 'low', 'close'];
    for (const field of requiredFields) {
      if (data[field as keyof StockDailyData] != null) {
        passedChecks.push(`${field}: 必填字段存在`);
      } else {
        failedChecks.push(`${field}: 必填字段缺失`);
      }
    }

    return {
      isValid: failedChecks.length === 0,
      passedChecks,
      failedChecks,
    };
  }

  private validateDailyDataRange(data: StockDailyData): RangeValidationResult {
    const outOfRangeFields: string[] = [];
    const warnings: string[] = [];

    // 验证价格范围
    const priceFields = ['open', 'high', 'low', 'close', 'pre_close'];
    for (const field of priceFields) {
      const value = data[field as keyof StockDailyData] as number;
      if (value != null) {
        if (value < this.config.priceRange.min || value > this.config.priceRange.max) {
          outOfRangeFields.push(`${field}: 价格 ${value} 超出合理范围 [${this.config.priceRange.min}, ${this.config.priceRange.max}]`);
        }
      }
    }

    // 验证成交量范围
    if (data.vol != null) {
      if (data.vol < this.config.volumeRange.min || data.vol > this.config.volumeRange.max) {
        outOfRangeFields.push(`vol: 成交量 ${data.vol} 超出合理范围`);
      }
    }

    // 验证价格合理性（通过收盘价与开盘价的比较来估算涨跌幅）
    if (data.close != null && data.open != null && data.open > 0) {
      const changePercent = ((data.close - data.open) / data.open) * 100;
      const maxChange = 12; // 允许一定误差
      if (Math.abs(changePercent) > maxChange) {
        warnings.push(`价格波动 ${changePercent.toFixed(2)}% 超过正常范围，请确认是否为特殊情况`);
      }
    }

    return {
      isValid: outOfRangeFields.length === 0,
      outOfRangeFields,
      warnings,
    };
  }

  private validateDailyDataLogic(data: StockDailyData): LogicalValidationResult {
    const inconsistencies: string[] = [];
    const warnings: string[] = [];

    // 价格逻辑一致性验证: high >= max(open, close, low), low <= min(open, close, high)
    if (data.open != null && data.high != null && data.low != null && data.close != null) {
      if (data.high < Math.max(data.open, data.close, data.low)) {
        inconsistencies.push(`最高价 ${data.high} 小于开盘价/收盘价/最低价的最大值`);
      }

      if (data.low > Math.min(data.open, data.close, data.high)) {
        inconsistencies.push(`最低价 ${data.low} 大于开盘价/收盘价/最高价的最小值`);
      }

      // 检查价格为0的异常情况
      if (data.open <= 0 || data.high <= 0 || data.low <= 0 || data.close <= 0) {
        inconsistencies.push('存在价格为0或负数的异常情况');
      }
    }

    // 价格变化一致性检查（使用开盘价和收盘价）
    if (data.close != null && data.open != null && data.open > 0) {
      const calculatedChange = ((data.close - data.open) / data.open) * 100;
      
      if (Math.abs(calculatedChange) > 15) { // 单日涨跌超过15%需要关注
        warnings.push(`单日价格变化 ${calculatedChange.toFixed(2)}% 较大，需要确认数据准确性`);
      }
    }

    // 成交量和成交额一致性（如果都存在）
    if (data.vol != null && data.amount != null && data.vol > 0 && data.amount > 0) {
      const avgPrice = data.amount / data.vol * 100; // 转换单位
      const marketPrice = (data.open + data.high + data.low + data.close) / 4;
      
      if (Math.abs(avgPrice - marketPrice) / marketPrice > 0.5) { // 50%差异阈值
        warnings.push(`平均成交价 ${avgPrice.toFixed(2)} 与市场均价 ${marketPrice.toFixed(2)} 差异较大`);
      }
    }

    return {
      isValid: inconsistencies.length === 0,
      inconsistencies,
      warnings,
    };
  }

  /**
   * 更新验证配置
   */
  updateConfig(newConfig: Partial<DataQualityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): DataQualityConfig {
    return { ...this.config };
  }
}

// 导出默认实例
export const dataQualityValidator = new DataQualityValidator();