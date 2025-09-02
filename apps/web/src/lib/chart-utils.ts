import { 
  createChart, 
  ColorType, 
  CrosshairMode,
  LineStyle,
  PriceScaleMode
} from 'lightweight-charts';
import type { 
  IChartApi, 
  ISeriesApi,
  SeriesDefinition
} from 'lightweight-charts';
import type { 
  ChartConfig, 
  ChartDataPoint, 
  TechnicalIndicatorData, 
  ChartInstance, 
  TechnicalIndicatorConfig,
  ChartTheme,
  PerformanceConfig
} from '../types/charts';
import { defaultChartThemes } from '../types/charts';

// 默认性能配置
const defaultPerformanceConfig: PerformanceConfig = {
  maxDataPoints: 1000,
  updateInterval: 100,
  enableCache: true,
  enableLazyLoading: true,
  chunkSize: 100,
};

// 数据缓存
const dataCache = new Map<string, ChartDataPoint[]>();

/**
 * 创建图表实例
 */
export function createChartInstance(config: ChartConfig): ChartInstance {
  const chart = createChart(config.container, {
    width: config.width || 800,
    height: config.height || 400,
    layout: {
      background: { type: ColorType.Solid, color: config.layout?.background || '#ffffff' },
      textColor: config.layout?.textColor || '#333333',
    },
    grid: {
      vertLines: {
        color: config.grid?.vertLines?.color || '#e0e0e0',
        style: config.grid?.vertLines?.style || LineStyle.Solid,
      },
      horzLines: {
        color: config.grid?.horzLines?.color || '#e0e0e0',
        style: config.grid?.horzLines?.style || LineStyle.Solid,
      },
    },
    crosshair: {
      mode: config.crosshair?.mode || CrosshairMode.Normal,
      vertLine: {
        width: (config.crosshair?.vertLine?.width || 1) as any,
        color: config.crosshair?.vertLine?.color || '#758696',
        style: config.crosshair?.vertLine?.style || LineStyle.Dotted,
      },
      horzLine: {
        width: (config.crosshair?.horzLine?.width || 1) as any,
        color: config.crosshair?.horzLine?.color || '#758696',
        style: config.crosshair?.horzLine?.style || LineStyle.Dotted,
      },
    },
  });

  return {
    chart,
    candlestickSeries: null,
    volumeSeries: null,
    maSeries: new Map(),
    macdSeries: {},
    rsiSeries: new Map(),
  };
}

/**
 * 更新图表数据
 */
export function updateChartData(
  instance: ChartInstance, 
  data: ChartDataPoint[], 
  performanceConfig: PerformanceConfig = defaultPerformanceConfig
): void {
  if (!instance.chart) return;

  // 数据清理和验证
  const cleanedData = data
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      time: item.time,
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
      volume: item.volume ? Number(item.volume) : undefined,
    }))
    .filter(item => 
      !isNaN(item.open) && 
      !isNaN(item.high) && 
      !isNaN(item.low) && 
      !isNaN(item.close) &&
      item.high >= item.low &&
      item.high >= item.open &&
      item.high >= item.close &&
      item.low <= item.open &&
      item.low <= item.close
    )
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // 限制数据点数量
  const limitedData = cleanedData.slice(-performanceConfig.maxDataPoints);

  // 创建或更新蜡烛图系列
  if (!instance.candlestickSeries) {
    instance.candlestickSeries = instance.chart.addSeries('Candlestick' as any, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
  }

  instance.candlestickSeries.setData(limitedData as any);

  // 缓存数据
  if (performanceConfig.enableCache) {
    const cacheKey = `chart_data_${limitedData.length}_${limitedData[0]?.time}_${limitedData[limitedData.length - 1]?.time}`;
    dataCache.set(cacheKey, limitedData);
  }
}

/**
 * 添加移动平均线
 */
export function addMASeries(
  instance: ChartInstance,
  data: TechnicalIndicatorData[],
  period: number,
  color: string
): void {
  if (!instance.chart || !data.length) return;

  const maData = data
    .filter(item => {
      const key = `ma${period}` as keyof TechnicalIndicatorData;
      return item[key] !== undefined;
    })
    .map(item => {
      const key = `ma${period}` as keyof TechnicalIndicatorData;
      return {
        time: item.time,
        value: item[key] as number,
      };
    });

  if (maData.length === 0) return;

  const maSeries = instance.chart.addSeries('Line' as any, {
    color,
    lineWidth: 2,
  });

  maSeries.setData(maData as any);
  instance.maSeries.set(period, maSeries as any);
}

/**
 * 添加MACD指标
 */
export function addMACDSeries(
  instance: ChartInstance,
  data: TechnicalIndicatorData[],
  config: TechnicalIndicatorConfig['macd']
): void {
  if (!instance.chart || !data.length || !config) return;

  const macdData = data.filter(item => 
    item.macd_dif !== undefined && 
    item.macd_dea !== undefined && 
    item.macd_hist !== undefined
  );

  if (macdData.length === 0) return;

  // MACD线
  instance.macdSeries.macd = instance.chart.addSeries('Line' as any, {
    color: config.colors.macd,
    lineWidth: 2,
  });

  instance.macdSeries.macd.setData(
    macdData.map(item => ({
      time: item.time,
      value: item.macd_dif!,
    })) as any
  );

  // 信号线
  instance.macdSeries.signal = instance.chart.addSeries('Line' as any, {
    color: config.colors.signal,
    lineWidth: 2,
  });

  instance.macdSeries.signal.setData(
    macdData.map(item => ({
      time: item.time,
      value: item.macd_dea!,
    })) as any
  );

  // 柱状图
  instance.macdSeries.histogram = instance.chart.addSeries('Histogram' as any, {
    color: '#2196f3',
  });

  instance.macdSeries.histogram.setData(
    macdData.map(item => ({
      time: item.time,
      value: item.macd_hist!,
      color: item.macd_hist! >= 0 ? (config.colors.histogram as any).up : (config.colors.histogram as any).down,
    })) as any
  );
}

/**
 * 添加RSI指标
 */
export function addRSISeries(
  instance: ChartInstance,
  data: TechnicalIndicatorData[],
  period: number,
  color: string,
  overbought: number = 70,
  oversold: number = 30
): void {
  if (!instance.chart || !data.length) return;

  const rsiData = data
    .filter(item => {
      const key = `rsi_${period}` as keyof TechnicalIndicatorData;
      return item[key] !== undefined;
    })
    .map(item => {
      const key = `rsi_${period}` as keyof TechnicalIndicatorData;
      return {
        time: item.time,
        value: item[key] as number,
      };
    });

  if (rsiData.length === 0) return;

  const rsiSeries = instance.chart.addSeries('Line' as any, {
    color,
    lineWidth: 2,
  });

  rsiSeries.setData(rsiData as any);
  instance.rsiSeries.set(period, rsiSeries as any);

  // 添加超买超卖线
  const overboughtLine = instance.chart.addSeries('Line' as any, {
    color: '#f44336',
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
  });

  overboughtLine.setData(
    rsiData.map(item => ({
      time: item.time,
      value: overbought,
    })) as any
  );

  const oversoldLine = instance.chart.addSeries('Line' as any, {
    color: '#4caf50',
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
  });

  oversoldLine.setData(
    rsiData.map(item => ({
      time: item.time,
      value: oversold,
    })) as any
  );
}

/**
 * 移除技术指标
 */
export function removeTechnicalIndicator(
  instance: ChartInstance,
  type: 'ma' | 'macd' | 'rsi',
  period?: number
): void {
  if (!instance.chart) return;

  switch (type) {
    case 'ma':
      if (period && instance.maSeries.has(period)) {
        instance.chart.removeSeries(instance.maSeries.get(period)!);
        instance.maSeries.delete(period);
      }
      break;
    case 'macd':
      if (instance.macdSeries.macd) {
        instance.chart.removeSeries(instance.macdSeries.macd);
        instance.macdSeries.macd = undefined;
      }
      if (instance.macdSeries.signal) {
        instance.chart.removeSeries(instance.macdSeries.signal);
        instance.macdSeries.signal = undefined;
      }
      if (instance.macdSeries.histogram) {
        instance.chart.removeSeries(instance.macdSeries.histogram);
        instance.macdSeries.histogram = undefined;
      }
      break;
    case 'rsi':
      if (period && instance.rsiSeries.has(period)) {
        instance.chart.removeSeries(instance.rsiSeries.get(period)!);
        instance.rsiSeries.delete(period);
      }
      break;
  }
}

/**
 * 调整图表大小
 */
export function resizeChart(instance: ChartInstance, width: number, height: number): void {
  if (instance.chart) {
    instance.chart.resize(width, height);
  }
}

/**
 * 销毁图表实例
 */
export function destroyChart(instance: ChartInstance): void {
  if (instance.chart) {
    // 移除所有系列
    if (instance.candlestickSeries) {
      instance.chart.removeSeries(instance.candlestickSeries);
    }
    if (instance.volumeSeries) {
      instance.chart.removeSeries(instance.volumeSeries);
    }
    
    instance.maSeries.forEach(series => {
      instance.chart.removeSeries(series);
    });
    instance.maSeries.clear();

    if (instance.macdSeries.macd) {
      instance.chart.removeSeries(instance.macdSeries.macd);
    }
    if (instance.macdSeries.signal) {
      instance.chart.removeSeries(instance.macdSeries.signal);
    }
    if (instance.macdSeries.histogram) {
      instance.chart.removeSeries(instance.macdSeries.histogram);
    }

    instance.rsiSeries.forEach(series => {
      instance.chart.removeSeries(series);
    });
    instance.rsiSeries.clear();

    // 销毁图表
    instance.chart.remove();
  }
}

/**
 * 应用主题
 */
export function applyTheme(instance: ChartInstance, theme: ChartTheme): void {
  if (!instance.chart) return;

  const themeConfig = defaultChartThemes[theme];

  instance.chart.applyOptions({
    layout: {
      background: { type: ColorType.Solid, color: themeConfig.background },
      textColor: theme === 'dark' ? '#ffffff' : '#333333',
    },
    grid: {
      vertLines: { color: themeConfig.grid.vertLines.color },
      horzLines: { color: themeConfig.grid.horzLines.color },
    },
    crosshair: {
      vertLine: { color: themeConfig.crosshair.vertLine.color },
      horzLine: { color: themeConfig.crosshair.horzLine.color },
    },
  });

  // 更新蜡烛图颜色
  if (instance.candlestickSeries) {
    instance.candlestickSeries.applyOptions({
      upColor: themeConfig.candlestick.upColor,
      downColor: themeConfig.candlestick.downColor,
      borderUpColor: themeConfig.candlestick.borderUpColor,
      borderDownColor: themeConfig.candlestick.borderDownColor,
      wickUpColor: themeConfig.candlestick.wickUpColor,
      wickDownColor: themeConfig.candlestick.wickDownColor,
    });
  }
}

/**
 * 获取缓存的数据
 */
export function getCachedData(cacheKey: string): ChartDataPoint[] | undefined {
  return dataCache.get(cacheKey);
}

/**
 * 清除缓存
 */
export function clearCache(): void {
  dataCache.clear();
}

/**
 * 性能监控
 */
export function monitorChartPerformance(instance: ChartInstance): {
  renderTime: number;
  dataPoints: number;
  memoryUsage: number;
} {
  const startTime = performance.now();
  
  // 模拟渲染性能测试
  const dataPoints = instance.maSeries.size + 
    (instance.macdSeries.macd ? 1 : 0) + 
    (instance.macdSeries.signal ? 1 : 0) + 
    (instance.macdSeries.histogram ? 1 : 0) + 
    instance.rsiSeries.size;

  const endTime = performance.now();
  const renderTime = endTime - startTime;

  // 估算内存使用（粗略估算）
  const memoryUsage = dataPoints * 100; // 每个数据点约100字节

  return {
    renderTime,
    dataPoints,
    memoryUsage,
  };
}