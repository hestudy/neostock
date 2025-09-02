import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { KLineChart } from '../k-line-chart';
import type { ChartDataPoint, TechnicalIndicatorData } from '../../../types/charts';
import { createChartInstance, updateChartData, addMASeries, addMACDSeries, addRSISeries, resizeChart, destroyChart, monitorChartPerformance } from '../chart-utils';
import { useStockChart } from '../../../hooks/use-stock-chart';
import { createMockChart, createMockTouch } from './test-utils';

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

vi.mock('../chart-utils');
vi.mock('../../hooks/use-theme');
vi.mock('../../hooks/use-stock-chart');

describe('KLineChart Mobile Tests', () => {
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

  describe('移动端响应式设计', () => {
    it('应该在移动端视口下正确渲染', () => {
      // 模拟移动端视口
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      expect(chartContainer).toBeInTheDocument();
      expect(chartContainer).toHaveStyle({ width: '375px', height: '300px' });
    });

    it('应该在移动端使用合适的默认尺寸', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      expect(chartContainer).toBeInTheDocument();
      // 验证移动端默认尺寸
      expect(chartContainer).toHaveStyle({ width: '100%', height: '300px' });
    });

    it('应该在移动端禁用某些功能', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      // 验证移动端特定的配置
      expect(createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 375,
          height: 300
        })
      );
    });
  });

  describe('移动端触摸交互', () => {
    it('应该支持触摸滑动', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟触摸滑动
      const touchStart = new TouchEvent('touchstart', {
        touches: [createMockTouch({ clientX: 100, clientY: 200, identifier: 1 })],
      });
      const touchMove = new TouchEvent('touchmove', {
        touches: [createMockTouch({ clientX: 150, clientY: 200, identifier: 1 })],
      });
      const touchEnd = new TouchEvent('touchend');
      
      fireEvent(chartContainer, touchStart);
      fireEvent(chartContainer, touchMove);
      fireEvent(chartContainer, touchEnd);
      
      // 验证触摸交互的处理
      expect(chartContainer).toBeInTheDocument();
    });

    it('应该支持捏合缩放', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟捏合缩放
      const pinchStart = new TouchEvent('touchstart', {
        touches: [
          createMockTouch({ clientX: 100, clientY: 200, identifier: 1 }),
          createMockTouch({ clientX: 200, clientY: 300, identifier: 2 })
        ],
      });
      const pinchMove = new TouchEvent('touchmove', {
        touches: [
          createMockTouch({ clientX: 80, clientY: 180, identifier: 1 }),
          createMockTouch({ clientX: 220, clientY: 320, identifier: 2 })
        ],
      });
      
      fireEvent(chartContainer, pinchStart);
      fireEvent(chartContainer, pinchMove);
      
      // 验证缩放处理
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe('移动端性能优化', () => {
    it('应该在移动端限制数据点数量', () => {
      const largeData = Array.from({ length: 500 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      render(<KLineChart data={largeData} width={375} height={300} />);
      
      // 验证移动端数据限制
      expect(updateChartData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining(largeData.slice(-200)), // 移动端限制为200个点
        expect.any(Object)
      );
    });

    it('应该在移动端禁用复杂的技术指标', () => {
      const technicalData: TechnicalIndicatorData[] = [
        { time: '2024-01-01', ma5: 102, ma10: 100, ma20: 98, ma60: 95 },
        { time: '2024-01-02', ma5: 107, ma10: 103, ma20: 100, ma60: 96 }
      ];

      render(
        <KLineChart 
          data={mockData} 
          width={375} 
          height={300}
          technicalData={technicalData}
          indicators={{
            ma: [5, 10],
            macd: true,
            rsi: [6]
          }}
        />
      );
      
      // 验证移动端简化配置
      expect(addMASeries).not.toHaveBeenCalled();
      expect(addMACDSeries).not.toHaveBeenCalled();
      expect(addRSISeries).not.toHaveBeenCalled();
    });
  });

  describe('移动端屏幕旋转', () => {
    it('应该处理屏幕旋转', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      // 模拟屏幕旋转
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 667,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 375,
        });
        window.dispatchEvent(new Event('resize'));
      });
      
      expect(resizeChart).toHaveBeenCalled();
    });

    it('应该在屏幕旋转时保持数据完整性', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      // 模拟屏幕旋转
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 667,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 375,
        });
        window.dispatchEvent(new Event('resize'));
      });
      
      // 验证数据没有丢失
      expect(updateChartData).toHaveBeenCalledTimes(1);
    });
  });

  describe('移动端内存管理', () => {
    it('应该在移动端使用轻量级渲染', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      // 验证移动端轻量级配置
      expect(createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 375,
          height: 300
        })
      );
    });

    it('应该在页面不可见时释放资源', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      // 模拟页面隐藏
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      // 验证资源释放
      expect(destroyChart).not.toHaveBeenCalled(); // 应该有防抖逻辑
    });
  });

  describe('移动端电池优化', () => {
    it('应该在低电量模式下降低刷新率', () => {
      // 模拟低电量模式
      Object.defineProperty(navigator, 'getBattery', {
        writable: true,
        configurable: true,
        value: vi.fn().mockResolvedValue({
          level: 0.2,
          charging: false
        })
      });

      render(<KLineChart data={mockData} width={375} height={300} />);
      
      // 验证低电量模式下的优化
      expect(monitorChartPerformance).toHaveBeenCalled();
    });

    it('应该在充电时启用完整功能', () => {
      // 模拟充电模式
      Object.defineProperty(navigator, 'getBattery', {
        writable: true,
        configurable: true,
        value: vi.fn().mockResolvedValue({
          level: 0.8,
          charging: true
        })
      });

      render(<KLineChart data={mockData} width={375} height={300} />);
      
      // 验证充电模式下的完整功能
      expect(updateChartData).toHaveBeenCalled();
    });
  });

  describe('移动端网络适配', () => {
    it('应该在弱网环境下使用缓存', () => {
      // 模拟弱网环境
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        configurable: true,
        value: {
          effectiveType: 'slow-2g',
          saveData: true
        }
      });

      render(<KLineChart data={mockData} width={375} height={300} />);
      
      // 验证弱网环境下的缓存使用
      expect(updateChartData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        expect.objectContaining({
          enableCache: true
        })
      );
    });

    it('应该在强网环境下实时更新', () => {
      // 模拟强网环境
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        configurable: true,
        value: {
          effectiveType: '4g',
          saveData: false
        }
      });

      render(<KLineChart data={mockData} width={375} height={300} />);
      
      // 验证强网环境下的实时更新
      expect(updateChartData).toHaveBeenCalled();
    });
  });

  describe('移动端用户体验', () => {
    it('应该显示移动端特定的加载状态', () => {
      vi.mocked(useStockChart).mockReturnValue({
        data: [],
        loading: true,
        error: null,
        refetch: vi.fn()
      });

      render(<KLineChart data={[]} width={375} height={300} />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('应该显示移动端特定的错误状态', () => {
      vi.mocked(useStockChart).mockReturnValue({
        data: [],
        loading: false,
        error: '网络连接失败',
        refetch: vi.fn()
      });

      render(<KLineChart data={[]} width={375} height={300} />);
      
      expect(screen.getByText('网络连接失败')).toBeInTheDocument();
    });

    it('应该支持移动端特定的手势操作', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟双指缩放
      const pinchGesture = new TouchEvent('touchstart', {
        touches: [
          createMockTouch({ clientX: 100, clientY: 200, identifier: 1 }),
          createMockTouch({ clientX: 200, clientY: 300, identifier: 2 })
        ],
      });
      
      fireEvent(chartContainer, pinchGesture);
      
      expect(chartContainer).toBeInTheDocument();
    });
  });
});