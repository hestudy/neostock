import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const vi = require('vitest');
import { render, screen, fireEvent, act } from '@testing-library/react';
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

vi.mock('../../hooks/use-stock-chart', () => ({
  useStockChart: vi.fn(() => ({
    data: [],
    loading: false,
    error: null,
    refetch: vi.fn()
  }))
}));

const mockCreateChart = vi.fn();
const mockChart = {
  addSeries: vi.fn(),
  removeSeries: vi.fn(),
  resize: vi.fn(),
  remove: vi.fn(),
  applyOptions: vi.fn()
};

describe('KLineChart Component', () => {
  let mockContainer: HTMLElement;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockContainer.id = 'chart-container';
    document.body.appendChild(mockContainer);
    
    mockCreateChart.mockReturnValue(mockChart);
    (require('lightweight-charts').createChart as any) = mockCreateChart;
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

    it('应该在加载状态时显示加载指示器', () => {
      vi.mocked(require('../../hooks/use-stock-chart').useStockChart).mockReturnValue({
        data: [],
        loading: true,
        error: null,
        refetch: vi.fn()
      });

      render(<KLineChart data={[]} width={800} height={400} />);
      
      expect(screen.getByTestId('chart-loading')).toBeInTheDocument();
    });

    it('应该在错误状态时显示错误信息', () => {
      vi.mocked(require('../../hooks/use-stock-chart').useStockChart).mockReturnValue({
        data: [],
        loading: false,
        error: '数据加载失败',
        refetch: vi.fn()
      });

      render(<KLineChart data={[]} width={800} height={400} />);
      
      expect(screen.getByText('数据加载失败')).toBeInTheDocument();
      expect(screen.getByText('重试')).toBeInTheDocument();
    });
  });

  describe('图表初始化', () => {
    it('应该在组件挂载时初始化图表', () => {
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(require('../chart-utils').createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 800,
          height: 400
        })
      );
    });

    it('应该在数据更新时更新图表', () => {
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      const newData = [...mockData, { 
        time: '2024-01-04', 
        open: 115, 
        high: 125, 
        low: 105, 
        close: 120, 
        volume: 1300000 
      }];
      
      rerender(<KLineChart data={newData} width={800} height={400} />);
      
      expect(require('../chart-utils').updateChartData).toHaveBeenCalled();
    });
  });

  describe('技术指标显示', () => {
    it('应该正确显示MA指标', () => {
      render(
        <KLineChart 
          data={mockData} 
          technicalData={mockTechnicalData}
          indicators={{ ma: [5, 10, 20] }}
          width={800} 
          height={400} 
        />
      );
      
      expect(require('../chart-utils').addMASeries).toHaveBeenCalledTimes(3);
    });

    it('应该正确显示MACD指标', () => {
      const macdData: TechnicalIndicatorData[] = [
        { time: '2024-01-01', macd_dif: 1.5, macd_dea: 1.2, macd_hist: 0.3 },
        { time: '2024-01-02', macd_dif: 1.8, macd_dea: 1.4, macd_hist: 0.4 }
      ];

      render(
        <KLineChart 
          data={mockData} 
          technicalData={macdData}
          indicators={{ macd: true }}
          width={800} 
          height={400} 
        />
      );
      
      expect(require('../chart-utils').addMACDSeries).toHaveBeenCalled();
    });

    it('应该正确显示RSI指标', () => {
      const rsiData: TechnicalIndicatorData[] = [
        { time: '2024-01-01', rsi_6: 65, rsi_12: 70 },
        { time: '2024-01-02', rsi_6: 70, rsi_12: 75 }
      ];

      render(
        <KLineChart 
          data={mockData} 
          technicalData={rsiData}
          indicators={{ rsi: [6, 12] }}
          width={800} 
          height={400} 
        />
      );
      
      expect(require('../chart-utils').addRSISeries).toHaveBeenCalledTimes(2);
    });
  });

  describe('交互功能', () => {
    it('应该支持十字光标显示', () => {
      render(
        <KLineChart 
          data={mockData} 
          crosshair={true}
          width={800} 
          height={400} 
        />
      );
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟鼠标移动
      fireEvent.mouseMove(chartContainer, { clientX: 100, clientY: 100 });
      
      // 验证十字光标配置
      expect(require('../chart-utils').createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          crosshair: expect.objectContaining({
            mode: expect.any(Number)
          })
        })
      );
    });

    it('应该支持图表缩放', () => {
      render(
        <KLineChart 
          data={mockData} 
          zoom={true}
          width={800} 
          height={400} 
        />
      );
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟滚轮缩放
      fireEvent.wheel(chartContainer, { deltaY: -100 });
      
      // 验证图表配置支持缩放
      expect(require('../chart-utils').createChartInstance).toHaveBeenCalled();
    });
  });

  describe('主题切换', () => {
    it('应该响应主题变化', () => {
      vi.mocked(require('../../hooks/use-theme').useTheme).mockReturnValue({
        theme: 'dark'
      });

      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(require('../chart-utils').applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'dark'
      );
    });

    it('应该在主题切换时更新图表样式', () => {
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 模拟主题切换
      vi.mocked(require('../../hooks/use-theme').useTheme).mockReturnValue({
        theme: 'dark'
      });
      
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(require('../chart-utils').applyTheme).toHaveBeenCalledTimes(2);
    });
  });

  describe('响应式设计', () => {
    it('应该响应窗口大小变化', () => {
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 模拟窗口大小变化
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      
      expect(require('../chart-utils').resizeChart).toHaveBeenCalled();
    });

    it('应该支持自适应大小', () => {
      render(
        <KLineChart 
          data={mockData} 
          responsive={true}
          width={800} 
          height={400} 
        />
      );
      
      // 验证响应式配置
      expect(screen.getByTestId('k-line-chart')).toBeInTheDocument();
    });
  });

  describe('性能优化', () => {
    it('应该支持数据分页加载', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      render(
        <KLineChart 
          data={largeData} 
          performance={{ maxDataPoints: 500 }}
          width={800} 
          height={400} 
        />
      );
      
      // 验证性能配置
      expect(require('../chart-utils').updateChartData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        expect.objectContaining({
          maxDataPoints: 500
        })
      );
    });

    it('应该启用数据缓存', () => {
      render(
        <KLineChart 
          data={mockData} 
          performance={{ enableCache: true }}
          width={800} 
          height={400} 
        />
      );
      
      // 验证缓存配置
      expect(require('../chart-utils').updateChartData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        expect.objectContaining({
          enableCache: true
        })
      );
    });
  });

  describe('事件处理', () => {
    it('应该支持点击事件', () => {
      const handleClick = vi.fn();
      
      render(
        <KLineChart 
          data={mockData} 
          onClick={handleClick}
          width={800} 
          height={400} 
        />
      );
      
      const chartContainer = screen.getByTestId('k-line-chart');
      fireEvent.click(chartContainer);
      
      expect(handleClick).toHaveBeenCalled();
    });

    it('应该支持鼠标悬停事件', () => {
      const handleMouseOver = vi.fn();
      
      render(
        <KLineChart 
          data={mockData} 
          onMouseOver={handleMouseOver}
          width={800} 
          height={400} 
        />
      );
      
      const chartContainer = screen.getByTestId('k-line-chart');
      fireEvent.mouseOver(chartContainer);
      
      expect(handleMouseOver).toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该处理无效数据', () => {
      const invalidData = [
        { time: '2024-01-01', open: NaN, high: 110, low: 90, close: 105 },
        { time: '2024-01-02', open: 105, high: Infinity, low: 95, close: 110 }
      ];

      expect(() => {
        render(<KLineChart data={invalidData} width={800} height={400} />);
      }).not.toThrow();
    });

    it('应该处理图表创建失败', () => {
      mockCreateChart.mockImplementation(() => {
        throw new Error('Chart creation failed');
      });

      expect(() => {
        render(<KLineChart data={mockData} width={800} height={400} />);
      }).not.toThrow();
    });
  });

  describe('无障碍访问', () => {
    it('应该提供适当的ARIA标签', () => {
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      expect(chartContainer).toHaveAttribute('role', 'img');
      expect(chartContainer).toHaveAttribute('aria-label', 'K线图表');
    });

    it('应该支持键盘导航', () => {
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟键盘事件
      fireEvent.keyDown(chartContainer, { key: 'ArrowLeft' });
      fireEvent.keyDown(chartContainer, { key: 'ArrowRight' });
      
      // 验证组件能够处理键盘事件
      expect(chartContainer).toBeInTheDocument();
    });
  });
});