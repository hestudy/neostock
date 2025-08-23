import { describe, it, expect, beforeEach } from 'bun:test';
import { SeedDataManager, generateMockStockData, type StockBasicInfo } from '../../lib/seed-data';

describe('Seed Data Management System', () => {
  let seedManager: SeedDataManager;

  beforeEach(() => {
    seedManager = new SeedDataManager();
  });

  describe('数据验证功能', () => {
    it('应该验证有效的股票数据', () => {
      const validData = generateMockStockData(10);
      const result = seedManager.validateStockData(validData);

      expect(result.valid).toBe(true);
      expect(result.totalRecords).toBe(10);
      expect(result.validRecords).toBe(10);
      expect(result.issues).toHaveLength(0);
    });

    it('应该检测缺失的必填字段', () => {
      const invalidData: StockBasicInfo[] = [
        {
          ts_code: '',  // 缺失
          symbol: '000001',
          name: '平安银行',
          area: '深圳',
          industry: '银行',
          market: '主板',
          list_date: '19910403',
          is_hs: 'H'
        }
      ];

      const result = seedManager.validateStockData(invalidData);

      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('missing or invalid ts_code'))).toBe(true);
    });

    it('应该检测重复的股票代码', () => {
      const duplicateData: StockBasicInfo[] = [
        {
          ts_code: '000001.SZ',
          symbol: '000001',
          name: '平安银行1',
          area: '深圳',
          industry: '银行',
          market: '主板',
          list_date: '19910403',
          is_hs: 'H'
        },
        {
          ts_code: '000001.SZ',  // 重复
          symbol: '000001',
          name: '平安银行2',
          area: '深圳',
          industry: '银行',
          market: '主板',
          list_date: '19910403',
          is_hs: 'H'
        }
      ];

      const result = seedManager.validateStockData(duplicateData);

      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('duplicate ts_code'))).toBe(true);
    });

    it('应该检测无效的日期格式', () => {
      const invalidDateData: StockBasicInfo[] = [
        {
          ts_code: '000001.SZ',
          symbol: '000001',
          name: '平安银行',
          area: '深圳',
          industry: '银行',
          market: '主板',
          list_date: '1991-04-03',  // 错误格式
          is_hs: 'H'
        }
      ];

      const result = seedManager.validateStockData(invalidDateData);

      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('invalid list_date format'))).toBe(true);
    });

    it('应该处理空数组', () => {
      const result = seedManager.validateStockData([]);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Data array is empty');
    });
  });

  describe('批量导入功能', () => {
    it('应该成功导入小批量数据', async () => {
      const testData = generateMockStockData(100);
      const result = await seedManager.importStockBasics(testData);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(100);
      expect(result.errors).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该处理大批量数据 (4000只股票)', async () => {
      const largeTestData = generateMockStockData(4000);
      const maxTime = 5 * 60 * 1000; // 5分钟
      const seedManagerWithTimeout = new SeedDataManager(1000, maxTime);

      const startTime = Date.now();
      const result = await seedManagerWithTimeout.importStockBasics(largeTestData);
      const actualTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.imported).toBe(4000);
      expect(result.errors).toBe(0);
      expect(actualTime).toBeLessThan(maxTime); // 应该在5分钟内完成
      expect(result.duration).toBeLessThan(maxTime);
    });

    it('应该处理无效数据导入', async () => {
      const invalidData = [
        { ts_code: '', symbol: '', name: '', area: '', industry: '', market: '', list_date: '', is_hs: '' }
      ];

      const result = await seedManager.importStockBasics(invalidData as StockBasicInfo[]);

      expect(result.success).toBe(false);
      expect(result.errors).toBe(0); // 验证阶段失败，不进入导入阶段
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails!.length).toBeGreaterThan(0);
    });

    it('应该支持批次处理以优化内存使用', async () => {
      const largeData = generateMockStockData(5000);
      const batchSeedManager = new SeedDataManager(500); // 小批次大小

      const result = await batchSeedManager.importStockBasics(largeData);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(5000);
      
      // 验证批处理不影响结果的正确性
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('应该处理超时情况', async () => {
      const testData = generateMockStockData(1000);
      const shortTimeoutManager = new SeedDataManager(1000, 1); // 1ms 超时

      const result = await shortTimeoutManager.importStockBasics(testData);

      expect(result.success).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails!.some(error => error.includes('timeout'))).toBe(true);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内处理中等规模数据', async () => {
      const mediumData = generateMockStockData(1000);
      
      const startTime = Date.now();
      const result = await seedManager.importStockBasics(mediumData);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(30000); // 30秒内完成1000条记录
    });

    it('应该验证内存使用合理', async () => {
      const beforeMemory = process.memoryUsage();
      const largeData = generateMockStockData(2000);
      
      await seedManager.importStockBasics(largeData);
      
      const afterMemory = process.memoryUsage();
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      
      // 内存增长应该在合理范围内 (< 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('数据完整性验证', () => {
    it('应该维护数据完整性', async () => {
      const testData = generateMockStockData(50);
      const result = await seedManager.importStockBasics(testData);

      expect(result.success).toBe(true);
      expect(result.imported + result.skipped + result.errors).toBe(testData.length);
    });

    it('应该提供详细的错误信息', async () => {
      const mixedData = [
        ...generateMockStockData(5), // 有效数据
        { ts_code: '', symbol: 'INVALID', name: '', area: '', industry: '', market: '', list_date: 'invalid-date', is_hs: '' } // 无效数据
      ];

      const result = await seedManager.importStockBasics(mixedData as StockBasicInfo[]);

      expect(result.success).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails!.length).toBeGreaterThan(0);
    });
  });

  describe('统计和监控功能', () => {
    it('应该提供导入统计信息', async () => {
      const stats = await seedManager.getImportStatistics();

      expect(stats).toHaveProperty('totalStocks');
      expect(stats).toHaveProperty('lastImportDate');
      expect(stats).toHaveProperty('averageImportTime');
      expect(stats).toHaveProperty('importSuccessRate');
      
      expect(typeof stats.totalStocks).toBe('number');
      expect(typeof stats.averageImportTime).toBe('number');
      expect(typeof stats.importSuccessRate).toBe('number');
    });

    it('应该支持数据同步功能', async () => {
      const syncResult = await seedManager.syncWithRemoteSource();

      expect(syncResult).toHaveProperty('updated');
      expect(syncResult).toHaveProperty('added');
      expect(syncResult).toHaveProperty('removed');
      expect(syncResult).toHaveProperty('syncTime');
      
      expect(typeof syncResult.updated).toBe('number');
      expect(typeof syncResult.added).toBe('number');
      expect(typeof syncResult.removed).toBe('number');
      expect(syncResult.syncTime).toBeInstanceOf(Date);
    });
  });

  describe('边缘情况处理', () => {
    it('应该处理空字符串字段', () => {
      const dataWithEmptyFields: StockBasicInfo[] = [
        {
          ts_code: '000001.SZ',
          symbol: '000001',
          name: '平安银行',
          area: '', // 空字符串 - 允许
          industry: '银行',
          market: '主板',
          list_date: '',  // 空字符串 - 允许
          is_hs: 'H'
        }
      ];

      const result = seedManager.validateStockData(dataWithEmptyFields);
      expect(result.valid).toBe(true); // 空字符串是允许的，只要必填字段不为空
    });

    it('应该处理超大数据集', async () => {
      const hugeData = generateMockStockData(10000);
      const result = await seedManager.importStockBasics(hugeData);

      // 不一定成功（可能超时），但不应该崩溃
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.imported).toBe('number');
      expect(typeof result.duration).toBe('number');
    });
  });
});

describe('Mock Data Generation', () => {
  it('应该生成指定数量的模拟数据', () => {
    const mockData = generateMockStockData(100);

    expect(mockData).toHaveLength(100);
    expect(mockData[0]).toHaveProperty('ts_code');
    expect(mockData[0]).toHaveProperty('name');
    expect(mockData[0]).toHaveProperty('symbol');
  });

  it('应该生成唯一的股票代码', () => {
    const mockData = generateMockStockData(50);
    const codes = mockData.map(stock => stock.ts_code);
    const uniqueCodes = new Set(codes);

    expect(uniqueCodes.size).toBe(codes.length); // 所有代码都是唯一的
  });

  it('应该使用正确的股票代码格式', () => {
    const mockData = generateMockStockData(10);

    mockData.forEach(stock => {
      expect(stock.ts_code).toMatch(/^\d{6}\.(SZ|SH)$/);
      expect(stock.symbol).toMatch(/^\d{6}$/);
      expect(stock.list_date).toMatch(/^\d{8}$/);
    });
  });
});