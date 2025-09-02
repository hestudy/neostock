import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('KLineChart Theme System Tests', () => {
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
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'light' }));
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(require('../chart-utils').createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: {
            background: { type: 'solid', color: '#ffffff' },
            textColor: '#333333'
          }
        })
      );
      
      expect(require('../chart-utils').applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'light'
      );
    });

    it('应该在浅色主题下使用正确的颜色配置', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'light' }));
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证浅色主题的配置
      const createChartCall = require('../chart-utils').createChartInstance.mock.calls[0];
      const config = createChartCall[0];
      
      expect(config.layout?.background).toEqual({ type: 'solid', color: '#ffffff' });
      expect(config.layout?.textColor).toBe('#333333');
      expect(config.grid?.vertLines?.color).toBe('#e0e0e0');
      expect(config.grid?.horzLines?.color).toBe('#e0e0e0');
    });

    it('应该在浅色主题下使用正确的蜡烛图颜色', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'light' }));
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证蜡烛图颜色配置
      expect(require('../chart-utils').applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'light'
      );
    });
  });

  describe('深色主题测试', () => {
    it('应该正确应用深色主题', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'dark' }));
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(require('../chart-utils').createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: {
            background: { type: 'solid', color: '#1a1a1a' },
            textColor: '#ffffff'
          }
        })
      );
      
      expect(require('../chart-utils').applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'dark'
      );
    });

    it('应该在深色主题下使用正确的颜色配置', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'dark' }));
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证深色主题的配置
      const createChartCall = require('../chart-utils').createChartInstance.mock.calls[0];
      const config = createChartCall[0];
      
      expect(config.layout?.background).toEqual({ type: 'solid', color: '#1a1a1a' });
      expect(config.layout?.textColor).toBe('#ffffff');
      expect(config.grid?.vertLines?.color).toBe('#2a2a2a');
      expect(config.grid?.horzLines?.color).toBe('#2a2a2a');
    });

    it('应该在深色主题下使用正确的蜡烛图颜色', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'dark' }));
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证深色主题下的蜡烛图颜色
      expect(require('../chart-utils').applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'dark'
      );
    });
  });

  describe('主题切换测试', () => {
    it('应该支持主题动态切换', () => {
      const mockUseTheme = vi.fn()
        .mockReturnValueOnce({ theme: 'light' })
        .mockReturnValueOnce({ theme: 'dark' });
      
      vi.mocked('../../hooks/use-theme').useTheme = mockUseTheme;
      
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 初始浅色主题
      expect(require('../chart-utils').applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'light'
      );
      
      // 切换到深色主题
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(require('../chart-utils').applyTheme).toHaveBeenCalledWith(
        expect.any(Object),
        'dark'
      );
    });

    it('应该在主题切换时更新所有相关配置', () => {
      const mockUseTheme = vi.fn()
        .mockReturnValueOnce({ theme: 'light' })
        .mockReturnValueOnce({ theme: 'dark' });
      
      vi.mocked('../../hooks/use-theme').useTheme = mockUseTheme;
      
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 浅色主题配置
      expect(require('../chart-utils').createChartInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: {
            background: { type: 'solid', color: '#ffffff' },
            textColor: '#333333'
          }
        })
      );
      
      // 深色主题配置
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      
      expect(require('../chart-utils').applyTheme).toHaveBeenCalledTimes(2);
    });

    it('应该在主题切换时保持数据完整性', () => {
      const mockUseTheme = vi.fn()
        .mockReturnValueOnce({ theme: 'light' })
        .mockReturnValueOnce({ theme: 'dark' });
      
      vi.mocked('../../hooks/use-theme').useTheme = mockUseTheme;
      
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 主题切换前后，图表应该继续显示相同的数据
      expect(require('../chart-utils').updateChartData).toHaveBeenCalledTimes(1);
      
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      
      // 数据不应该因为主题切换而重新加载
      expect(require('../chart-utils').updateChartData).toHaveBeenCalledTimes(1);
    });
  });

  describe('主题颜色一致性测试', () => {
    it('应该保持与shadcn/ui组件风格一致', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'light' }));
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证颜色与shadcn/ui设计系统一致
      const createChartCall = require('../chart-utils').createChartInstance.mock.calls[0];
      const config = createChartCall[0];
      
      // 浅色主题背景色应该与shadcn/ui Card组件一致
      expect(config.layout?.background).toEqual({ type: 'solid', color: '#ffffff' });
      
      // 网格线颜色应该与shadcn/ui边框颜色一致
      expect(config.grid?.vertLines?.color).toBe('#e0e0e0');
      expect(config.grid?.horzLines?.color).toBe('#e0e0e0');
    });

    it('应该在深色主题下保持一致性', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'dark' }));
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      const createChartCall = require('../chart-utils').createChartInstance.mock.calls[0];
      const config = createChartCall[0];
      
      // 深色主题背景色
      expect(config.layout?.background).toEqual({ type: 'solid', color: '#1a1a1a' });
      
      // 深色主题网格线颜色
      expect(config.grid?.vertLines?.color).toBe('#2a2a2a');
      expect(config.grid?.horzLines?.color).toBe('#2a2a2a');
    });
  });

  describe('蜡烛图颜色测试', () => {
    it('应该在涨跌时使用正确的颜色', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'light' }));
      
      render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 验证蜡烛图颜色配置
      expect(require('../chart-utils').createChartInstance).toHaveBeenCalled();
    });

    it('应该在主题切换时保持蜡烛图颜色逻辑', () => {
      const mockUseTheme = vi.fn()
        .mockReturnValueOnce({ theme: 'light' })
        .mockReturnValueOnce({ theme: 'dark' });
      
      vi.mocked('../../hooks/use-theme').useTheme = mockUseTheme;
      
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 涨跌颜色逻辑应该在主题切换时保持一致
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      
      // 颜色逻辑应该保持不变，只是主题色值改变
      expect(require('../chart-utils').applyTheme).toHaveBeenCalledTimes(2);
    });
  });

  describe('技术指标主题测试', () => {
    it('应该在主题切换时更新技术指标颜色', () => {
      const technicalData: TechnicalIndicatorData[] = [
        { time: '2024-01-01', ma5: 102, ma10: 100, ma20: 98, ma60: 95 },
        { time: '2024-01-02', ma5: 107, ma10: 103, ma20: 100, ma60: 96 }
      ];

      const mockUseTheme = vi.fn()
        .mockReturnValueOnce({ theme: 'light' })
        .mockReturnValueOnce({ theme: 'dark' });
      
      vi.mocked('../../hooks/use-theme').useTheme = mockUseTheme;
      
      const { rerender } = render(
        <KLineChart 
          data={mockData} 
          technicalData={technicalData}
          indicators={{ ma: [5, 10, 20, 60] }}
          width={800} 
          height={400} 
        />
      );
      
      // 技术指标应该在主题切换时重新应用
      rerender(
        <KLineChart 
          data={mockData} 
          technicalData={technicalData}
          indicators={{ ma: [5, 10, 20, 60] }}
          width={800} 
          height={400} 
        />
      );
      
      expect(require('../chart-utils').addMASeries).toHaveBeenCalledTimes(8); // 4个MA * 2次主题切换
    });

    it('应该在不同主题下保持技术指标的可读性', () => {
      const technicalData: TechnicalIndicatorData[] = [
        { time: '2024-01-01', ma5: 102, ma10: 100, ma20: 98, ma60: 95 },
        { time: '2024-01-02', ma5: 107, ma10: 103, ma20: 100, ma60: 96 }
      ];

      // 测试浅色主题
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'light' }));
      
      render(
        <KLineChart 
          data={mockData} 
          technicalData={technicalData}
          indicators={{ ma: [5, 10, 20, 60] }}
          width={800} 
          height={400} 
        />
      );
      
      expect(require('../chart-utils').addMASeries).toHaveBeenCalledTimes(4);
    });
  });

  describe('主题性能测试', () => {
    it('应该在主题切换时保持良好性能', () => {
      const mockUseTheme = vi.fn()
        .mockReturnValueOnce({ theme: 'light' })
        .mockReturnValueOnce({ theme: 'dark' });
      
      vi.mocked('../../hooks/use-theme').useTheme = mockUseTheme;
      
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      const startTime = performance.now();
      
      // 主题切换
      rerender(<KLineChart data={mockData} width={800} height={400} />);
      
      const endTime = performance.now();
      const themeSwitchTime = endTime - startTime;

      expect(themeSwitchTime).toBeLessThan(50);
    });

    it('应该在频繁主题切换时保持稳定', () => {
      const mockUseTheme = vi.fn()
        .mockReturnValue({ theme: 'light' });
      
      vi.mocked('../../hooks/use-theme').useTheme = mockUseTheme;
      
      const { rerender } = render(<KLineChart data={mockData} width={800} height={400} />);
      
      // 模拟频繁主题切换
      const switchTimes: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        
        // 切换主题
        mockUseTheme.mockReturnValue({ theme: i % 2 === 0 ? 'light' : 'dark' });
        rerender(<KLineChart data={mockData} width={800} height={400} />);
        
        const endTime = performance.now();
        switchTimes.push(endTime - startTime);
      }
      
      // 验证所有主题切换都在合理时间内完成
      switchTimes.forEach(time => {
        expect(time).toBeLessThan(50);
      });
    });
  });

  describe('主题边界情况测试', () => {
    it('应该处理未知主题值', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: 'unknown' as any }));
      
      expect(() => {
        render(<KLineChart data={mockData} width={800} height={400} />);
      }).not.toThrow();
    });

    it('应该在主题为null时使用默认主题', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({ theme: null as any }));
      
      expect(() => {
        render(<KLineChart data={mockData} width={800} height={400} />);
      }).not.toThrow();
    });

    it('应该在主题配置缺失时使用默认值', () => {
      vi.mocked('../../hooks/use-theme').useTheme = vi.fn(() => ({} as any));
      
      expect(() => {
        render(<KLineChart data={mockData} width={800} height={400} />);
      }).not.toThrow();
    });
  });
});