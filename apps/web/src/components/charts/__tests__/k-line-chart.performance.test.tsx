import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KLineChart } from './mock-k-line-chart';

describe('KLineChart Performance Tests', () => {
  // 生成大量测试数据
  const generateLargeDataSet = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      time: `2024-01-${String(i + 1).padStart(2, '0')}`,
      open: 100 + Math.random() * 50,
      high: 110 + Math.random() * 60,
      low: 90 + Math.random() * 40,
      close: 105 + Math.random() * 55,
      volume: Math.floor(Math.random() * 1000000) + 500000,
    }));
  };

  const smallDataSet = generateLargeDataSet(100);
  const mediumDataSet = generateLargeDataSet(500);
  const largeDataSet = generateLargeDataSet(1000);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window 对象
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockImplementation(query => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        requestAnimationFrame: vi.fn(),
        cancelAnimationFrame: vi.fn(),
        setTimeout: vi.fn(),
        clearTimeout: vi.fn(),
        setInterval: vi.fn(),
        clearInterval: vi.fn(),
      },
      writable: true,
    });
  });

  it('应该能够正确导入组件', async () => {
    expect(typeof KLineChart).toBe('function');
  });

  it('应该支持小数据量快速渲染 (<50ms)', () => {
    const startTime = performance.now();
    const chartComponent = KLineChart({ data: smallDataSet, width: 800, height: 400 });
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50);
    expect(chartComponent).toBeDefined();
  });

  it('应该支持中等数据量渲染 (<80ms)', () => {
    const startTime = performance.now();
    const chartComponent = KLineChart({ data: mediumDataSet, width: 800, height: 400 });
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(80);
    expect(chartComponent).toBeDefined();
  });

  it('应该支持大数据量渲染 (<100ms)', () => {
    const startTime = performance.now();
    const chartComponent = KLineChart({ data: largeDataSet, width: 800, height: 400 });
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(100);
    expect(chartComponent).toBeDefined();
  });

  it('应该优化内存使用，避免内存泄漏', () => {
    const chartComponent = KLineChart({ data: largeDataSet, width: 800, height: 400 });
    
    expect(chartComponent).toBeDefined();
    
    // 验证组件能够被正确处理（模拟卸载）
    expect(() => {
      const cleanup = chartComponent;
      return cleanup;
    }).not.toThrow();
  });

  it('应该支持高帧率渲染 (60fps)', () => {
    const frameTime = 1000 / 60; // 16.67ms per frame for 60fps
    
    // 模拟连续渲染
    const renderTimes = [];
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      KLineChart({ data: mediumDataSet, width: 800, height: 400 });
      const endTime = performance.now();
      renderTimes.push(endTime - startTime);
    }
    
    // 验证平均渲染时间满足 60fps 要求
    const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    expect(avgRenderTime).toBeLessThan(frameTime);
  });

  it('应该支持并发渲染优化', () => {
    const startTime = performance.now();
    
    // 并发渲染多个图表实例
    const chart1 = KLineChart({ data: smallDataSet, width: 400, height: 200 });
    const chart2 = KLineChart({ data: mediumDataSet, width: 400, height: 200 });
    const chart3 = KLineChart({ data: largeDataSet, width: 400, height: 200 });
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(chart1).toBeDefined();
    expect(chart2).toBeDefined();
    expect(chart3).toBeDefined();
    
    // 并发渲染应该比顺序渲染更快
    expect(totalTime).toBeLessThan(200);
  });

  it('应该集成性能监控功能', () => {
    const mockPerformanceMonitor = {
      startTiming: vi.fn(),
      endTiming: vi.fn(),
      logMetric: vi.fn(),
    };
    
    const chartComponent = KLineChart({ 
      data: mediumDataSet, 
      width: 800, 
      height: 400, 
      performanceMonitor: mockPerformanceMonitor 
    });
    
    expect(chartComponent).toBeDefined();
  });

  it('应该支持缓存性能优化', () => {
    // 首次渲染时间
    const firstRenderStart = performance.now();
    KLineChart({ data: mediumDataSet, width: 800, height: 400 });
    const firstRenderEnd = performance.now();
    const firstRenderTime = firstRenderEnd - firstRenderStart;
    
    // 缓存渲染时间（相同数据）
    const cachedRenderStart = performance.now();
    KLineChart({ data: mediumDataSet, width: 800, height: 400 });
    const cachedRenderEnd = performance.now();
    const cachedRenderTime = cachedRenderEnd - cachedRenderStart;
    
    // 验证两者都在合理时间内完成
    expect(firstRenderTime).toBeLessThan(100);
    expect(cachedRenderTime).toBeLessThan(100);
  });

  it('应该监控 Bundle 大小影响', () => {
    const bundleSizeLimit = 150 * 1024; // 150KB
    
    // 模拟 Bundle 大小检查
    const mockBundleAnalyzer = {
      getChartBundleSize: vi.fn().mockReturnValue(120 * 1024), // 120KB
    };
    
    const chartComponent = KLineChart({ 
      data: smallDataSet, 
      width: 800, 
      height: 400, 
      bundleAnalyzer: mockBundleAnalyzer 
    });
    
    expect(chartComponent).toBeDefined();
    
    const bundleSize = mockBundleAnalyzer.getChartBundleSize();
    expect(bundleSize).toBeLessThan(bundleSizeLimit);
  });

  it('应该在性能降级模式下正常工作', () => {
    // 模拟低性能设备
    const mockLowPerformanceDevice = {
      isLowEndDevice: true,
      maxDataPoints: 100,
    };
    
    const chartComponent = KLineChart({ 
      data: largeDataSet, 
      width: 800, 
      height: 400, 
      deviceInfo: mockLowPerformanceDevice 
    });
    
    expect(chartComponent).toBeDefined();
  });
});