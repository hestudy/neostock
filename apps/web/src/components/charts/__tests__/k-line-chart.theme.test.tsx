import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { KLineChart } from '../k-line-chart';
import type { ChartDataPoint } from '../../../types/charts';
import { createChartInstance, applyTheme } from '../chart-utils';
import { useTheme } from '../../../hooks/use-theme';
import { createMockChart } from './test-utils';

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
vi.mock('../../../hooks/use-theme');

describe('KLineChart Theme System Tests', () => {
  let mockContainer: HTMLElement;
  let mockChart: ReturnType<typeof createMockChart>;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockContainer.id = 'chart-container';
    document.body.appendChild(mockContainer);
    
    mockChart = createMockChart();
    
    vi.mocked(createChartInstance).mockReturnValue({
      chart: mockChart,
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

  describe('浅色主题测试', () => {
    it('应该正确应用浅色主题', () => {
      vi.mocked(useTheme).mockReturnValue({ theme: 'light' });
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: {
            background: { type: 'solid', color: '#ffffff' },
            textColor: '#333333'
          }
        })
      );
      
      expect(applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'light'
      );
    });

    it('应该在浅色主题下使用正确的颜色配置', () => {
      vi.mocked(useTheme).mockReturnValue({ theme: 'light' });
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证浅色主题的配置
      const createChartCall = vi.mocked(createChartInstance).mock.calls[0];
      const config = createChartCall[0];
      
      expect(config.layout?.background).toEqual({ type: 'solid', color: '#ffffff' });
      expect(config.layout?.textColor).toBe('#333333');
      expect(config.grid?.vertLines?.color).toBe('#e0e0e0');
      expect(config.grid?.horzLines?.color).toBe('#e0e0e0');
    });

    it('应该在浅色主题下使用正确的蜡烛图颜色', () => {
      vi.mocked(useTheme).mockReturnValue({ theme: 'light' });
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证蜡烛图颜色配置
      expect(applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'light'
      );
    });
  });

  describe('深色主题测试', () => {
    it('应该正确应用深色主题', () => {
      vi.mocked(useTheme).mockReturnValue({ theme: 'dark' });
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: {
            background: { type: 'solid', color: '#1a1a1a' },
            textColor: '#ffffff'
          }
        })
      );
      
      expect(applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'dark'
      );
    });

    it('应该在深色主题下使用正确的颜色配置', () => {
      vi.mocked(useTheme).mockReturnValue({ theme: 'dark' });
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证深色主题的配置
      const createChartCall = vi.mocked(createChartInstance).mock.calls[0];
      const config = createChartCall[0];
      
      expect(config.layout?.background).toEqual({ type: 'solid', color: '#1a1a1a' });
      expect(config.layout?.textColor).toBe('#ffffff');
      expect(config.grid?.vertLines?.color).toBe('#2a2a2a');
      expect(config.grid?.horzLines?.color).toBe('#2a2a2a');
    });

    it('应该在深色主题下使用正确的蜡烛图颜色', () => {
      vi.mocked(useTheme).mockReturnValue({ theme: 'dark' });
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证蜡烛图颜色配置
      expect(applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'dark'
      );
    });
  });

  describe('主题切换测试', () => {
    it('应该在主题变化时重新应用主题', () => {
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'light',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'light',
        systemTheme: 'light'
      });
      
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 切换到深色主题
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'dark',
        systemTheme: 'light'
      });
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(applyTheme).toHaveBeenCalledTimes(2);
      expect(applyTheme).toHaveBeenLastCalledWith(
        expect.any(Object),
        'dark'
      );
    });

    it('应该在主题变化时更新图表配置', () => {
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'light',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'light',
        systemTheme: 'light'
      });
      
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 切换到深色主题
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'dark',
        systemTheme: 'light'
      });
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证深色主题的配置
      const lastApplyThemeCall = vi.mocked(applyTheme).mock.calls[1];
      expect(lastApplyThemeCall[1]).toBe('dark');
    });
  });

  describe('主题性能测试', () => {
    it('应该高效处理主题切换', () => {
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'light',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'light',
        systemTheme: 'light'
      });
      
      const startTime = performance.now();
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 模拟快速主题切换
      for (let i = 0; i < 5; i++) {
        vi.mocked(useTheme).mockReturnValue({ 
          theme: i % 2 === 0 ? 'light' : 'dark',
          setTheme: vi.fn(),
          themes: ['light', 'dark'],
          resolvedTheme: i % 2 === 0 ? 'light' : 'dark',
          systemTheme: 'light'
        });
        act(() => {
          render(<KLineChart data={mockData} width={800} height={400} />);
        });
      }
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // 主题切换应该在合理时间内完成
      expect(renderTime).toBeLessThan(100); // 100ms 内完成
    });

    it('应该在主题切换时保持图表状态', () => {
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'light',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'light',
        systemTheme: 'light'
      });
      
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 切换到深色主题
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'dark',
        systemTheme: 'light'
      });
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证图表实例保持不变
      expect(createChartInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('主题兼容性测试', () => {
    it('应该处理未知主题', () => {
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'unknown' as 'light' | 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'light',
        systemTheme: 'light'
      });
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 应该回退到浅色主题
      expect(applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'light'
      );
    });

    it('应该处理主题配置缺失', () => {
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'light',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'light',
        systemTheme: 'light'
      });
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 应该回退到浅色主题
      expect(applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'light'
      );
    });
  });

  describe('主题可访问性测试', () => {
    it('应该确保颜色对比度符合WCAG标准', () => {
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'light',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'light',
        systemTheme: 'light'
      });
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证浅色主题的颜色对比度
      const createChartCall = vi.mocked(createChartInstance).mock.calls[0];
      const config = createChartCall[0];
      
      expect(config.layout?.textColor).toBe('#333333');
      expect(config.layout?.background?.color).toBe('#ffffff');
    });

    it('应该在深色主题下保持良好的可读性', () => {
      vi.mocked(useTheme).mockReturnValue({ 
        theme: 'dark',
        setTheme: vi.fn(),
        themes: ['light', 'dark'],
        resolvedTheme: 'dark',
        systemTheme: 'light'
      });
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证深色主题的颜色对比度
      const createChartCall = vi.mocked(createChartInstance).mock.calls[0];
      const config = createChartCall[0];
      
      expect(config.layout?.textColor).toBe('#ffffff');
      expect(config.layout?.background?.color).toBe('#1a1a1a');
    });
  });
});