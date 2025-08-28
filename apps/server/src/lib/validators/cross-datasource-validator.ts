import type { StockBasicInfo, StockDailyData, DataQualityIssue } from "../../types/data-sources";
import { DataQualityIssueType } from "../../types/data-sources";

// 跨数据源验证结果
export interface CrossDataSourceValidationResult {
  stockCode: string;
  isConsistent: boolean;
  issues: DataQualityIssue[];
  sources: string[];
  validationTimestamp: Date;
  details: {
    priceConsistency: PriceConsistencyCheck;
    volumeConsistency: VolumeConsistencyCheck;
    basicInfoConsistency: BasicInfoConsistencyCheck;
  };
}

// 价格一致性检查结果
export interface PriceConsistencyCheck {
  isConsistent: boolean;
  maxPriceDeviation: number; // 最大价格偏差百分比
  issues: string[];
  comparedFields: string[];
}

// 成交量一致性检查结果
export interface VolumeConsistencyCheck {
  isConsistent: boolean;
  maxVolumeDeviation: number; // 最大成交量偏差百分比
  issues: string[];
}

// 基础信息一致性检查结果
export interface BasicInfoConsistencyCheck {
  isConsistent: boolean;
  inconsistentFields: string[];
  issues: string[];
}

// 跨数据源数据样本
export interface DataSourceSample {
  sourceName: string;
  basicInfo?: StockBasicInfo;
  dailyData?: StockDailyData;
  timestamp: Date;
}

// 一致性验证配置
export interface ConsistencyConfig {
  priceDeviationThreshold: number; // 价格偏差阈值百分比 (默认5%)
  volumeDeviationThreshold: number; // 成交量偏差阈值百分比 (默认10%)
  requireExactMatch: string[]; // 需要精确匹配的字段
  tolerantFields: string[]; // 可以容忍差异的字段
}

export class CrossDataSourceValidator {
  private config: ConsistencyConfig;

  constructor(config?: Partial<ConsistencyConfig>) {
    this.config = {
      priceDeviationThreshold: 5.0, // 5%
      volumeDeviationThreshold: 10.0, // 10%
      requireExactMatch: ['ts_code', 'trade_date', 'name'],
      tolerantFields: ['amount'], // 成交额可能因为计算方式不同而有差异
      ...config,
    };
  }

  /**
   * 验证多个数据源的股票基础信息一致性
   */
  validateBasicInfoConsistency(samples: DataSourceSample[]): CrossDataSourceValidationResult {
    if (samples.length < 2) {
      throw new Error('需要至少两个数据源样本进行一致性验证');
    }

    const stockCode = samples[0].basicInfo?.ts_code || 'unknown';
    const issues: DataQualityIssue[] = [];
    const sources = samples.map(s => s.sourceName);

    // 验证基础信息
    const basicInfoCheck = this.checkBasicInfoConsistency(
      samples.map(s => ({ source: s.sourceName, data: s.basicInfo! }))
    );

    // 汇总结果
    const isConsistent = basicInfoCheck.isConsistent;

    return {
      stockCode,
      isConsistent,
      issues,
      sources,
      validationTimestamp: new Date(),
      details: {
        priceConsistency: { isConsistent: true, maxPriceDeviation: 0, issues: [], comparedFields: [] },
        volumeConsistency: { isConsistent: true, maxVolumeDeviation: 0, issues: [] },
        basicInfoConsistency: basicInfoCheck,
      },
    };
  }

  /**
   * 验证多个数据源的股票日线数据一致性
   */
  validateDailyDataConsistency(samples: DataSourceSample[]): CrossDataSourceValidationResult {
    if (samples.length < 2) {
      throw new Error('需要至少两个数据源样本进行一致性验证');
    }

    const stockCode = samples[0].dailyData?.ts_code || 'unknown';
    const issues: DataQualityIssue[] = [];
    const sources = samples.map(s => s.sourceName);

    // 验证价格一致性
    const priceCheck = this.checkPriceConsistency(
      samples.map(s => ({ source: s.sourceName, data: s.dailyData! }))
    );

    // 验证成交量一致性
    const volumeCheck = this.checkVolumeConsistency(
      samples.map(s => ({ source: s.sourceName, data: s.dailyData! }))
    );

    // 收集所有问题
    issues.push(...priceCheck.issues.map(issue => ({
      type: DataQualityIssueType.INCONSISTENT_DATA,
      severity: 'medium' as const,
      message: `价格一致性问题: ${issue}`,
      affectedFields: priceCheck.comparedFields,
      affectedRecords: 1,
    })));

    issues.push(...volumeCheck.issues.map(issue => ({
      type: DataQualityIssueType.INCONSISTENT_DATA,
      severity: 'medium' as const,
      message: `成交量一致性问题: ${issue}`,
      affectedRecords: 1,
    })));

    const isConsistent = priceCheck.isConsistent && volumeCheck.isConsistent;

    return {
      stockCode,
      isConsistent,
      issues,
      sources,
      validationTimestamp: new Date(),
      details: {
        priceConsistency: priceCheck,
        volumeConsistency: volumeCheck,
        basicInfoConsistency: { isConsistent: true, inconsistentFields: [], issues: [] },
      },
    };
  }

  /**
   * 综合验证（基础信息 + 日线数据）
   */
  validateComprehensiveConsistency(samples: DataSourceSample[]): CrossDataSourceValidationResult {
    if (samples.length < 2) {
      throw new Error('需要至少两个数据源样本进行一致性验证');
    }

    const stockCode = samples[0].basicInfo?.ts_code || samples[0].dailyData?.ts_code || 'unknown';
    const sources = samples.map(s => s.sourceName);
    const allIssues: DataQualityIssue[] = [];

    // 分别验证基础信息和日线数据
    let basicInfoCheck: BasicInfoConsistencyCheck = { 
      isConsistent: true, 
      inconsistentFields: [], 
      issues: [] 
    };
    let priceCheck: PriceConsistencyCheck = { 
      isConsistent: true, 
      maxPriceDeviation: 0, 
      issues: [], 
      comparedFields: [] 
    };
    let volumeCheck: VolumeConsistencyCheck = { 
      isConsistent: true, 
      maxVolumeDeviation: 0, 
      issues: [] 
    };

    // 检查基础信息（如果有的话）
    const basicInfoSamples = samples.filter(s => s.basicInfo);
    if (basicInfoSamples.length >= 2) {
      basicInfoCheck = this.checkBasicInfoConsistency(
        basicInfoSamples.map(s => ({ source: s.sourceName, data: s.basicInfo! }))
      );
    }

    // 检查日线数据（如果有的话）
    const dailyDataSamples = samples.filter(s => s.dailyData);
    if (dailyDataSamples.length >= 2) {
      priceCheck = this.checkPriceConsistency(
        dailyDataSamples.map(s => ({ source: s.sourceName, data: s.dailyData! }))
      );
      volumeCheck = this.checkVolumeConsistency(
        dailyDataSamples.map(s => ({ source: s.sourceName, data: s.dailyData! }))
      );
    }

    // 汇总所有问题
    allIssues.push(...basicInfoCheck.issues.map(issue => ({
      type: DataQualityIssueType.INCONSISTENT_DATA,
      severity: 'high' as const,
      message: `基础信息一致性问题: ${issue}`,
      affectedFields: basicInfoCheck.inconsistentFields,
      affectedRecords: 1,
    })));

    allIssues.push(...priceCheck.issues.map(issue => ({
      type: DataQualityIssueType.INCONSISTENT_DATA,
      severity: 'medium' as const,
      message: `价格一致性问题: ${issue}`,
      affectedFields: priceCheck.comparedFields,
      affectedRecords: 1,
    })));

    allIssues.push(...volumeCheck.issues.map(issue => ({
      type: DataQualityIssueType.INCONSISTENT_DATA,
      severity: 'medium' as const,
      message: `成交量一致性问题: ${issue}`,
      affectedRecords: 1,
    })));

    const isConsistent = basicInfoCheck.isConsistent && priceCheck.isConsistent && volumeCheck.isConsistent;

    return {
      stockCode,
      isConsistent,
      issues: allIssues,
      sources,
      validationTimestamp: new Date(),
      details: {
        priceConsistency: priceCheck,
        volumeConsistency: volumeCheck,
        basicInfoConsistency: basicInfoCheck,
      },
    };
  }

  /**
   * 检查基础信息一致性
   */
  private checkBasicInfoConsistency(
    samples: Array<{ source: string; data: StockBasicInfo }>
  ): BasicInfoConsistencyCheck {
    const inconsistentFields: string[] = [];
    const issues: string[] = [];

    if (samples.length < 2) {
      return { isConsistent: true, inconsistentFields, issues };
    }
    const fieldsToCheck: (keyof StockBasicInfo)[] = [
      'ts_code', 'symbol', 'name', 'area', 'industry', 'market', 'list_date', 'is_hs'
    ];

    for (const field of fieldsToCheck) {
      const values = samples.map(s => s.data[field]);
      const uniqueValues = [...new Set(values)];

      if (uniqueValues.length > 1) {
        // 检查是否是可容忍的字段
        if (!this.config.tolerantFields.includes(field)) {
          inconsistentFields.push(field);
          
          const valuesBySource = samples.map(s => `${s.source}: ${s.data[field]}`).join(', ');
          issues.push(`字段 ${field} 在不同数据源间不一致: ${valuesBySource}`);
        }
      }
    }

    return {
      isConsistent: inconsistentFields.length === 0,
      inconsistentFields,
      issues,
    };
  }

  /**
   * 检查价格一致性
   */
  private checkPriceConsistency(
    samples: Array<{ source: string; data: StockDailyData }>
  ): PriceConsistencyCheck {
    const issues: string[] = [];
    const comparedFields = ['open', 'high', 'low', 'close'];
    let maxDeviation = 0;

    if (samples.length < 2) {
      return { isConsistent: true, maxPriceDeviation: 0, issues, comparedFields };
    }

    for (const field of comparedFields) {
      const prices = samples.map(s => s.data[field as keyof StockDailyData] as number).filter(p => p != null);
      
      if (prices.length < 2) continue;

      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const deviation = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

      maxDeviation = Math.max(maxDeviation, deviation);

      if (deviation > this.config.priceDeviationThreshold) {
        const pricesBySource = samples
          .map(s => `${s.source}: ${s.data[field as keyof StockDailyData]}`)
          .join(', ');
        issues.push(`${field} 价格偏差 ${deviation.toFixed(2)}% 超过阈值 ${this.config.priceDeviationThreshold}%: ${pricesBySource}`);
      }
    }

    return {
      isConsistent: issues.length === 0,
      maxPriceDeviation: maxDeviation,
      issues,
      comparedFields,
    };
  }

  /**
   * 检查成交量一致性
   */
  private checkVolumeConsistency(
    samples: Array<{ source: string; data: StockDailyData }>
  ): VolumeConsistencyCheck {
    const issues: string[] = [];
    let maxDeviation = 0;

    if (samples.length < 2) {
      return { isConsistent: true, maxVolumeDeviation: 0, issues };
    }

    // 检查成交量
    const volumes = samples.map(s => s.data.vol).filter(v => v != null) as number[];
    
    if (volumes.length >= 2) {
      const minVolume = Math.min(...volumes);
      const maxVolume = Math.max(...volumes);
      const deviation = minVolume > 0 ? ((maxVolume - minVolume) / minVolume) * 100 : 0;

      maxDeviation = Math.max(maxDeviation, deviation);

      if (deviation > this.config.volumeDeviationThreshold) {
        const volumesBySource = samples
          .map(s => `${s.source}: ${s.data.vol}`)
          .join(', ');
        issues.push(`成交量偏差 ${deviation.toFixed(2)}% 超过阈值 ${this.config.volumeDeviationThreshold}%: ${volumesBySource}`);
      }
    }

    // 检查成交额（如果不在容忍字段中）
    if (!this.config.tolerantFields.includes('amount')) {
      const amounts = samples.map(s => s.data.amount).filter(a => a != null) as number[];
      
      if (amounts.length >= 2) {
        const minAmount = Math.min(...amounts);
        const maxAmount = Math.max(...amounts);
        const deviation = minAmount > 0 ? ((maxAmount - minAmount) / minAmount) * 100 : 0;

        maxDeviation = Math.max(maxDeviation, deviation);

        if (deviation > this.config.volumeDeviationThreshold) {
          const amountsBySource = samples
            .map(s => `${s.source}: ${s.data.amount}`)
            .join(', ');
          issues.push(`成交额偏差 ${deviation.toFixed(2)}% 超过阈值 ${this.config.volumeDeviationThreshold}%: ${amountsBySource}`);
        }
      }
    }

    return {
      isConsistent: issues.length === 0,
      maxVolumeDeviation: maxDeviation,
      issues,
    };
  }

  /**
   * 更新验证配置
   */
  updateConfig(newConfig: Partial<ConsistencyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ConsistencyConfig {
    return { ...this.config };
  }
}

// 导出默认实例
export const crossDataSourceValidator = new CrossDataSourceValidator();