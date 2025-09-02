// 导入测试设置
import '../../../test-setup';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { KLineChart } from '../k-line-chart';
import type { ChartDataPoint, TechnicalIndicatorData } from '../../../types/charts';
import { createChartInstance, updateChartData, addMASeries, addMACDSeries, addRSISeries, removeTechnicalIndicator, resizeChart, destroyChart, applyTheme, monitorChartPerformance } from '../chart-utils';
import { useTheme } from '../../../hooks/use-theme';
import { useStockChart } from '../../../hooks/use-stock-chart';
import { createMockChart, createMockSeries } from './test-utils';

// 手动模拟模块而不使用 vi.mock
// 在 beforeEach 中设置模拟

const mockCreateChart = vi.fn();
const mockChart = createMockChart();

describe('KLineChart Component', () => {
  let mockContainer: HTMLElement;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockContainer.id = 'chart-container';
    document.body.appendChild(mockContainer);
    
    mockCreateChart.mockReturnValue(mockChart);
    // Mock the lightweight-charts createChart function
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

  const mockTechnicalData: TechnicalIndicatorData[] = [
    { time: '2024-01-01', ma5: 102, ma10: 100, ma20: 98, ma60: 95 },
    { time: '2024-01-02', ma5: 107, ma10: 103, ma20: 100, ma60: 96 },
    { time: '2024-01-03', ma5: 110, ma10: 105, ma20: 102, ma60: 97 }
  ];

  describe('基础渲染', () => {
    it('应该正确渲染图表容器', () => {
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      expect(chartContainer).toBeInTheDocument();
      expect(chartContainer).toHaveStyle({ width: '800px', height: '400px' });
    });

    it('应该在数据为空时显示空状态', () => {
      render(<KLineChart data={[]} width={800} height={400} />);
      
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
    });

    it('应该显示加载状态', () => {
      vi.mocked(useStockChart).mockReturnValue({
        data: [],
        loading: true,
        error: null,
        refetch: vi.fn()
      });

      render(<KLineChart data={[]} width={800} height={400} />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('应该显示错误状态', () => {
      vi.mocked(useStockChart).mockReturnValue({
        data: [],
        loading: false,
        error: '数据加载失败',
        refetch: vi.fn()
      });

      render(<KLineChart data={[]} width={800} height={400} />);
      
      expect(screen.getByText('数据加载失败')).toBeInTheDocument();
    });
  });

  describe('图表创建和销毁', () => {
    it('应该正确创建图表实例', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 800,
          height: 400
        })
      );
    });

    it('应该在组件卸载时销毁图表', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      const { unmount } = render(<KLineChart data={mockData} width={800} height={400} />);
      unmount();
      
      expect(destroyChart).toHaveBeenCalled();
    });
  });

  describe('数据更新', () => {
    it('应该正确更新图表数据', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(updateChartData).toHaveBeenCalled();
    });

    it('应该在数据变化时更新图表', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      const newData = [...mockData, { time: '2024-01-04', open: 115, high: 125, low: 105, close: 120, volume: 1300000 }];
      rerender(<KLineChart data={newData} width={800} height={400} />);
      
      expect(updateChartData).toHaveBeenCalledTimes(2);
    });
  });

  describe('技术指标', () => {
    it('应该正确添加移动平均线', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      render(
        <KLineChart 
          data={mockData} 
          width={800} 
          height={400} 
          technicalData={mockTechnicalData}
          showMA={true}
          maPeriods={[5, 10, 20]}
        />
      );
      
      expect(addMASeries).toHaveBeenCalledTimes(3);
    });

    it('应该正确添加MACD指标', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      render(
        <KLineChart 
          data={mockData} 
          width={800} 
          height={400} 
          technicalData={mockTechnicalData}
          showMACD={true}
        />
      );
      
      expect(addMACDSeries).toHaveBeenCalled();
    });

    it('应该正确添加RSI指标', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      render(
        <KLineChart 
          data={mockData} 
          width={800} 
          height={400} 
          technicalData={mockTechnicalData}
          showRSI={true}
          rsiPeriods={[6, 12]}
        />
      );
      
      expect(addRSISeries).toHaveBeenCalledTimes(2);
    });

    it('应该正确移除技术指标', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      const { rerender } = render(
        <KLineChart 
          data={mockData} 
          width={800} 
          height={400} 
          technicalData={mockTechnicalData}
          showMA={true}
          maPeriods={[5, 10, 20]}
        />
      );
      
      rerender(
        <KLineChart 
          data={mockData} 
          width={800} 
          height={400} 
          technicalData={mockTechnicalData}
          showMA={false}
          maPeriods={[5, 10, 20]}
        />
      );
      
      expect(removeTechnicalIndicator).toHaveBeenCalledWith(
        expect.any(Object),
        'ma'
      );
    });
  });

  describe('主题切换', () => {
    it('应该支持主题切换', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'dark',
        systemTheme: 'light'
      });

      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'dark'
      );
    });

    it('应该在主题变化时更新图表', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'light',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'light',
        systemTheme: 'light'
      });

      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'dark',
        systemTheme: 'light'
      });
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(applyTheme).toHaveBeenCalledTimes(2);
    });
  });

  describe('响应式设计', () => {
    it('应该支持窗口大小调整', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 模拟窗口大小调整
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      
      expect(resizeChart).toHaveBeenCalled();
    });

    it('应该支持自定义宽高', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      render(<KLineChart data={mockData} width={600} height={300} />);
      
      expect(createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 600,
          height: 300
        })
      );
    });
  });

  describe('性能优化', () => {
    it('应该支持数据分片加载', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      const largeData = Array.from({ length: 2000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      render(<KLineChart data={largeData} width={800} height={400} />);
      
      expect(updateChartData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining(largeData.slice(-1000)),
        expect.any(Object)
      );
    });

    it('应该支持性能监控', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      vi.mocked(monitorChartPerformance).mockReturnValue({
        renderTime: 16.67,
        dataPoints: 100,
        memoryUsage: 10240
      });

      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(monitorChartPerformance).toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该处理图表创建失败', () => {
      vi.mocked(createChartInstance).mockImplementation(() => {
        throw new Error('图表创建失败');
      });

      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(screen.getByText('图表创建失败')).toBeInTheDocument();
    });

    it('应该处理数据更新失败', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      vi.mocked(updateChartData).mockImplementation(() => {
        throw new Error('数据更新失败');
      });

      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(screen.getByText('数据更新失败')).toBeInTheDocument();
    });

    it('应该处理技术指标添加失败', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      vi.mocked(addMASeries).mockImplementation(() => {
        throw new Error('技术指标添加失败');
      });

      render(
        <KLineChart 
          data={mockData} 
          width={800} 
          height={400} 
          technicalData={mockTechnicalData}
          showMA={true}
          maPeriods={[5, 10, 20]}
        />
      );
      
      expect(screen.getByText('技术指标添加失败')).toBeInTheDocument();
    });
  });

  describe('事件处理', () => {
    it('应该支持图表点击事件', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      const handleClick = vi.fn();
      render(<KLineChart data={mockData} width={800} height={400} onChartClick={handleClick} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      fireEvent.click(chartContainer);
      
      expect(handleClick).toHaveBeenCalled();
    });

    it('应该支持图表悬停事件', () => {
      vi.mocked(createChartInstance).mockReturnValue({
        chart: mockChart as any,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: new Map(),
        macdSeries: {},
        rsiSeries: new Map()
      });

      const handleHover = vi.fn();
      render(<KLineChart data={mockData} width={800} height={400} onChartHover={handleHover} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      fireEvent.mouseOver(chartContainer);
      
      expect(handleHover).toHaveBeenCalled();
    });
  });
});