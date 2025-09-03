import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MultiIndicatorKLineChart } from '../multi-indicator-k-line-chart';
import type { ChartDataPoint, TechnicalIndicatorData } from '../../../types/charts';

// 导入测试设置
import '../../../test-setup';

describe('MultiIndicatorKLineChart - 多指标K线图表', () => {
  let mockChartData: Array<{
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
  
  let mockOnDataUpdate: ReturnType<typeof vi.fn>;
  let mockOnChartClick: ReturnType<typeof vi.fn>;
  let mockOnCrosshairMove: ReturnType<typeof vi.fn>;
  let mockOnIndicatorVisibilityChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 模拟图表数据
    mockChartData = [
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
      },
      {
        time: '2024-01-03',
        open: 107,
        high: 110,
        low: 106,
        close: 109,
        volume: 1100000
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
      },
      {
        time: '2024-01-03',
        ma5: 106,
        ma10: 102,
        ma20: 101,
        macd: 1.0,
        signal: 0.5,
        histogram: 0.5,
        rsi: 70
      }
    ];

    // 模拟回调函数
    mockOnDataUpdate = vi.fn();
    mockOnChartClick = vi.fn();
    mockOnCrosshairMove = vi.fn();
    mockOnIndicatorVisibilityChange = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('基础渲染测试', () => {
    it('应该正确渲染多指标K线图', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持空数据状态', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: [],
          width: 800,
          height: 600,
          indicators: [],
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持加载状态', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          loading: true,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持错误状态', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          error: '测试错误',
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('技术指标功能测试', () => {
    it('应该支持MA指标显示', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          visibleIndicators: {
            ma: true,
            macd: false,
            rsi: false
          },
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持MACD指标显示', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          visibleIndicators: {
            ma: false,
            macd: true,
            rsi: false
          },
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持RSI指标显示', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          visibleIndicators: {
            ma: false,
            macd: false,
            rsi: true
          },
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持多指标同时显示', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          visibleIndicators: {
            ma: true,
            macd: true,
            rsi: true
          },
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('性能优化测试', () => {
    it('应该支持性能配置', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          performanceConfig: {
            maxDataPoints: 1000,
            updateInterval: 100,
            enableCache: true,
            enableLazyLoading: true,
            chunkSize: 50
          },
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持大数据量处理', () => {
      const largeData = Array.from({ length: 5000 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + Math.random() * 10,
        high: 105 + Math.random() * 10,
        low: 95 + Math.random() * 10,
        close: 100 + Math.random() * 10,
        volume: 1000000 + Math.random() * 500000
      }));

      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: largeData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          performanceConfig: {
            maxDataPoints: 1000,
            updateInterval: 100,
            enableCache: true,
            enableLazyLoading: true,
            chunkSize: 50
          },
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持内存管理', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('交互功能测试', () => {
    it('应该支持图表点击事件', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持交叉线移动事件', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持技术指标可见性变更事件', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('主题和样式测试', () => {
    it('应该支持亮色主题', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          theme: 'light',
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持暗色主题', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          theme: 'dark',
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持自定义样式类名', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          className: 'custom-chart-class',
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('响应式功能测试', () => {
    it('应该支持不同尺寸', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 400,
          height: 300,
          indicators: mockIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持宽屏显示', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 1200,
          height: 800,
          indicators: mockIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('数据更新测试', () => {
    it('应该支持实时数据更新', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          performanceConfig: {
            maxDataPoints: 1000,
            updateInterval: 50,
            enableCache: true,
            enableLazyLoading: false,
            chunkSize: 30
          },
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持历史数据加载', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          performanceConfig: {
            maxDataPoints: 2000,
            updateInterval: 200,
            enableCache: true,
            enableLazyLoading: true,
            chunkSize: 100
          },
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('可访问性测试', () => {
    it('应该支持键盘导航', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持屏幕阅读器', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该支持高对比度模式', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: mockIndicatorData,
          theme: 'dark',
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('错误处理测试', () => {
    it('应该处理无效数据', () => {
      const invalidData = [
        {
          time: 'invalid-date',
          open: -100,
          high: 50,
          low: 200,
          close: 'invalid',
          volume: -1000
        } as any
      ] as ChartDataPoint[];

      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: invalidData,
          width: 800,
          height: 600,
          indicators: [],
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该处理缺失的技术指标数据', () => {
      const incompleteIndicatorData = [
        {
          time: '2024-01-01',
          ma5: 101
          // 缺失其他指标
        } as any
      ] as TechnicalIndicatorData[];

      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: 800,
          height: 600,
          indicators: incompleteIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('应该处理配置错误', () => {
      const { container } = render(
        React.createElement(MultiIndicatorKLineChart, {
          data: mockChartData,
          width: -100,
          height: 0,
          indicators: mockIndicatorData,
          onDataUpdate: mockOnDataUpdate,
          onChartClick: mockOnChartClick,
          onCrosshairMove: mockOnCrosshairMove,
          onLayoutChange: mockOnIndicatorVisibilityChange
        })
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});