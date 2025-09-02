import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createChartInstance, 
  updateChartData, 
  addMASeries, 
  addMACDSeries, 
  addRSISeries,
  removeTechnicalIndicator,
  resizeChart,
  destroyChart,
  applyTheme,
  monitorChartPerformance,
  getCachedData,
  clearCache
} from '../chart-utils';
import type { 
  ChartConfig, 
  ChartDataPoint, 
  TechnicalIndicatorData, 
  ChartInstance,
  ChartTheme 
} from '../../types/charts';

// Mock lightweight-charts
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
  },
  PriceScaleMode: {
    Normal: 0
  }
}));

const mockCreateChart = vi.fn();

describe('Chart Utils', () => {
  let mockContainer: HTMLElement;
  let mockChart: any;
  let mockSeries: any;
  let mockInstance: ChartInstance;

  beforeEach(() => {
    // Setup DOM
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);

    // Setup mock chart
    mockSeries = {
      setData: vi.fn(),
      applyOptions: vi.fn()
    };

    mockChart = {
      addSeries: vi.fn(() => mockSeries),
      removeSeries: vi.fn(),
      resize: vi.fn(),
      remove: vi.fn(),
      applyOptions: vi.fn()
    };

    mockCreateChart.mockReturnValue(mockChart);
    
    // Mock implementation
    (require('lightweight-charts').createChart as any) = mockCreateChart;

    // Setup mock instance
    mockInstance = {
      chart: mockChart,
      candlestickSeries: null,
      volumeSeries: null,
      maSeries: new Map(),
      macdSeries: {},
      rsiSeries: new Map()
    };
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
    vi.clearAllMocks();
  });

  describe('createChartInstance', () => {
    it('应该创建图表实例并返回正确的结构', () => {
      const config: ChartConfig = {
        container: mockContainer,
        width: 800,
        height: 400
      };

      const instance = createChartInstance(config);

      expect(mockCreateChart).toHaveBeenCalledWith(mockContainer, expect.objectContaining({
        width: 800,
        height: 400
      }));

      expect(instance).toEqual(expect.objectContaining({
        chart: mockChart,
        candlestickSeries: null,
        volumeSeries: null,
        maSeries: expect.any(Map),
        macdSeries: {},
        rsiSeries: expect.any(Map)
      }));
    });

    it('应该使用默认配置当未提供可选参数时', () => {
      const config: ChartConfig = {
        container: mockContainer
      };

      createChartInstance(config);

      expect(mockCreateChart).toHaveBeenCalledWith(mockContainer, expect.objectContaining({
        width: 800,
        height: 400
      }));
    });
  });

  describe('updateChartData', () => {
    it('应该正确处理和验证数据', () => {
      const mockData: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000000 },
        { time: '2024-01-02', open: 105, high: 115, low: 95, close: 110, volume: 1200000 }
      ];

      updateChartData(mockInstance, mockData);

      expect(mockChart.addSeries).toHaveBeenCalledWith('Candlestick', expect.objectContaining({
        upColor: '#26a69a',
        downColor: '#ef5350'
      }));

      expect(mockSeries.setData).toHaveBeenCalled();
    });

    it('应该过滤无效数据', () => {
      const invalidData: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 },
        { time: '2024-01-02', open: NaN, high: 115, low: 95, close: 110 }, // 无效数据
        { time: '2024-01-03', open: 105, high: 95, low: 115, close: 110 } // high < low，无效
      ];

      updateChartData(mockInstance, invalidData);

      // 应该只添加有效的数据点
      const callArgs = mockSeries.setData.mock.calls[0][0];
      expect(callArgs).toHaveLength(1); // 只有第一个数据点有效
    });

    it('应该在图表实例不存在时静默返回', () => {
      const emptyInstance = { ...mockInstance, chart: null };
      const mockData: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 }
      ];

      expect(() => updateChartData(emptyInstance, mockData)).not.toThrow();
    });
  });

  describe('addMASeries', () => {
    it('应该正确添加移动平均线', () => {
      const maData: TechnicalIndicatorData[] = [
        { time: '2024-01-01', ma5: 102, ma10: 100 },
        { time: '2024-01-02', ma5: 107, ma10: 103 }
      ];

      addMASeries(mockInstance, maData, 5, '#ff9800');

      expect(mockChart.addSeries).toHaveBeenCalledWith('Line', expect.objectContaining({
        color: '#ff9800',
        lineWidth: 2
      }));

      expect(mockSeries.setData).toHaveBeenCalledWith([
        { time: '2024-01-01', value: 102 },
        { time: '2024-01-02', value: 107 }
      ]);
    });

    it('应该在数据为空时不添加系列', () => {
      const emptyData: TechnicalIndicatorData[] = [];

      addMASeries(mockInstance, emptyData, 5, '#ff9800');

      expect(mockChart.addSeries).not.toHaveBeenCalled();
    });
  });

  describe('addMACDSeries', () => {
    it('应该正确添加MACD指标', () => {
      const macdData: TechnicalIndicatorData[] = [
        { time: '2024-01-01', macd_dif: 1.5, macd_dea: 1.2, macd_hist: 0.3 },
        { time: '2024-01-02', macd_dif: 1.8, macd_dea: 1.4, macd_hist: 0.4 }
      ];

      const config = {
        colors: {
          macd: '#2196f3',
          signal: '#ff9800',
          histogram: { up: '#4caf50', down: '#f44336' }
        }
      };

      addMACDSeries(mockInstance, macdData, config);

      // 应该添加3个系列（MACD线、信号线、柱状图）
      expect(mockChart.addSeries).toHaveBeenCalledTimes(3);
    });

    it('应该在配置无效时不添加系列', () => {
      const macdData: TechnicalIndicatorData[] = [
        { time: '2024-01-01', macd_dif: 1.5, macd_dea: 1.2, macd_hist: 0.3 }
      ];

      addMACDSeries(mockInstance, macdData, undefined as any);

      expect(mockChart.addSeries).not.toHaveBeenCalled();
    });
  });

  describe('addRSISeries', () => {
    it('应该正确添加RSI指标', () => {
      const rsiData: TechnicalIndicatorData[] = [
        { time: '2024-01-01', rsi_6: 65 },
        { time: '2024-01-02', rsi_6: 70 }
      ];

      addRSISeries(mockInstance, rsiData, 6, '#2196f3');

      // 应该添加3个系列（RSI线、超买线、超卖线）
      expect(mockChart.addSeries).toHaveBeenCalledTimes(3);
    });
  });

  describe('removeTechnicalIndicator', () => {
    it('应该正确删除MA指标', () => {
      const maSeries = { remove: vi.fn() };
      mockInstance.maSeries.set(5, maSeries as any);

      removeTechnicalIndicator(mockInstance, 'ma', 5);

      expect(mockChart.removeSeries).toHaveBeenCalledWith(maSeries);
      expect(mockInstance.maSeries.has(5)).toBe(false);
    });

    it('应该正确删除MACD指标', () => {
      mockInstance.macdSeries = {
        macd: { remove: vi.fn() },
        signal: { remove: vi.fn() },
        histogram: { remove: vi.fn() }
      };

      removeTechnicalIndicator(mockInstance, 'macd');

      expect(mockChart.removeSeries).toHaveBeenCalledTimes(3);
      expect(mockInstance.macdSeries.macd).toBeUndefined();
    });

    it('应该在图表实例不存在时静默返回', () => {
      const emptyInstance = { ...mockInstance, chart: null };

      expect(() => removeTechnicalIndicator(emptyInstance, 'ma', 5)).not.toThrow();
    });
  });

  describe('resizeChart', () => {
    it('应该正确调整图表大小', () => {
      resizeChart(mockInstance, 1000, 600);

      expect(mockChart.resize).toHaveBeenCalledWith(1000, 600);
    });
  });

  describe('destroyChart', () => {
    it('应该正确销毁图表实例', () => {
      // 添加一些系列
      mockInstance.candlestickSeries = mockSeries;
      mockInstance.volumeSeries = mockSeries;
      mockInstance.maSeries.set(5, mockSeries as any);

      destroyChart(mockInstance);

      expect(mockChart.removeSeries).toHaveBeenCalledTimes(2); // candlestick + volume
      expect(mockChart.remove).toHaveBeenCalled();
    });
  });

  describe('applyTheme', () => {
    it('应该正确应用深色主题', () => {
      applyTheme(mockInstance, 'dark');

      expect(mockChart.applyOptions).toHaveBeenCalledWith(expect.objectContaining({
        layout: {
          background: { type: 'solid', color: '#1a1a1a' },
          textColor: '#ffffff'
        }
      }));
    });

    it('应该正确应用浅色主题', () => {
      applyTheme(mockInstance, 'light');

      expect(mockChart.applyOptions).toHaveBeenCalledWith(expect.objectContaining({
        layout: {
          background: { type: 'solid', color: '#ffffff' },
          textColor: '#333333'
        }
      }));
    });
  });

  describe('monitorChartPerformance', () => {
    it('应该返回性能监控数据', () => {
      // 添加一些系列来模拟数据点
      mockInstance.maSeries.set(5, {} as any);
      mockInstance.maSeries.set(10, {} as any);
      mockInstance.macdSeries = { macd: {}, signal: {}, histogram: {} };

      const performance = monitorChartPerformance(mockInstance);

      expect(performance).toEqual(expect.objectContaining({
        renderTime: expect.any(Number),
        dataPoints: expect.any(Number),
        memoryUsage: expect.any(Number)
      }));

      expect(performance.dataPoints).toBe(5); // 2 MA + 3 MACD
    });
  });

  describe('缓存功能', () => {
    it('应该正确缓存数据', () => {
      const mockData: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 }
      ];

      updateChartData(mockInstance, mockData, { enableCache: true });

      const cacheKey = `chart_data_1_2024-01-01_2024-01-01`;
      const cachedData = getCachedData(cacheKey);

      expect(cachedData).toEqual(mockData);
    });

    it('应该正确清除缓存', () => {
      clearCache();

      const cachedData = getCachedData('any_key');
      expect(cachedData).toBeUndefined();
    });
  });
});