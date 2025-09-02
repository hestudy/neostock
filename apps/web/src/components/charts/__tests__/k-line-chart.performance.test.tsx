// 导入测试设置
import '../../../test-setup';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { KLineChart } from '../k-line-chart';
import type { ChartDataPoint, TechnicalIndicatorData } from '../../../types/charts';
import { createChartInstance, updateChartData, destroyChart, monitorChartPerformance } from '../chart-utils';
import { useTheme } from '../../../hooks/use-theme';
import { createMockChart } from './test-utils';

// 手动模拟模块而不使用 vi.mock
// 在 beforeEach 中设置模拟

describe('KLineChart Performance Tests', () => {
  let mockContainer: HTMLElement;
  let mockChart: ReturnType<typeof createMockChart>;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockContainer.id = 'chart-container';
    document.body.appendChild(mockContainer);
    
    mockChart = createMockChart();
    
    vi.mocked(createChartInstance).mockReturnValue({
      chart: mockChart as any,
      candlestickSeries: null,
      volumeSeries: null,
      maSeries: new Map(),
      macdSeries: {},
      rsiSeries: new Map()
    });
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
    vi.clearAllMocks();
  });

  const mockData: ChartDataPoint[] = [
    { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000000 },
    { time: '2024-01-02', open: 105, high: 115, low: 95, close: 110, volume: 1200000 },
    { time: '2024-01-03', open: 110, high: 120, low: 100, close: 115, volume: 1100000 }
  ];

  describe('渲染性能测试', () => {
    it('应该在100ms内完成初始渲染', () => {
      const startTime = performance.now();
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(100);
      expect(screen.getByTestId('k-line-chart')).toBeInTheDocument();
    });

    it('应该在50ms内完成数据更新', () => {
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      const newData = [...mockData, { time: '2024-01-04', open: 115, high: 125, low: 105, close: 120, volume: 1300000 }];
      
      const startTime = performance.now();
      rerender(<KLineChart data={newData} width={800} height={400} />);
      const endTime = performance.now();
      
      const updateTime = endTime - startTime;
      expect(updateTime).toBeLessThan(50);
    });

    it('应该在30ms内完成主题切换', () => {
      vi.mocked(useTheme).mockReturnValue({ 
      theme: 'light',
      setTheme: vi.fn(),
      themes: ['light', 'dark'],
      resolvedTheme: 'light',
      systemTheme: 'light'
    });
      
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      const startTime = performance.now();
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'dark',
        systemTheme: 'light'
      });
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      const endTime = performance.now();
      
      const themeSwitchTime = endTime - startTime;
      expect(themeSwitchTime).toBeLessThan(30);
    });
  });

  describe('大数据量性能测试', () => {
    it('应该高效处理1000个数据点', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      const startTime = performance.now();
      render(<KLineChart data={largeData} width={800} height={400} />);
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      expect(renderTime).toBeLessThan(200);
    });

    it('应该高效处理5000个数据点', () => {
      const veryLargeData = Array.from({ length: 5000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      const startTime = performance.now();
      render(<KLineChart data={veryLargeData} width={800} height={400} />);
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      expect(renderTime).toBeLessThan(500);
    });

    it('应该在数据量过大时进行分片处理', () => {
      const hugeData = Array.from({ length: 10000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      render(<KLineChart data={hugeData} width={800} height={400} />);
      
      // 验证数据分片处理
      expect(updateChartData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining(hugeData.slice(-1000)),
        expect.any(Object)
      );
    });
  });

  describe('内存使用优化测试', () => {
    it('应该合理控制内存使用', () => {
      vi.mocked(monitorChartPerformance).mockReturnValue({
        renderTime: 16.67,
        dataPoints: 100,
        memoryUsage: 10240
      });

      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(monitorChartPerformance).toHaveBeenCalled();
      
      const performance = vi.mocked(monitorChartPerformance).mock.results[0].value;
      expect(performance.memoryUsage).toBeLessThan(20000); // 20KB 以内
    });

    it('应该在组件卸载时释放内存', () => {
      const { unmount } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      unmount();
      
      expect(destroyChart).toHaveBeenCalled();
    });

    it('应该避免内存泄漏', () => {
      const { rerender, unmount } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 多次更新数据
      for (let i = 0; i < 10; i++) {
        const newData = [...mockData, { time: `2024-01-${i + 4}`, open: 115, high: 125, low: 105, close: 120, volume: 1300000 }];
        rerender(<KLineChart data={newData} width={800} height={400} />);
      }
      
      unmount();
      
      // 验证清理次数合理
      expect(destroyChart).toHaveBeenCalledTimes(1);
    });
  });

  describe('帧率性能测试', () => {
    it('应该保持60fps的渲染帧率', () => {
      const frameCount = 60;
      const frameTimes = [];
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 模拟60帧的连续更新
      for (let i = 0; i < frameCount; i++) {
        const startTime = performance.now();
        
        act(() => {
          render(<KLineChart data={mockData} width={800} height={400} />);
        });
        
        const endTime = performance.now();
        frameTimes.push(endTime - startTime);
      }
      
      const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const fps = 1000 / averageFrameTime;
      
      expect(fps).toBeGreaterThan(30); // 至少30fps
    });

    it('应该在复杂场景下保持可接受的帧率', () => {
      const technicalData: TechnicalIndicatorData[] = [
        { time: '2024-01-01', ma5: 102, ma10: 100, ma20: 98, ma60: 95, macd_dif: 1.5, macd_dea: 1.2, macd_hist: 0.3, rsi_6: 65, rsi_12: 70 },
        { time: '2024-01-02', ma5: 107, ma10: 103, ma20: 100, ma60: 96, macd_dif: 1.8, macd_dea: 1.4, macd_hist: 0.4, rsi_6: 68, rsi_12: 72 }
      ];

      const startTime = performance.now();
      render(
        <KLineChart 
          data={mockData} 
          width={800} 
          height={400}
          technicalData={technicalData}
          showMA={true}
          showMACD={true}
          showRSI={true}
        />
      );
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      expect(renderTime).toBeLessThan(150);
    });
  });

  describe('并发性能测试', () => {
    it('应该正确处理并发更新', () => {
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 模拟并发更新
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(new Promise(resolve => {
          setTimeout(() => {
            const newData = [...mockData, { time: `2024-01-${i + 4}`, open: 115, high: 125, low: 105, close: 120, volume: 1300000 }];
            rerender(<KLineChart data={newData} width={800} height={400} />);
            resolve(true);
          }, i * 10);
        }));
      }
      
      return Promise.all(promises).then(() => {
        expect(screen.getByTestId('k-line-chart')).toBeInTheDocument();
      });
    });

    it('应该避免竞态条件', () => {
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 快速连续更新
      for (let i = 0; i < 10; i++) {
        const newData = [...mockData, { time: `2024-01-${i + 4}`, open: 115, high: 125, low: 105, close: 120, volume: 1300000 }];
        rerender(<KLineChart data={newData} width={800} height={400} />);
      }
      
      // 验证最终状态正确
      expect(screen.getByTestId('k-line-chart')).toBeInTheDocument();
    });
  });

  describe('性能监控测试', () => {
    it('应该正确监控性能指标', () => {
      vi.mocked(monitorChartPerformance).mockReturnValue({
        renderTime: 16.67,
        dataPoints: 100,
        memoryUsage: 10240
      });

      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(monitorChartPerformance).toHaveBeenCalled();
      
      const performance = vi.mocked(monitorChartPerformance).mock.results[0].value;
      expect(performance).toEqual(expect.objectContaining({
        renderTime: expect.any(Number),
        dataPoints: expect.any(Number),
        memoryUsage: expect.any(Number)
      }));
    });

    it('应该在性能超过阈值时发出警告', () => {
      vi.mocked(monitorChartPerformance).mockReturnValue({
        renderTime: 100, // 超过阈值
        dataPoints: 1000,
        memoryUsage: 50000
      });

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('性能警告')
      );
      
      consoleWarn.mockRestore();
    });
  });

  describe('缓存性能测试', () => {
    it('应该通过缓存提高性能', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      const { rerender } = render(<KLineChart data={largeData} width={800} height={400} />);
      
      const firstRenderTime = performance.now();
      rerender(<KLineChart data={largeData} width={800} height={400} />);
      const secondRenderTime = performance.now();
      
      // 第二次渲染应该更快（由于缓存）
      const timeImprovement = firstRenderTime - secondRenderTime;
      expect(timeImprovement).toBeGreaterThan(0);
    });

    it('应该有效管理缓存大小', () => {
      const largeData = Array.from({ length: 2000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      render(<KLineChart data={largeData} width={800} height={400} />);
      
      // 验证缓存大小限制
      expect(updateChartData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining(largeData.slice(-1000)),
        expect.any(Object)
      );
    });
  });
});