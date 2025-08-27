import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataSyncScheduler } from '../../lib/schedulers/data-sync-scheduler.js';

// 创建简单的mock DataSourceManager
class MockDataSourceManager {
  fetchStockBasicInfo = vi.fn();
  fetchDailyData = vi.fn();
  getAllHealth = vi.fn();
}

describe('DataSyncScheduler Integration Tests', () => {
  let scheduler: DataSyncScheduler;
  let mockDataSourceManager: MockDataSourceManager;

  beforeEach(() => {
    mockDataSourceManager = new MockDataSourceManager();
    scheduler = new DataSyncScheduler(mockDataSourceManager as any, {
      cronExpression: '0 17 * * *',
      batchSize: 10,
      retryAttempts: 3,
      enabled: true
    });
  });

  afterEach(() => {
    scheduler.stop();
    vi.clearAllMocks();
  });

  describe('调度器启动和停止', () => {
    it('应该能够启动调度器', () => {
      expect(scheduler.isSchedulerRunning()).toBe(false);
      
      scheduler.start();
      
      expect(scheduler.isSchedulerRunning()).toBe(true);
    });

    it('应该能够停止调度器', () => {
      scheduler.start();
      expect(scheduler.isSchedulerRunning()).toBe(true);
      
      scheduler.stop();
      
      expect(scheduler.isSchedulerRunning()).toBe(false);
    });

    it('不应该重复启动调度器', () => {
      scheduler.start();
      expect(scheduler.isSchedulerRunning()).toBe(true);
      
      // 尝试再次启动
      scheduler.start();
      
      // 仍然应该只有一个调度器实例
      expect(scheduler.isSchedulerRunning()).toBe(true);
    });
  });

  describe('手动数据同步', () => {
    it('应该能够成功执行手动同步', async () => {
      // 准备测试数据
      const mockStocks = [
        { ts_code: '000001.SZ', symbol: '000001', name: '平安银行', area: '深圳', industry: '银行', market: '主板', list_date: '19910403', is_hs: 'S' },
        { ts_code: '000002.SZ', symbol: '000002', name: '万科A', area: '深圳', industry: '房地产开发', market: '主板', list_date: '19910129', is_hs: 'S' }
      ];

      mockDataSourceManager.fetchStockBasicInfo.mockResolvedValue(mockStocks);
      mockDataSourceManager.fetchDailyData.mockResolvedValue([
        { 
          ts_code: '000001.SZ', 
          trade_date: '20250827', 
          open: 10.5, 
          high: 10.8, 
          low: 10.3, 
          close: 10.7, 
          vol: 1000000, 
          amount: 10700000 
        }
      ]);

      const result = await scheduler.triggerManualSync();

      expect(result.success).toBe(true);
      expect(result.processedStocks).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThan(0);

      // 验证调用次数
      expect(mockDataSourceManager.fetchStockBasicInfo).toHaveBeenCalledTimes(1);
      expect(mockDataSourceManager.fetchDailyData).toHaveBeenCalledTimes(2);
    });

    it('应该正确处理数据源错误', async () => {
      const mockStocks = [
        { ts_code: '000001.SZ', symbol: '000001', name: '平安银行', area: '深圳', industry: '银行', market: '主板', list_date: '19910403', is_hs: 'S' }
      ];

      mockDataSourceManager.fetchStockBasicInfo.mockResolvedValue(mockStocks);
      mockDataSourceManager.fetchDailyData.mockRejectedValue(new Error('API调用失败'));

      const result = await scheduler.triggerManualSync();

      expect(result.success).toBe(false);
      expect(result.processedStocks).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('API调用失败');
    });

    it('应该正确处理批次处理', async () => {
      // 创建15只股票的测试数据（超过批次大小10）
      const mockStocks = Array.from({ length: 15 }, (_, i) => ({
        ts_code: `00000${i.toString().padStart(2, '0')}.SZ`,
        symbol: `00000${i.toString().padStart(2, '0')}`,
        name: `测试股票${i}`,
        area: '深圳',
        industry: '测试行业',
        market: '主板',
        list_date: '20200101',
        is_hs: 'S'
      }));

      mockDataSourceManager.fetchStockBasicInfo.mockResolvedValue(mockStocks);
      mockDataSourceManager.fetchDailyData.mockResolvedValue([]);

      const result = await scheduler.triggerManualSync();

      expect(result.success).toBe(true);
      expect(result.processedStocks).toBe(15);
      
      // 应该处理所有股票，尽管分批进行
      expect(mockDataSourceManager.fetchDailyData).toHaveBeenCalledTimes(15);
    });

    it('应该防止并发同步', async () => {
      mockDataSourceManager.fetchStockBasicInfo.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      // 启动第一个同步
      const sync1Promise = scheduler.triggerManualSync();
      
      // 尝试启动第二个同步
      await expect(scheduler.triggerManualSync())
        .rejects
        .toThrow('数据同步正在进行中');

      // 等待第一个同步完成
      const result1 = await sync1Promise;
      expect(result1.success).toBe(true);

      // 现在应该可以启动新的同步
      const result2 = await scheduler.triggerManualSync();
      expect(result2.success).toBe(true);
    });
  });

  describe('同步状态监控', () => {
    it('应该正确报告同步运行状态', async () => {
      expect(scheduler.isSyncRunning()).toBe(false);

      // 使用较长延迟来测试状态
      mockDataSourceManager.fetchStockBasicInfo.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 50))
      );

      const syncPromise = scheduler.triggerManualSync();
      
      // 短暂延迟后检查状态
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(scheduler.isSyncRunning()).toBe(true);

      // 等待同步完成
      await syncPromise;
      expect(scheduler.isSyncRunning()).toBe(false);
    });
  });

  describe('错误恢复机制', () => {
    it('应该在获取股票信息失败时正确处理', async () => {
      mockDataSourceManager.fetchStockBasicInfo.mockRejectedValue(new Error('网络错误'));

      const result = await scheduler.triggerManualSync();

      expect(result.success).toBe(false);
      expect(result.processedStocks).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('网络错误');
    });

    it('应该在部分股票处理失败时继续处理其他股票', async () => {
      const mockStocks = [
        { ts_code: '000001.SZ', symbol: '000001', name: '股票1', area: '深圳', industry: '银行', market: '主板', list_date: '20200101', is_hs: 'S' },
        { ts_code: '000002.SZ', symbol: '000002', name: '股票2', area: '深圳', industry: '银行', market: '主板', list_date: '20200101', is_hs: 'S' },
        { ts_code: '000003.SZ', symbol: '000003', name: '股票3', area: '深圳', industry: '银行', market: '主板', list_date: '20200101', is_hs: 'S' }
      ];

      mockDataSourceManager.fetchStockBasicInfo.mockResolvedValue(mockStocks);
      
      // 让第二只股票失败
      mockDataSourceManager.fetchDailyData
        .mockImplementation((tsCode: string) => {
          if (tsCode === '000002.SZ') {
            return Promise.reject(new Error('数据获取失败'));
          }
          return Promise.resolve([]);
        });

      const result = await scheduler.triggerManualSync();

      expect(result.success).toBe(false); // 因为有错误
      expect(result.processedStocks).toBe(2); // 但是处理了2只股票
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('000002.SZ');
    });
  });
});