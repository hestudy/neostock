import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

// Mock touch events
Object.defineProperty(window, 'TouchEvent', {
  value: class TouchEvent extends Event {
    constructor(type: string, init: TouchEventInit = {}) {
      super(type, init);
      this.touches = init.touches || [];
      this.changedTouches = init.changedTouches || [];
      this.targetTouches = init.targetTouches || [];
    }
    touches: Touch[];
    changedTouches: Touch[];
    targetTouches: Touch[];
  },
  writable: true
});

Object.defineProperty(window, 'Touch', {
  value: class Touch {
    constructor(init: TouchInit) {
      this.identifier = init.identifier || 0;
      this.target = init.target || null;
      this.clientX = init.clientX || 0;
      this.clientY = init.clientY || 0;
      this.pageX = init.pageX || 0;
      this.pageY = init.pageY || 0;
      this.screenX = init.screenX || 0;
      this.screenY = init.screenY || 0;
    }
    identifier: number;
    target: EventTarget | null;
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
    screenX: number;
    screenY: number;
  },
  writable: true
});

describe('KLineChart Mobile Tests', () => {
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
    
    // 模拟移动端环境
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 667
    });
    
    // 模拟触摸设备
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      value: 5
    });
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
    vi.clearAllMocks();
    
    // 重置窗口大小
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768
    });
  });

  const mockData: ChartDataPoint[] = Array.from({ length: 50 }, (_, i) => ({
    time: `2024-01-${String(i + 1).padStart(2, '0')}`,
    open: 100 + i,
    high: 110 + i,
    low: 90 + i,
    close: 105 + i,
    volume: 1000000 + i * 1000
  }));

  describe('移动端基础适配', () => {
    it('应该在移动端屏幕尺寸下正确渲染', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      expect(chartContainer).toBeInTheDocument();
      expect(chartContainer).toHaveStyle({ width: '375px', height: '300px' });
    });

    it('应该在小屏幕手机上适配', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320
      });
      
      render(<KLineChart data={mockData} width={320} height={240} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      expect(chartContainer).toBeInTheDocument();
      expect(chartContainer).toHaveStyle({ width: '320px', height: '240px' });
    });

    it('应该在大屏手机上适配', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 414
      });
      
      render(<KLineChart data={mockData} width={414} height={350} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      expect(chartContainer).toBeInTheDocument();
      expect(chartContainer).toHaveStyle({ width: '414px', height: '350px' });
    });
  });

  describe('触摸手势支持', () => {
    it('应该支持单点触摸操作', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟单点触摸
      const touch = new Touch({
        identifier: 1,
        target: chartContainer,
        clientX: 100,
        clientY: 150
      });
      
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [touch],
        changedTouches: [touch],
        targetTouches: [touch]
      });
      
      fireEvent(chartContainer, touchStartEvent);
      
      expect(chartContainer).toBeInTheDocument();
    });

    it('应该支持多点触摸操作', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟多点触摸（捏合手势）
      const touch1 = new Touch({
        identifier: 1,
        target: chartContainer,
        clientX: 100,
        clientY: 150
      });
      
      const touch2 = new Touch({
        identifier: 2,
        target: chartContainer,
        clientX: 200,
        clientY: 150
      });
      
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [touch1, touch2],
        changedTouches: [touch1, touch2],
        targetTouches: [touch1, touch2]
      });
      
      fireEvent(chartContainer, touchStartEvent);
      
      expect(chartContainer).toBeInTheDocument();
    });

    it('应该支持触摸滑动操作', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 开始触摸
      const startTouch = new Touch({
        identifier: 1,
        target: chartContainer,
        clientX: 100,
        clientY: 150
      });
      
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [startTouch],
        changedTouches: [startTouch],
        targetTouches: [startTouch]
      });
      
      fireEvent(chartContainer, touchStartEvent);
      
      // 滑动触摸
      const moveTouch = new Touch({
        identifier: 1,
        target: chartContainer,
        clientX: 50,
        clientY: 150
      });
      
      const touchMoveEvent = new TouchEvent('touchmove', {
        touches: [moveTouch],
        changedTouches: [moveTouch],
        targetTouches: [moveTouch]
      });
      
      fireEvent(chartContainer, touchMoveEvent);
      
      // 结束触摸
      const endTouch = new Touch({
        identifier: 1,
        target: chartContainer,
        clientX: 50,
        clientY: 150
      });
      
      const touchEndEvent = new TouchEvent('touchend', {
        touches: [],
        changedTouches: [endTouch],
        targetTouches: []
      });
      
      fireEvent(chartContainer, touchEndEvent);
      
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe('触摸缩放功能', () => {
    it('应该支持捏合缩放', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 捏合开始
      const touch1 = new Touch({
        identifier: 1,
        target: chartContainer,
        clientX: 100,
        clientY: 150
      });
      
      const touch2 = new Touch({
        identifier: 2,
        target: chartContainer,
        clientX: 200,
        clientY: 150
      });
      
      const pinchStartEvent = new TouchEvent('touchstart', {
        touches: [touch1, touch2],
        changedTouches: [touch1, touch2],
        targetTouches: [touch1, touch2]
      });
      
      fireEvent(chartContainer, pinchStartEvent);
      
      // 捏合过程（放大）
      const moveTouch1 = new Touch({
        identifier: 1,
        target: chartContainer,
        clientX: 80,
        clientY: 150
      });
      
      const moveTouch2 = new Touch({
        identifier: 2,
        target: chartContainer,
        clientX: 220,
        clientY: 150
      });
      
      const pinchMoveEvent = new TouchEvent('touchmove', {
        touches: [moveTouch1, moveTouch2],
        changedTouches: [moveTouch1, moveTouch2],
        targetTouches: [moveTouch1, moveTouch2]
      });
      
      fireEvent(chartContainer, pinchMoveEvent);
      
      expect(chartContainer).toBeInTheDocument();
    });

    it('应该支持双指缩放', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 双指缩放开始
      const touches = [
        new Touch({
          identifier: 1,
          target: chartContainer,
          clientX: 150,
          clientY: 100
        }),
        new Touch({
          identifier: 2,
          target: chartContainer,
          clientX: 150,
          clientY: 200
        })
      ];
      
      const zoomStartEvent = new TouchEvent('touchstart', {
        touches,
        changedTouches: touches,
        targetTouches: touches
      });
      
      fireEvent(chartContainer, zoomStartEvent);
      
      // 缩放过程
      const moveTouches = [
        new Touch({
          identifier: 1,
          target: chartContainer,
          clientX: 150,
          clientY: 80
        }),
        new Touch({
          identifier: 2,
          target: chartContainer,
          clientX: 150,
          clientY: 220
        })
      ];
      
      const zoomMoveEvent = new TouchEvent('touchmove', {
        touches: moveTouches,
        changedTouches: moveTouches,
        targetTouches: moveTouches
      });
      
      fireEvent(chartContainer, zoomMoveEvent);
      
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe('移动端性能测试', () => {
    it('应该在移动端保持良好性能', () => {
      const mobileData: ChartDataPoint[] = Array.from({ length: 200 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000
      }));

      const startTime = performance.now();
      
      render(<KLineChart data={mobileData} width={375} height={300} />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100);
      expect(screen.getByTestId('k-line-chart')).toBeInTheDocument();
    });

    it('应该在触摸事件处理时保持响应', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟快速连续触摸事件
      const touchEvents = [];
      for (let i = 0; i < 10; i++) {
        const touch = new Touch({
          identifier: i,
          target: chartContainer,
          clientX: 100 + i * 10,
          clientY: 150
        });
        
        const touchEvent = new TouchEvent('touchstart', {
          touches: [touch],
          changedTouches: [touch],
          targetTouches: [touch]
        });
        
        touchEvents.push(touchEvent);
      }
      
      const startTime = performance.now();
      
      touchEvents.forEach(event => {
        fireEvent(chartContainer, event);
      });
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(50);
    });
  });

  describe('移动端适配优化', () => {
    it('应该优化移动端的图表显示', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 验证图表配置针对移动端进行了优化
      expect(require('../chart-utils').createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 375,
          height: 300,
          crosshair: expect.objectContaining({
            mode: expect.any(Number)
          })
        })
      );
    });

    it('应该在移动端启用性能优化', () => {
      render(
        <KLineChart 
          data={mockData} 
          width={375} 
          height={300}
          performance={{ 
            maxDataPoints: 200,
            enableCache: true,
            enableLazyLoading: true
          }}
        />
      );
      
      // 验证性能优化配置
      expect(require('../chart-utils').updateChartData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        expect.objectContaining({
          maxDataPoints: 200,
          enableCache: true,
          enableLazyLoading: true
        })
      );
    });
  });

  describe('移动端交互体验', () => {
    it('应该防止误触和页面滚动冲突', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟可能引起页面滚动的触摸事件
      const touch = new Touch({
        identifier: 1,
        target: chartContainer,
        clientX: 100,
        clientY: 150
      });
      
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [touch],
        changedTouches: [touch],
        targetTouches: [touch]
      });
      
      // 阻止默认行为来防止页面滚动
      touchStartEvent.preventDefault();
      
      fireEvent(chartContainer, touchStartEvent);
      
      expect(chartContainer).toBeInTheDocument();
    });

    it('应该支持长按操作', () => {
      render(<KLineChart data={mockData} width={375} height={300} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      
      // 模拟长按触摸
      const touch = new Touch({
        identifier: 1,
        target: chartContainer,
        clientX: 100,
        clientY: 150
      });
      
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [touch],
        changedTouches: [touch],
        targetTouches: [touch]
      });
      
      fireEvent(chartContainer, touchStartEvent);
      
      // 模拟长按（保持触摸状态）
      act(() => {
        // 等待长按时间
        vi.advanceTimersByTime(500);
      });
      
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe('移动端响应式设计', () => {
    it('应该支持横屏模式', () => {
      // 模拟横屏
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 667
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      render(<KLineChart data={mockData} width={667} height={300} responsive={true} />);
      
      const chartContainer = screen.getByTestId('k-line-chart');
      expect(chartContainer).toBeInTheDocument();
      expect(chartContainer).toHaveStyle({ width: '667px', height: '300px' });
    });

    it('应该在屏幕旋转时自动调整', () => {
      const { rerender } = render(
        <KLineChart 
          data={mockData} 
          width={375} 
          height={300} 
          responsive={true} 
        />
      );
      
      // 模拟屏幕旋转
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 667
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 375
        });
        
        window.dispatchEvent(new Event('resize'));
      });
      
      rerender(
        <KLineChart 
          data={mockData} 
          width={667} 
          height={300} 
          responsive={true} 
        />
      );
      
      const chartContainer = screen.getByTestId('k-line-chart');
      expect(chartContainer).toBeInTheDocument();
      expect(require('../chart-utils').resizeChart).toHaveBeenCalled();
    });
  });
});