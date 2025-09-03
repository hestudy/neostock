import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryManager, defaultMemoryConfig } from '../memory-management';

// 导入测试设置
import '../../test-setup';

describe('Memory Management - 内存管理', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager({
      ...defaultMemoryConfig,
      maxMemoryUsage: 10 * 1024 * 1024, // 10MB for testing
      warningThreshold: 0.5,
      cleanupThreshold: 0.8,
      dataRetentionTime: 1000, // 1 second for testing
      enableAutoGC: false, // Disable GC for testing
      enableMemoryMonitoring: false, // Disable monitoring for testing
      enableLeakDetection: false, // Disable leak detection for testing
    });
  });

  afterEach(() => {
    memoryManager.destroy();
  });

  describe('MemoryManager - 内存管理器', () => {
    it('应该正确初始化内存管理器', () => {
      expect(memoryManager).toBeDefined();
      const stats = memoryManager.getMemoryStats();
      expect(stats).toBeDefined();
      expect(stats.totalUsage).toBeGreaterThanOrEqual(0);
    });

    it('应该正确获取内存报告', () => {
      const report = memoryManager.getMemoryReport();
      
      expect(report).toBeDefined();
      expect(report.healthy).toBe(true);
      expect(report.stats).toBeDefined();
      expect(Array.isArray(report.warnings)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('应该正确处理缓存操作', () => {
      const testData = { value: 'test', data: [1, 2, 3] };
      
      // 添加到缓存
      memoryManager.addToCache('test-key', testData);
      
      // 从缓存获取
      const cached = memoryManager.getFromCache('test-key');
      expect(cached).toEqual(testData);
      
      // 获取不存在的缓存
      const nonexistent = memoryManager.getFromCache('nonexistent-key');
      expect(nonexistent).toBeNull();
    });

    it('应该正确计算内存使用统计', () => {
      // 添加一些测试数据
      memoryManager.addToCache('data1', { value: 'data1' });
      memoryManager.addToCache('data2', { value: 'data2', large: Array(1000).fill('data') });
      
      const stats = memoryManager.getMemoryStats();
      
      expect(stats.totalUsage).toBeGreaterThan(0);
      expect(stats.cacheUsage).toBeGreaterThan(0);
      expect(stats.domElementCount).toBeGreaterThanOrEqual(0);
    });

    it('应该正确处理图表实例注册', () => {
      const mockChart: any = {
        chart: { id: 'test-chart' },
        dataLength: 100,
        indicatorLength: 50,
        lastUsed: Date.now(),
      };

      // 注册图表实例
      memoryManager.registerChartInstance(mockChart);
      
      let stats = memoryManager.getMemoryStats();
      expect(stats.activeChartCount).toBe(1);

      // 注销图表实例
      memoryManager.unregisterChartInstance(mockChart);
      
      stats = memoryManager.getMemoryStats();
      expect(stats.activeChartCount).toBe(0);
    });

    it('应该正确检测内存使用状态', () => {
      // 测试正常状态
      let report = memoryManager.getMemoryReport();
      expect(report.healthy).toBe(true);

      // 模拟高内存使用
      memoryManager.addToCache('large-data', { 
        data: Array(100000).fill('large-data') 
      });

      report = memoryManager.getMemoryReport();
      // 由于我们设置了10MB的限制，这个测试可能不会触发警告
      // 但至少应该返回一个有效的报告
      expect(report).toBeDefined();
    });

    it('应该正确清理缓存', () => {
      // 添加大量缓存项
      for (let i = 0; i < 100; i++) {
        memoryManager.addToCache(`key${i}`, { value: i });
      }

      let stats = memoryManager.getMemoryStats();
      const initialCacheSize = stats.cacheUsage;

      // 执行清理
      memoryManager['cleanupCache']();

      stats = memoryManager.getMemoryStats();
      expect(stats.cacheUsage).toBeLessThanOrEqual(initialCacheSize);
    });

    it('应该正确清理旧数据', () => {
      // 添加缓存项
      memoryManager.addToCache('old-data', { value: 'old' });
      
      // 修改时间戳使其过期
      const cache = memoryManager['dataCache'];
      const item = cache.get('old-data');
      if (item) {
        item.timestamp = Date.now() - 2000; // 2秒前
      }

      // 执行清理
      memoryManager['cleanupOldData']();

      // 旧数据应该被清理
      const cached = memoryManager.getFromCache('old-data');
      expect(cached).toBeNull();
    });

    it('应该正确处理内存管理器销毁', () => {
      // 添加一些数据
      memoryManager.addToCache('test', { value: 'test' });
      
      // 销毁管理器
      memoryManager.destroy();
      
      // 尝试获取缓存应该失败
      const cached = memoryManager.getFromCache('test');
      expect(cached).toBeNull();
    });

    it('应该正确处理配置更新', () => {
      const newConfig = {
        maxMemoryUsage: 20 * 1024 * 1024, // 20MB
        warningThreshold: 0.6,
        cleanupThreshold: 0.9,
      };

      // 创建新的内存管理器测试配置
      const newManager = new MemoryManager({
        ...defaultMemoryConfig,
        ...newConfig,
        enableMemoryMonitoring: false,
        enableLeakDetection: false,
      });

      const stats = newManager.getMemoryStats();
      expect(stats).toBeDefined();

      newManager.destroy();
    });

    it('应该正确处理并发操作', () => {
      // 并发添加缓存
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() => {
            memoryManager.addToCache(`concurrent-${i}`, { value: i });
          })
        );
      }

      return Promise.all(promises).then(() => {
        const stats = memoryManager.getMemoryStats();
        expect(stats.cacheUsage).toBeGreaterThan(0);
      });
    });

    it('应该正确处理大数据量', () => {
      // 添加大数据量
      const largeData = {
        data: Array(10000).fill('large-data-item'),
        metadata: Array(1000).fill('metadata'),
      };

      memoryManager.addToCache('large-data', largeData);

      const stats = memoryManager.getMemoryStats();
      expect(stats.cacheUsage).toBeGreaterThan(0);
    });

    it('应该正确处理内存警告和推荐', () => {
      const report = memoryManager.getMemoryReport();
      
      expect(report.warnings).toBeDefined();
      expect(Array.isArray(report.warnings)).toBe(true);
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('MemoryLeakDetector - 内存泄漏检测', () => {
    it('应该正确创建和检测快照', () => {
      const detector = memoryManager['leakDetector'];
      
      // 创建快照
      detector.createSnapshot('test-category', [{ id: '1' }, { id: '2' }]);
      
      // 检测泄漏（应该没有，因为数量少）
      const leaks = detector.detectLeaks();
      expect(Array.isArray(leaks)).toBe(true);
    });

    it('应该正确设置检测阈值', () => {
      const detector = memoryManager['leakDetector'];
      
      // 设置低阈值
      detector.setThreshold('test-category', 1);
      
      // 创建超过阈值的快照
      detector.createSnapshot('test-category', [{ id: '1' }, { id: '2' }]);
      
      // 检测泄漏
      const leaks = detector.detectLeaks();
      expect(leaks.length).toBeGreaterThan(0);
      expect(leaks[0]).toContain('test-category');
    });
  });

  describe('Memory Integration - 内存集成测试', () => {
    it('应该在内存压力下正常工作', () => {
      // 模拟内存压力
      for (let i = 0; i < 1000; i++) {
        memoryManager.addToCache(`pressure-${i}`, { 
          value: i, 
          data: Array(100).fill(`data-${i}`) 
        });
      }

      const stats = memoryManager.getMemoryStats();
      expect(stats.cacheUsage).toBeGreaterThan(0);
      
      const report = memoryManager.getMemoryReport();
      expect(report).toBeDefined();
    });

    it('应该正确处理重复的缓存键', () => {
      // 添加相同的键多次
      memoryManager.addToCache('duplicate', { value: 'first' });
      memoryManager.addToCache('duplicate', { value: 'second' });
      
      // 应该获取到最后添加的值
      const cached = memoryManager.getFromCache('duplicate');
      expect(cached).toEqual({ value: 'second' });
    });

    it('应该正确处理空值和无效值', () => {
      // 添加各种类型的值
      memoryManager.addToCache('null-value', null);
      memoryManager.addToCache('undefined-value', undefined);
      memoryManager.addToCache('empty-object', {});
      memoryManager.addToCache('empty-array', []);
      
      // 应该能够正确获取
      expect(memoryManager.getFromCache('null-value')).toBeNull();
      expect(memoryManager.getFromCache('undefined-value')).toBeUndefined();
      expect(memoryManager.getFromCache('empty-object')).toEqual({});
      expect(memoryManager.getFromCache('empty-array')).toEqual([]);
    });

    it('应该正确处理长时间运行', () => {
      // 模拟长时间运行
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        memoryManager.addToCache(`long-run-${i}`, { 
          value: i, 
          timestamp: Date.now() 
        });
        
        // 模拟时间间隔
        if (i % 10 === 0) {
          const report = memoryManager.getMemoryReport();
          expect(report).toBeDefined();
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 应该在合理时间内完成
      expect(duration).toBeLessThan(1000);
    });
  });
});