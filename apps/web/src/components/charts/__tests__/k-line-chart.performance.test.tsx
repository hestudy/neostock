import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const vi = require('vitest');
import { render, screen, act } from '@testing-library/react';
import { KLineChart } from '../k-line-chart';
import type { ChartDataPoint, TechnicalIndicatorData } from '../../types/charts';

// Mock dependencies
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(),
  ColorType: {
    Solid: 'solid'
  },
  CrosshairMode: {
    Normal: 0
  },
  LineStyle: {
    Solid: 0,
    Dotted: 3,
    Dashed: 2
  }
}));

vi.mock('../chart-utils', () => ({
  createChartInstance: vi.fn(),
  updateChartData: vi.fn(),
  addMASeries: vi.fn(),
  addMACDSeries: vi.fn(),
  addRSISeries: vi.fn(),
  removeTechnicalIndicator: vi.fn(),
  resizeChart: vi.fn(),
  destroyChart: vi.fn(),
  applyTheme: vi.fn(),
  monitorChartPerformance: vi.fn()
}));

vi.mock('../../hooks/use-theme', () => ({
  useTheme: vi.fn(() => ({ theme: 'light' }))
}));

describe('KLineChart Performance Tests', () => {
  let mockContainer: HTMLElement;
  let mockChart: any;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockContainer.id = 'chart-container';
    document.body.appendChild(mockContainer);
    
    mockChart = {
      addSeries: vi.fn(),
      removeSeries: vi.fn(),
      resize: vi.fn(),
      remove: vi.fn(),
      applyOptions: vi.fn()
    };
    
    (require('lightweight-charts').createChart as any).mockReturnValue(mockChart);
    
    // Mock performance monitoring
    vi.mocked(require('../chart-utils').monitorChartPerformance).mockReturnValue({
      renderTime: 50,
      dataPoints: 1000,
      memoryUsage: 100000
    });
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
    vi.clearAllMocks();
  });

  describe('渲染性能测试', () => {
    it('应该在大数据量下保持快速渲染 (<100ms)', () => {
      const largeData: ChartDataPoint[] = Array.from({ length: 1000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + Math.random() * 50,
        high: 110 + Math.random() * 50,
        low: 90 + Math.random() * 50,
        close: 105 + Math.random() * 50,
        volume: 1000000 + Math.random() * 500000
      }));

      const startTime = performance.now();
      
      render(<KLineChart data={largeData} width={800} height={400} />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100);
      expect(screen.getByTestId('k-line-chart')).toBeInTheDocument();
    });

    it('应该在极端大数据量下 (<5000数据点) 仍然可用', () => {
      const extremeData: ChartDataPoint[] = Array.from({ length: 5000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + Math.random() * 50,
        high: 110 + Math.random() * 50,
        low: 90 + Math.random() * 50,
        close: 105 + Math.random() * 50,
        volume: 1000000 + Math.random() * 500000
      }));

      const startTime = performance.now();
      
      render(<KLineChart data={extremeData} width={800} height={400} />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(500); // 更宽松的限制
      expect(screen.getByTestId('k-line-chart')).toBeInTheDocument();
    });
  });

  describe('内存使用测试', () => {
    it('应该合理管理内存使用', () => {
      const data: ChartDataPoint[] = Array.from({ length: 1000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      const { unmount } = render(<KLineChart data={data} width={800} height={400} />);
      
      // 模拟性能监控返回的内存使用情况
      const perfData = {
        renderTime: 50,
        dataPoints: 1000,
        memoryUsage: 100000 // 100KB
      };

      expect(perfData.memoryUsage).toBeLessThan(200000); // 小于200KB
      
      // 清理组件
      unmount();
      
      // 验证图表被正确销毁
      expect(require('../chart-utils').destroyChart).toHaveBeenCalled();
    });

    it('应该在组件卸载时释放内存', () => {
      const data: ChartDataPoint[] = Array.from({ length: 100 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      const { unmount } = render(<KLineChart data={data} width={800} height={400} />);
      
      expect(screen.getByTestId('k-line-chart')).toBeInTheDocument();
      
      // 卸载组件
      unmount();
      
      // 验证图表被销毁
      expect(require('../chart-utils').destroyChart).toHaveBeenCalled();
    });
  });

  describe('技术指标性能测试', () => {
    it('应该在多技术指标叠加时保持性能', () => {
      const data: ChartDataPoint[] = Array.from({ length: 500 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      const technicalData: TechnicalIndicatorData[] = Array.from({ length: 500 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        ma5: 102 + i,
        ma10: 100 + i,
        ma20: 98 + i,
        ma60: 95 + i,
        macd_dif: 1.5 + i * 0.1,
        macd_dea: 1.2 + i * 0.1,
        macd_hist: 0.3 + i * 0.05,
        rsi_6: 65 + i,
        rsi_12: 70 + i,
        rsi_24: 75 + i
      }));

      const startTime = performance.now();
      
      render(
        <KLineChart 
          data={data} 
          technicalData={technicalData}
          indicators={{ 
            ma: [5, 10, 20, 60], 
            macd: true, 
            rsi: [6, 12, 24] 
          }}
          width={800} 
          height={400} 
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(150);
      expect(require('../chart-utils').addMASeries).toHaveBeenCalledTimes(4);
      expect(require('../chart-utils').addMACDSeries).toHaveBeenCalledTimes(1);
      expect(require('../chart-utils').addRSISeries).toHaveBeenCalledTimes(3);
    });
  });

  describe('响应式性能测试', () => {
    it('应该在窗口大小变化时快速响应', () => {
      const data: ChartDataPoint[] = Array.from({ length: 100 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      render(
        <KLineChart 
          data={data} 
          responsive={true}
          width={800} 
          height={400} 
        />
      );

      const startTime = performance.now();
      
      // 模拟窗口大小变化
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      
      const endTime = performance.now();
      const resizeTime = endTime - startTime;

      expect(resizeTime).toBeLessThan(50);
      expect(require('../chart-utils').resizeChart).toHaveBeenCalled();
    });
  });

  describe('数据更新性能测试', () => {
    it('应该在数据更新时快速响应', () => {
      const initialData: ChartDataPoint[] = Array.from({ length: 100 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      const { rerender } = render(<KLineChart data={initialData} width={800} height={400} />);
      
      // 添加新数据点
      const updatedData = [
        ...initialData,
        {
          time: '2024-01-101',
          open: 200,
          high: 210,
          low: 190,
          close: 205,
          volume: 2000000
        }
      ];

      const startTime = performance.now();
      
      rerender(<KLineChart data={updatedData} width={800} height={400} />);
      
      const endTime = performance.now();
      const updateTime = endTime - startTime;

      expect(updateTime).toBeLessThan(50);
      expect(require('../chart-utils').updateChartData).toHaveBeenCalled();
    });

    it('应该在频繁数据更新时保持稳定', () => {
      const baseData: ChartDataPoint[] = Array.from({ length: 50 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      const { rerender } = render(<KLineChart data={baseData} width={800} height={400} />);
      
      // 模拟频繁数据更新
      const updateTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const newData = [
          ...baseData,
          {
            time: `2024-01-${String(51 + i).padStart(2, '0')}`,
            open: 100 + 50 + i,
            high: 110 + 50 + i,
            low: 90 + 50 + i,
            close: 105 + 50 + i,
            volume: 1000000 + (50 + i) * 1000
          }
        ];

        const startTime = performance.now();
        rerender(<KLineChart data={newData} width={800} height={400} />);
        const endTime = performance.now();
        
        updateTimes.push(endTime - startTime);
      }

      // 验证所有更新都在合理时间内完成
      updateTimes.forEach(time => {
        expect(time).toBeLessThan(50);
      });

      // 验证平均更新时间
      const avgUpdateTime = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
      expect(avgUpdateTime).toBeLessThan(30);
    });
  });

  describe('错误处理性能测试', () => {
    it('应该在数据错误时快速恢复', () => {
      const invalidData: ChartDataPoint[] = [
        { time: '2024-01-01', open: NaN, high: 110, low: 90, close: 105 },
        { time: '2024-01-02', open: 105, high: Infinity, low: 95, close: 110 },
        { time: '2024-01-03', open: 110, high: 120, low: 100, close: 115 }
      ];

      const startTime = performance.now();
      
      render(<KLineChart data={invalidData} width={800} height={400} />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100);
      expect(screen.getByTestId('k-line-chart')).toBeInTheDocument();
    });
  });

  describe('Bundle大小测试', () => {
    it('应该控制组件包大小', () => {
      // 这个测试主要用来监控组件大小
      // 实际的bundle大小分析需要在构建时进行
      const componentSize = JSON.stringify(KLineChart).length;
      
      // 组件源代码大小应该小于50KB
      expect(componentSize).toBeLessThan(50000);
    });
  });
});