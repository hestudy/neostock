/**
 * 种子数据管理系统
 * 负责 A股基础信息的批量导入、验证和同步
 */

export interface StockBasicInfo {
  ts_code: string;        // 股票代码
  symbol: string;         // 股票符号
  name: string;           // 股票名称
  area: string;           // 地域
  industry: string;       // 所属行业
  market: string;         // 市场类型 (主板/创业板等)
  list_date: string;      // 上市日期
  is_hs: string;          // 是否沪深港通标的
}

export interface SeedDataResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  duration: number;
  errorDetails?: string[];
}

export interface ValidationResult {
  valid: boolean;
  totalRecords: number;
  validRecords: number;
  issues: string[];
}

export class SeedDataManager {
  private batchSize: number = 1000;
  private maxImportTime: number = 5 * 60 * 1000; // 5 minutes in ms

  constructor(batchSize?: number, maxImportTime?: number) {
    if (batchSize) this.batchSize = batchSize;
    if (maxImportTime) this.maxImportTime = maxImportTime;
  }

  /**
   * 批量导入 A股基础信息
   * 目标: 4000 只股票在 5 分钟内完成
   */
  async importStockBasics(data: StockBasicInfo[]): Promise<SeedDataResult> {
    const startTime = Date.now();
    const result: SeedDataResult = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: 0,
      duration: 0,
      errorDetails: []
    };

    try {
      // 验证数据格式
      const validation = this.validateStockData(data);
      if (!validation.valid) {
        result.errorDetails = validation.issues;
        return result;
      }

      // 分批处理数据以避免内存问题
      const batches = this.createBatches(data, this.batchSize);
      
      for (const batch of batches) {
        const batchResult = await this.processBatch(batch);
        result.imported += batchResult.imported;
        result.skipped += batchResult.skipped;
        result.errors += batchResult.errors;
        
        if (batchResult.errorDetails) {
          result.errorDetails!.push(...batchResult.errorDetails);
        }

        // 检查超时
        if (Date.now() - startTime > this.maxImportTime) {
          result.errorDetails!.push(`Import timeout exceeded ${this.maxImportTime}ms`);
          result.errors += 1;
          break;
        }
      }

      result.duration = Date.now() - startTime;
      result.success = result.errors === 0 && result.imported > 0;

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.errorDetails = [`Import failed: ${error}`];
      return result;
    }
  }

  /**
   * 验证股票数据的完整性和格式
   */
  validateStockData(data: StockBasicInfo[]): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      totalRecords: data.length,
      validRecords: 0,
      issues: []
    };

    if (!Array.isArray(data)) {
      result.valid = false;
      result.issues.push('Data must be an array');
      return result;
    }

    if (data.length === 0) {
      result.valid = false;
      result.issues.push('Data array is empty');
      return result;
    }

    const seenCodes = new Set<string>();
    
    for (let i = 0; i < data.length; i++) {
      const stock = data[i];
      const issues: string[] = [];

      // 检查必填字段
      if (!stock.ts_code || typeof stock.ts_code !== 'string') {
        issues.push(`Record ${i}: missing or invalid ts_code`);
      } else if (seenCodes.has(stock.ts_code)) {
        issues.push(`Record ${i}: duplicate ts_code ${stock.ts_code}`);
      } else {
        seenCodes.add(stock.ts_code);
      }

      if (!stock.name || typeof stock.name !== 'string') {
        issues.push(`Record ${i}: missing or invalid name`);
      }

      if (!stock.symbol || typeof stock.symbol !== 'string') {
        issues.push(`Record ${i}: missing or invalid symbol`);
      }

      // 检查上市日期格式
      if (stock.list_date && !/^\d{8}$/.test(stock.list_date)) {
        issues.push(`Record ${i}: invalid list_date format, expected YYYYMMDD`);
      }

      if (issues.length === 0) {
        result.validRecords++;
      } else {
        result.issues.push(...issues);
      }
    }

    result.valid = result.issues.length === 0;
    return result;
  }

  /**
   * 获取数据导入统计信息
   */
  async getImportStatistics(): Promise<{
    totalStocks: number;
    lastImportDate: Date | null;
    averageImportTime: number;
    importSuccessRate: number;
  }> {
    // 实际实现会查询数据库
    // 这里返回模拟数据供测试使用
    return {
      totalStocks: 0,
      lastImportDate: null,
      averageImportTime: 0,
      importSuccessRate: 0
    };
  }

  /**
   * 数据同步和更新机制
   */
  async syncWithRemoteSource(): Promise<{
    updated: number;
    added: number;
    removed: number;
    syncTime: Date;
  }> {
    const syncTime = new Date();
    
    // 实际实现会调用 tushare API 获取最新数据
    // 对比本地数据并更新差异
    
    return {
      updated: 0,
      added: 0,
      removed: 0,
      syncTime
    };
  }

  /**
   * 性能优化: 创建数据批次
   */
  private createBatches<T>(data: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 处理单个批次的数据
   */
  private async processBatch(batch: StockBasicInfo[]): Promise<SeedDataResult> {
    // 模拟批次处理
    // 实际实现会插入数据库
    const result: SeedDataResult = {
      success: true,
      imported: batch.length,
      skipped: 0,
      errors: 0,
      duration: 0
    };

    // 模拟处理时间 (根据批次大小调整时间以便超时测试更可靠)
    const processingTime = Math.max(10, batch.length / 100);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return result;
  }
}

/**
 * 生成测试用的模拟股票数据
 */
export function generateMockStockData(count: number): StockBasicInfo[] {
  const data: StockBasicInfo[] = [];
  const industries = ['银行', '地产', '医药', '科技', '制造'];
  const areas = ['深圳', '上海', '北京', '杭州', '广州'];
  
  for (let i = 0; i < count; i++) {
    const code = String(i + 1).padStart(6, '0');
    const market = i % 2 === 0 ? 'SZ' : 'SH';
    
    data.push({
      ts_code: `${code}.${market}`,
      symbol: code,
      name: `测试股票${i + 1}`,
      area: areas[i % areas.length],
      industry: industries[i % industries.length],
      market: i < count * 0.8 ? '主板' : '创业板',
      list_date: `200${(i % 10)}0101`,
      is_hs: i % 3 === 0 ? 'H' : 'N'
    });
  }
  
  return data;
}