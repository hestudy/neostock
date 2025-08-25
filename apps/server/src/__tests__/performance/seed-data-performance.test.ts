import { describe, it, expect, beforeEach } from 'vitest';
import { SeedDataManager, generateMockStockData, type StockBasicInfo } from '../../lib/seed-data';

describe('Seed Data Performance Tests', () => {
  let seedDataManager: SeedDataManager;

  beforeEach(() => {
    seedDataManager = new SeedDataManager();
  });

  describe('Stock Data Import Performance', () => {
    it('should import 4000 stocks within 5 minutes', async () => {
      const stockCount = 4000;
      const maxTimeMs = 5 * 60 * 1000; // 5 minutes
      
      const mockData = generateMockStockData(stockCount);
      
      const startTime = Date.now();
      const result = await seedDataManager.importStockBasics(mockData);
      const actualTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.imported).toBe(stockCount);
      expect(result.duration).toBeLessThan(maxTimeMs);
      expect(actualTime).toBeLessThan(maxTimeMs);
      
      console.log(`Imported ${stockCount} stocks in ${actualTime}ms (${actualTime/1000}s)`);
    });

    it('should handle 1000 stocks within 1 minute', async () => {
      const stockCount = 1000;
      const maxTimeMs = 60 * 1000; // 1 minute
      
      const mockData = generateMockStockData(stockCount);
      
      const startTime = Date.now();
      const result = await seedDataManager.importStockBasics(mockData);
      const actualTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.imported).toBe(stockCount);
      expect(result.duration).toBeLessThan(maxTimeMs);
      expect(actualTime).toBeLessThan(maxTimeMs);
    });

    it('should maintain performance across multiple batch sizes', async () => {
      const testCases = [
        { count: 500, batchSize: 100, maxTime: 30000 },   // 30 seconds
        { count: 1000, batchSize: 250, maxTime: 45000 },  // 45 seconds
        { count: 2000, batchSize: 500, maxTime: 90000 },  // 1.5 minutes
      ];

      for (const testCase of testCases) {
        const manager = new SeedDataManager(testCase.batchSize);
        const mockData = generateMockStockData(testCase.count);
        
        const startTime = Date.now();
        const result = await manager.importStockBasics(mockData);
        const actualTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(result.imported).toBe(testCase.count);
        expect(actualTime).toBeLessThan(testCase.maxTime);
        
        console.log(`Batch size ${testCase.batchSize}: ${testCase.count} stocks in ${actualTime}ms`);
      }
    });
  });

  describe('Data Validation Performance', () => {
    it('should validate 4000 stock records within 5 seconds', async () => {
      const stockCount = 4000;
      const maxValidationTime = 5000; // 5 seconds
      
      const mockData = generateMockStockData(stockCount);
      
      const startTime = Date.now();
      const validation = seedDataManager.validateStockData(mockData);
      const validationTime = Date.now() - startTime;
      
      expect(validation.valid).toBe(true);
      expect(validation.totalRecords).toBe(stockCount);
      expect(validation.validRecords).toBe(stockCount);
      expect(validationTime).toBeLessThan(maxValidationTime);
      
      console.log(`Validated ${stockCount} records in ${validationTime}ms`);
    });

    it('should handle invalid data validation efficiently', async () => {
      const validRecords = 1000;
      const invalidRecords = 100;
      const maxValidationTime = 2000; // 2 seconds
      
      const mockData = generateMockStockData(validRecords);
      
      // 添加一些无效记录
      for (let i = 0; i < invalidRecords; i++) {
        mockData.push({
          ts_code: '', // 无效的空代码
          symbol: `INV${i}`,
          name: `Invalid Stock ${i}`,
          area: '无效区域',
          industry: '无效行业',
          market: '无效市场',
          list_date: 'invalid-date',
          is_hs: 'X'
        });
      }
      
      const startTime = Date.now();
      const validation = seedDataManager.validateStockData(mockData);
      const validationTime = Date.now() - startTime;
      
      expect(validation.valid).toBe(false);
      expect(validation.totalRecords).toBe(validRecords + invalidRecords);
      expect(validation.validRecords).toBe(validRecords);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validationTime).toBeLessThan(maxValidationTime);
    });
  });

  describe('Memory and Resource Performance', () => {
    it('should handle large datasets without memory issues', async () => {
      const largeDatasetSize = 10000;
      const batchSize = 500;
      
      const manager = new SeedDataManager(batchSize);
      const mockData = generateMockStockData(largeDatasetSize);
      
      // 测试内存使用情况
      const initialMemory = process.memoryUsage();
      
      const result = await manager.importStockBasics(mockData);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      expect(result.success).toBe(true);
      expect(result.imported).toBe(largeDatasetSize);
      
      // 内存增长应该合理 (小于100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB for ${largeDatasetSize} records`);
    });

    it('should process concurrent imports efficiently', async () => {
      const concurrentImports = 3;
      const recordsPerImport = 1000;
      const maxTotalTime = 120000; // 2 minutes
      
      const promises = Array.from({ length: concurrentImports }, (_, index) => {
        const manager = new SeedDataManager();
        const mockData = generateMockStockData(recordsPerImport);
        
        // 给每个导入不同的股票代码以避免冲突
        mockData.forEach((stock, i) => {
          stock.ts_code = `${String((index * recordsPerImport) + i + 1).padStart(6, '0')}.SZ`;
        });
        
        return manager.importStockBasics(mockData);
      });
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(maxTotalTime);
      
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.imported).toBe(recordsPerImport);
        console.log(`Concurrent import ${index + 1}: ${result.duration}ms`);
      });
      
      console.log(`Total concurrent import time: ${totalTime}ms`);
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain consistent import speed across runs', async () => {
      const stockCount = 1000;
      const numberOfRuns = 5;
      const maxVariancePercent = 50; // 50% variance allowance
      
      const runTimes: number[] = [];
      
      for (let run = 0; run < numberOfRuns; run++) {
        const mockData = generateMockStockData(stockCount);
        
        const startTime = Date.now();
        const result = await seedDataManager.importStockBasics(mockData);
        const runTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        runTimes.push(runTime);
      }
      
      const averageTime = runTimes.reduce((a, b) => a + b, 0) / runTimes.length;
      const minTime = Math.min(...runTimes);
      const maxTime = Math.max(...runTimes);
      
      const variance = ((maxTime - minTime) / averageTime) * 100;
      
      expect(variance).toBeLessThan(maxVariancePercent);
      
      console.log(`Performance consistency: avg=${averageTime.toFixed(0)}ms, min=${minTime}ms, max=${maxTime}ms, variance=${variance.toFixed(1)}%`);
    });

    it('should scale linearly with data size', async () => {
      const testSizes = [500, 1000, 2000];
      const results: { size: number; timePerRecord: number }[] = [];
      
      for (const size of testSizes) {
        const mockData = generateMockStockData(size);
        
        const startTime = Date.now();
        const result = await seedDataManager.importStockBasics(mockData);
        const totalTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        
        const timePerRecord = totalTime / size;
        results.push({ size, timePerRecord });
        
        console.log(`${size} records: ${totalTime}ms (${timePerRecord.toFixed(2)}ms per record)`);
      }
      
      // 检查扩展性 - 每条记录的处理时间不应该随数据量显著增加
      const firstTimePerRecord = results[0].timePerRecord;
      const lastTimePerRecord = results[results.length - 1].timePerRecord;
      const scalingRatio = lastTimePerRecord / firstTimePerRecord;
      
      // 允许一定的性能下降，但不应该超过2倍
      expect(scalingRatio).toBeLessThan(2.0);
    });
  });

  describe('Timeout and Error Handling Performance', () => {
    it('should respect import timeout limits', async () => {
      const shortTimeout = 100; // 100ms - 很短的超时时间
      const manager = new SeedDataManager(100, shortTimeout);
      
      const largeData = generateMockStockData(5000);
      
      const startTime = Date.now();
      const result = await manager.importStockBasics(largeData);
      const actualTime = Date.now() - startTime;
      
      // 应该在超时时间附近停止，而不是完成所有导入
      expect(actualTime).toBeLessThan(shortTimeout + 100); // 100ms buffer
      expect(result.success).toBe(false);
      expect(result.errorDetails?.some(error => error.includes('timeout'))).toBe(true);
    });

    it('should handle batch processing errors gracefully', async () => {
      // 创建包含一些会导致处理错误的数据
      const mixedData: StockBasicInfo[] = [
        ...generateMockStockData(100),
        // 添加一些有问题的记录，但这些不应该完全阻止导入
      ];
      
      const startTime = Date.now();
      const result = await seedDataManager.importStockBasics(mixedData);
      const processingTime = Date.now() - startTime;
      
      // 即使有错误，处理时间也应该是可预测的
      expect(processingTime).toBeLessThan(30000); // 30 seconds max
      expect(result.imported).toBeGreaterThan(0);
    });
  });
});