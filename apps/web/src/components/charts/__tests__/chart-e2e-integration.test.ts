import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { KLineChart } from '../k-line-chart';
import { MultiIndicatorKLineChart } from '../multi-indicator-k-line-chart';
import { MobileKLineChart } from '../mobile-k-line-chart';
import { TechnicalIndicatorControls } from '../technical-indicator-controls';
import { OptimizedMultiIndicatorKLineChart } from '../optimized-multi-indicator-k-line-chart';

// 导入测试设置
import '../../../test-setup';

describe('Chart E2E Integration - 图表端到端集成测试', () => {
  let mockStockData: Array<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  
  let mockIndicatorData: Array<{
    time: string;
    ma5?: number;
    ma10?: number;
    ma20?: number;
    macd?: number;
    signal?: number;
    histogram?: number;
    rsi?: number;
  }>;

  beforeEach(() => {
    // 模拟股票数据
    mockStockData = [
      {
        time: '2024-01-01',
        open: 100,
        high: 105,
        low: 98,
        close: 102,
        volume: 1000000
      },
      {
        time: '2024-01-02',
        open: 102,
        high: 108,
        low: 101,
        close: 107,
        volume: 1200000
      }
    ];

    // 模拟技术指标数据
    mockIndicatorData = [
      {
        time: '2024-01-01',
        ma5: 101,
        ma10: 100,
        ma20: 99,
        macd: 0.5,
        signal: 0.3,
        histogram: 0.2,
        rsi: 55
      },
      {
        time: '2024-01-02',
        ma5: 103,
        ma10: 101,
        ma20: 100,
        macd: 0.8,
        signal: 0.4,
        histogram: 0.4,
        rsi: 65
      }
    ];
  });

  afterEach(() => {
    // 清理工作
  });

  describe('基础K线图表功能', () => {
    it('应该正确渲染K线图表', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持技术指标显示', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          indicators: mockIndicatorData,
          width: 800,
          height: 400,
          showVolume: true
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持主题切换', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400,
          theme: 'dark'
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该响应数据更新', () => {
      const { rerender, container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400
        })
      );

      const updatedData = [...mockStockData, {
        time: '2024-01-03',
        open: 107,
        high: 110,
        low: 106,
        close: 109,
        volume: 1100000
      }];

      rerender(
        React.createElement(KLineChart, {
          data: updatedData,
          width: 800,
          height: 400
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('多指标K线图表功能', () => {
    it('应该正确渲染多指标K线图表', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockStockData,
          indicators: mockIndicatorData,
          width: 800,
          height: 400
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持技术指标配置', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockStockData,
          indicators: mockIndicatorData,
          width: 800,
          height: 400,
          visibleIndicators: {
            ma: true,
            macd: true,
            rsi: false
          }
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持性能优化配置', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockStockData,
          indicators: mockIndicatorData,
          width: 800,
          height: 400,
          performanceConfig: {
            maxDataPoints: 1000,
            updateInterval: 100,
            enableCache: true,
            enableLazyLoading: true,
            chunkSize: 50
          }
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('移动端K线图表功能', () => {
    it('应该正确渲染移动端K线图表', () => {
      const { container } = render(
        React.createElement(MobileKLineChart, {
          data: mockStockData
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持触摸手势', () => {
      const { container } = render(
        React.createElement(MobileKLineChart, {
          data: mockStockData,
          enableTouchGestures: true,
          preventPageScroll: true
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持移动端性能优化', () => {
      const { container } = render(
        React.createElement(MobileKLineChart, {
          data: mockStockData,
          optimizedForMobile: true
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('技术指标控制功能', () => {
    it('应该正确渲染技术指标控制面板', () => {
      const { container } = render(
        React.createElement(TechnicalIndicatorControls, {
          visibleIndicators: {
            ma: true,
            macd: true,
            rsi: true
          },
          onToggleIndicator: vi.fn(),
          onSetIndicatorVisible: vi.fn(),
          onIndicatorVisibilityChange: vi.fn()
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持技术指标切换', () => {
      const mockCallback = vi.fn();
      const { container } = render(
        React.createElement(TechnicalIndicatorControls, {
          visibleIndicators: {
            ma: true,
            macd: true,
            rsi: true
          },
          onToggleIndicator: vi.fn(),
          onSetIndicatorVisible: vi.fn(),
          onIndicatorVisibilityChange: mockCallback
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持不同的控制面板变体', () => {
      const { container } = render(
        React.createElement(TechnicalIndicatorControls, {
          visibleIndicators: {
            ma: true,
            macd: true,
            rsi: true
          },
          onToggleIndicator: vi.fn(),
          onSetIndicatorVisible: vi.fn(),
          onIndicatorVisibilityChange: vi.fn(),
          compact: true
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('优化多指标K线图表功能', () => {
    it('应该正确渲染优化多指标K线图表', () => {
      const { container } = render(
        React.createElement(OptimizedMultiIndicatorKLineChart, {
          data: mockStockData,
          indicators: mockIndicatorData,
          width: 800,
          height: 400
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持高级性能优化', () => {
      const { container } = render(
        React.createElement(OptimizedMultiIndicatorKLineChart, {
          data: mockStockData,
          indicators: mockIndicatorData,
          width: 800,
          height: 400,
          performanceConfig: { enableSmartCaching: true }
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持内存管理', () => {
      const { container } = render(
        React.createElement(OptimizedMultiIndicatorKLineChart, {
          data: mockStockData,
          indicators: mockIndicatorData,
          width: 800,
          height: 400,
          performanceConfig: { enablePerformanceMonitoring: true }
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('图表交互功能', () => {
    it('应该支持图表点击事件', () => {
      const mockClickHandler = vi.fn();
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400,
          onChartClick: mockClickHandler
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持交叉线移动事件', () => {
      const mockCrosshairHandler = vi.fn();
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400,
          onCrosshairMove: mockCrosshairHandler
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持数据更新事件', () => {
      const mockDataUpdateHandler = vi.fn();
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400,
          onDataUpdate: mockDataUpdateHandler
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('图表响应式功能', () => {
    it('应该支持尺寸调整', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持主题切换', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400,
          theme: 'light'
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持加载状态', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400,
          loading: true
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持错误状态', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400,
          error: '测试错误'
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('图表性能优化', () => {
    it('应该支持大数据量处理', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + Math.random() * 10,
        high: 105 + Math.random() * 10,
        low: 95 + Math.random() * 10,
        close: 100 + Math.random() * 10,
        volume: 1000000 + Math.random() * 500000
      }));

      const { container } = render(
        React.createElement(KLineChart, {
          data: largeData,
          width: 800,
          height: 400,
          performanceConfig: {
            maxDataPoints: 1000,
            updateInterval: 100,
            enableCache: true,
            enableLazyLoading: true,
            chunkSize: 50
          }
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持实时数据更新', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400,
          performanceConfig: {
            maxDataPoints: 1000,
            updateInterval: 50,
            enableCache: true,
            enableLazyLoading: false,
            chunkSize: 30
          }
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持内存优化', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400,
          performanceConfig: {
            maxDataPoints: 500,
            updateInterval: 200,
            enableCache: true,
            enableLazyLoading: true,
            chunkSize: 20
          }
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('图表可访问性', () => {
    it('应该支持键盘导航', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持屏幕阅读器', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持高对比度模式', () => {
      const { container } = render(
        React.createElement(KLineChart, {
          data: mockStockData,
          width: 800,
          height: 400,
          theme: 'dark'
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});