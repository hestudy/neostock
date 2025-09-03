import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor, SmartCacheManager } from '../../../lib/chart-performance-optimization';
import { OptimizedMultiIndicatorLayoutManager } from '../../../lib/optimized-multi-indicator-layout-manager';

// 导入测试设置
import '../../../test-setup';

describe('Chart Performance Optimization - Simplified Tests', () => {
  describe('PerformanceMonitor - 性能监控器', () => {
    let performanceMonitor: PerformanceMonitor;

    beforeEach(() => {
      performanceMonitor = new PerformanceMonitor();
    });

    afterEach(() => {
      performanceMonitor.reset();
    });

    it('应该正确记录性能指标', () => {
      performanceMonitor.recordMetric('renderTime', 16);
      performanceMonitor.recordMetric('renderTime', 20);
      performanceMonitor.recordMetric('renderTime', 12);
      
      const stats = performanceMonitor.getStats('renderTime');
      expect(stats).toBeDefined();
      expect(stats?.average).toBe(16); // (16 + 20 + 12) / 3
      expect(stats?.min).toBe(12);
      expect(stats?.max).toBe(20);
      expect(stats?.count).toBe(3);
    });

    it('应该正确判断性能健康状态', () => {
      // 健康的性能
      performanceMonitor.recordMetric('renderTime', 10);
      expect(performanceMonitor.isPerformanceHealthy('renderTime')).toBe(true);
      
      // 不健康的性能（超过16ms阈值）
      performanceMonitor.recordMetric('renderTime', 25);
      expect(performanceMonitor.isPerformanceHealthy('renderTime')).toBe(false);
    });

    it('应该生成正确的性能报告', () => {
      performanceMonitor.recordMetric('renderTime', 10);
      performanceMonitor.recordMetric('memoryUsage', 30 * 1024 * 1024); // 30MB
      
      const report = performanceMonitor.getPerformanceReport();
      
      expect(report.overall).toBe(true);
      expect(report.metrics.renderTime.healthy).toBe(true);
      expect(report.metrics.memoryUsage.healthy).toBe(true);
    });

    it('应该处理没有数据的情况', () => {
      const stats = performanceMonitor.getStats('nonexistent');
      expect(stats).toBeNull();
      
      const healthy = performanceMonitor.isPerformanceHealthy('nonexistent');
      expect(healthy).toBe(true);
    });

    it('应该正确重置指标', () => {
      performanceMonitor.recordMetric('renderTime', 16);
      expect(performanceMonitor.getStats('renderTime')).toBeDefined();
      
      performanceMonitor.reset();
      expect(performanceMonitor.getStats('renderTime')).toBeNull();
    });
  });

  describe('SmartCacheManager - 智能缓存管理器', () => {
    let cacheManager: SmartCacheManager;

    beforeEach(() => {
      cacheManager = new SmartCacheManager(10, 1000); // 10个项目，1秒TTL
    });

    afterEach(() => {
      cacheManager.clear();
    });

    it('应该正确存储和获取缓存数据', () => {
      const testData = { value: 'test' };
      cacheManager.set('test', { id: 1 }, testData);
      
      const cached = cacheManager.get('test', { id: 1 });
      expect(cached).toEqual(testData);
    });

    it('应该正确处理缓存未命中', () => {
      const cached = cacheManager.get('nonexistent', { id: 1 });
      expect(cached).toBeNull();
    });

    it('应该正确计算缓存命中率', () => {
      // 设置缓存
      cacheManager.set('test', { id: 1 }, { value: 'test' });
      
      // 命中
      cacheManager.get('test', { id: 1 });
      
      // 未命中
      cacheManager.get('nonexistent', { id: 1 });
      
      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBe(0.5); // 1 hit / 2 total
      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(1);
    });

    it('应该正确清空缓存', () => {
      cacheManager.set('test', { id: 1 }, { value: 'test' });
      expect(cacheManager.getStats().size).toBe(1);
      
      cacheManager.clear();
      expect(cacheManager.getStats().size).toBe(0);
      expect(cacheManager.getStats().hitCount).toBe(0);
      expect(cacheManager.getStats().missCount).toBe(0);
    });
  });

  describe('OptimizedMultiIndicatorLayoutManager - 优化的多指标布局管理器', () => {
    let layoutManager: OptimizedMultiIndicatorLayoutManager;
    let mockContainer: {
      style: {
        display: string;
        width: string;
        height: string;
      };
      appendChild: (child: Element) => void;
      removeChild: (child: Element) => void;
      querySelector: (selector: string) => Element | null;
      querySelectorAll: (selector: string) => NodeListOf<Element>;
      getAttribute: (name: string) => string | null;
      setAttribute: (name: string, value: string) => void;
    };

    beforeEach(() => {
      // 创建模拟容器
      mockContainer = {
        style: {
          display: '',
          width: '',
          height: '',
        },
        appendChild: () => {},
        removeChild: () => {},
        querySelector: () => null,
        querySelectorAll: () => ({
          length: 0,
          item: vi.fn(),
          forEach: vi.fn(),
          entries: vi.fn(),
          keys: vi.fn(),
          values: vi.fn()
        } as unknown as NodeListOf<Element>),
        getAttribute: () => null,
        setAttribute: () => {},
      };

      // 模拟document环境
      global.document = {
        createElement: () => mockContainer,
        body: { appendChild: () => {} },
      } as unknown as Document;

      layoutManager = new OptimizedMultiIndicatorLayoutManager();
    });

    afterEach(() => {
      layoutManager.destroy();
    });

    it('应该正确初始化优化的布局管理器', () => {
      expect(layoutManager).toBeDefined();
      expect(layoutManager['virtualizationManager']).toBeDefined();
      expect(layoutManager['performanceMonitor']).toBeDefined();
      expect(layoutManager['cacheManager']).toBeDefined();
    });

    it('应该支持性能配置', () => {
      const config = {
        virtualization: {
          visibleDataPoints: 100,
          preloadDataPoints: 25,
          chunkSize: 50,
          enabled: true,
          scrollThreshold: 25,
          renderDelay: 16,
        },
        enablePerformanceMonitoring: true,
        enableSmartCaching: true,
        rendering: {
          enableDebouncing: true,
          debounceDelay: 32,
        },
      };

      const optimizedLayout = new OptimizedMultiIndicatorLayoutManager(config);
      expect((optimizedLayout as unknown as { config: { virtualization?: { visibleDataPoints: number } } })['config'].virtualization?.visibleDataPoints).toBe(100);
      expect((optimizedLayout as unknown as { config: { enablePerformanceMonitoring: boolean } })['config'].enablePerformanceMonitoring).toBe(true);
      optimizedLayout.destroy();
    });

    it('应该获取性能指标', () => {
      const metrics = layoutManager.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.renderTime).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.visibleIndicators).toBeGreaterThanOrEqual(0);
    });

    it('应该生成性能报告', () => {
      const report = layoutManager.getPerformanceReport();
      expect(report).toBeDefined();
      expect(report.healthy).toBe(true);
      expect(report.metrics).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('应该处理滚动事件', () => {
      expect(() => {
        layoutManager.handleScroll(500);
      }).not.toThrow();
    });

    it('应该正确更新配置', () => {
      layoutManager.updateConfig({
        maxVisibleIndicators: 2,
        virtualization: {
          visibleDataPoints: 150,
          preloadDataPoints: 37,
          chunkSize: 75,
          enabled: true,
          scrollThreshold: 37,
          renderDelay: 16,
        },
      });

      expect(layoutManager['config'].maxVisibleIndicators).toBe(2);
    });

    it('应该正确销毁资源', () => {
      const spy = vi.spyOn(layoutManager['virtualizationManager'], 'destroy');
      const cacheSpy = vi.spyOn(layoutManager['cacheManager'], 'clear');
      
      layoutManager.destroy();
      
      expect(spy).toHaveBeenCalled();
      expect(cacheSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Integration - 性能集成测试', () => {
    it('应该在频繁更新时保持稳定', () => {
      const performanceMonitor = new PerformanceMonitor();
      
      // 模拟频繁的性能指标记录
      for (let i = 0; i < 100; i++) {
        performanceMonitor.recordMetric('renderTime', Math.random() * 20);
      }

      const stats = performanceMonitor.getStats('renderTime');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(100);
      expect(stats?.average).toBeGreaterThan(0);
      expect(stats?.average).toBeLessThan(20);
    });

    it('应该在缓存压力下正常工作', () => {
      const cacheManager = new SmartCacheManager(5, 1000); // 很小的缓存
      
      // 快速添加大量缓存项
      for (let i = 0; i < 20; i++) {
        cacheManager.set(`item${i}`, { id: i }, { value: i });
      }

      const stats = cacheManager.getStats();
      expect(stats.size).toBeLessThanOrEqual(5);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });

    it('应该在大数据量设置时保持良好性能', () => {
      const layoutManager = new OptimizedMultiIndicatorLayoutManager();
      
      // 创建大量数据
      const largeData = Array.from({ length: 5000 }, (_, i) => ({
        time: new Date(2024, 0, i + 1).toISOString(),
        open: 10 + Math.random(),
        high: 10 + Math.random() + 0.5,
        low: 10 + Math.random() - 0.5,
        close: 10 + Math.random(),
        volume: Math.floor(Math.random() * 1000000),
      }));

      const startTime = performance.now();
      layoutManager.setFullData(largeData, []);
      const endTime = performance.now();

      const setupTime = endTime - startTime;
      expect(setupTime).toBeLessThan(100); // 设置时间应该小于100ms

      layoutManager.destroy();
    });
  });
});

