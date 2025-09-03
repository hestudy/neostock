// 真实的图表工具函数，集成lightweight-charts
import { createChart } from 'lightweight-charts';
import type { 
  ChartConfig, 
  ChartDataPoint, 
  TechnicalIndicatorData, 
  ChartInstance, 
  TechnicalIndicatorConfig,
  ChartTheme,
  PerformanceConfig,
  CandlestickData,
  HistogramData
} from '../types/charts';
import { defaultChartThemes } from '../types/charts';

// 默认性能配置
export const defaultPerformanceConfig: PerformanceConfig = {
  maxDataPoints: 1000,
  updateInterval: 100,
  enableCache: true,
  enableLazyLoading: true,
  chunkSize: 100,
};

// 数据缓存
const dataCache = new Map<string, ChartDataPoint[]>();

/**
 * 创建图表实例（真实实现）
 */
export function createChartInstance(config: ChartConfig): ChartInstance {
  const { container, width = 800, height = 400 } = config;
  
  // 创建真实的图表实例
  const chart = createChart(container, {
    width,
    height,
    layout: {
      background: { type: 'solid' as any, color: '#ffffff' },
      textColor: '#333333',
    },
    grid: {
      vertLines: { color: '#e0e0e0', style: 0 as any },
      horzLines: { color: '#e0e0e0', style: 0 as any },
    },
    crosshair: {
      mode: 0,
      vertLine: {
        width: 1,
        color: '#758696',
        style: 3 as any,
      },
      horzLine: {
        width: 1,
        color: '#758696',
        style: 3 as any,
      },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
    handleScale: {
      mouseWheel: true,
      pinch: true,
      axisPressedMouseMove: true,
      axisDoubleClickReset: true,
    },
    kineticScroll: {
      mouse: true,
      touch: true,
    },
  });

  // 创建蜡烛图系列
  const candlestickSeries = chart.addSeries('candlestick' as any, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderUpColor: '#26a69a',
    borderDownColor: '#ef5350',
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  });

  // 创建成交量系列
  const volumeSeries = chart.addSeries('histogram' as any, {
    color: '#2196f3',
    priceFormat: {
      type: 'volume',
    },
  });

  return {
    chart: chart as any,
    candlestickSeries: candlestickSeries as any,
    volumeSeries: volumeSeries as any,
    maSeries: new Map(),
    macdSeries: {},
    rsiSeries: new Map(),
  };
}

/**
 * 更新图表数据（真实实现）
 */
export function updateChartData(
  instance: ChartInstance, 
  data: ChartDataPoint[], 
  performanceConfig: PerformanceConfig = defaultPerformanceConfig,
  showVolume: boolean = true
): void {
  if (!instance.chart || !instance.candlestickSeries) return;
  
  const { maxDataPoints, enableCache } = performanceConfig;
  
  // 数据清理和验证
  let cleanedData = data
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      time: new Date(item.time).getTime() / 1000, // 转换为时间戳
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
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
    ) as CandlestickData[];

  // 限制数据点数量
  if (cleanedData.length > maxDataPoints) {
    cleanedData = cleanedData.slice(-maxDataPoints);
  }

  if (cleanedData.length === 0) return;

  // 更新蜡烛图数据
  instance.candlestickSeries.setData(cleanedData);

  // 更新成交量数据
  if (showVolume && instance.volumeSeries) {
    const volumeData = cleanedData.map(item => ({
      time: item.time,
      value: data.find(d => new Date(d.time).getTime() / 1000 === item.time)?.volume || 0,
      color: item.close >= item.open ? '#26a69a' : '#ef5350',
    }));
    instance.volumeSeries.setData(volumeData as HistogramData[]);
  } else if (!showVolume && instance.volumeSeries) {
    // 如果不显示成交量，清空数据
    instance.volumeSeries.setData([]);
  }

  // 缓存数据
  if (enableCache) {
    const cacheKey = `chart_data_${cleanedData.length}`;
    dataCache.set(cacheKey, cleanedData as any);
  }
}

/**
 * 添加技术指标（真实实现）
 */
export function addTechnicalIndicator(
  instance: ChartInstance,
  type: 'ma' | 'macd' | 'rsi',
  data: TechnicalIndicatorData[],
  config: TechnicalIndicatorConfig
): void {
  if (!instance.chart) return;

  switch (type) {
    case 'ma':
      if (config.ma?.periods) {
        config.ma.periods.forEach((period, index) => {
          const maData = data
            .filter(item => (item as any)[`ma${period}`] !== undefined)
            .map(item => ({
              time: new Date(item.time).getTime() / 1000,
              value: (item as any)[`ma${period}`]!,
            }));
          
          const maSeries = instance.chart.addSeries('line', {
            color: config.ma?.colors?.[index] || '#ff9800',
            lineWidth: 2,
            title: `MA${period}`,
          });
          maSeries.setData(maData);
          instance.maSeries.set(period, maSeries);
        });
      }
      break;

    case 'macd':
      if (config.macd) {
        const macdData = data
          .filter(item => item.macd_dif !== undefined)
          .map(item => ({
            time: new Date(item.time).getTime() / 1000,
            value: item.macd_dif!,
          }));
        
        const signalData = data
          .filter(item => item.macd_dea !== undefined)
          .map(item => ({
            time: new Date(item.time).getTime() / 1000,
            value: item.macd_dea!,
          }));
        
        const histData = data
          .filter(item => item.macd_hist !== undefined)
          .map(item => ({
            time: new Date(item.time).getTime() / 1000,
            value: item.macd_hist!,
            color: item.macd_hist! >= 0 ? '#26a69a' : '#ef5350',
          }));

        instance.macdSeries.macd = instance.chart.addSeries('line', {
          color: config.macd.colors.macd,
          lineWidth: 2,
          title: 'MACD',
        });
        instance.macdSeries.macd.setData(macdData);

        instance.macdSeries.signal = instance.chart.addSeries('line', {
          color: config.macd.colors.signal,
          lineWidth: 2,
          title: 'Signal',
        });
        instance.macdSeries.signal.setData(signalData);

        instance.macdSeries.histogram = instance.chart.addSeries('histogram', {
          color: config.macd.colors.histogram,
          title: 'Histogram',
        });
        instance.macdSeries.histogram.setData(histData);
      }
      break;

    case 'rsi':
      if (config.rsi?.periods && config.rsi?.colors) {
        config.rsi.periods.forEach((period, index) => {
          const rsiData = data
            .filter(item => (item as any)[`rsi_${period}`] !== undefined)
            .map(item => ({
              time: new Date(item.time).getTime() / 1000,
              value: (item as any)[`rsi_${period}`]!,
            }));
          
          const rsiSeries = instance.chart.addSeries('line', {
            color: config.rsi?.colors?.[index] || '#2196f3',
            lineWidth: 2,
            title: `RSI${period}`,
          });
          rsiSeries.setData(rsiData);
          instance.rsiSeries.set(period, rsiSeries);
        });
      }
      break;
  }
}

/**
 * 移除技术指标（真实实现）
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
        const series = instance.maSeries.get(period);
        if (series) {
          instance.chart.removeSeries(series);
          instance.maSeries.delete(period);
        }
      } else {
        instance.maSeries.forEach(series => {
          instance.chart.removeSeries(series);
        });
        instance.maSeries.clear();
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
        const series = instance.rsiSeries.get(period);
        if (series) {
          instance.chart.removeSeries(series);
          instance.rsiSeries.delete(period);
        }
      } else {
        instance.rsiSeries.forEach(series => {
          instance.chart.removeSeries(series);
        });
        instance.rsiSeries.clear();
      }
      break;
  }
}

/**
 * 调整图表大小（真实实现）
 */
export function resizeChart(instance: ChartInstance, width: number, height: number): void {
  if (!instance.chart) return;
  
  instance.chart.resize(width, height);
}

/**
 * 销毁图表实例（真实实现）
 */
export function destroyChart(instance: ChartInstance): void {
  if (!instance.chart) return;
  
  // 清理所有系列
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
  
  // 销毁图表实例 - 从DOM中移除容器
  // Note: Lightweight Charts doesn't have a built-in remove method, 
  // cleanup is handled by removing the container element
  
  // 清理缓存
  dataCache.clear();
}

/**
 * 应用主题（真实实现）
 */
export function applyTheme(instance: ChartInstance, theme: ChartTheme): void {
  if (!instance.chart) return;
  
  const themeConfig = defaultChartThemes[theme];
  if (!themeConfig) return;
  
  instance.chart.applyOptions({
    layout: {
      background: themeConfig.background,
      textColor: themeConfig.grid.vertLines.color,
    },
    grid: {
      vertLines: themeConfig.grid.vertLines as any,
      horzLines: themeConfig.grid.horzLines as any,
    },
    crosshair: {
      vertLine: themeConfig.crosshair.vertLine as any,
      horzLine: themeConfig.crosshair.horzLine as any,
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
  
  // 更新成交量颜色
  if (instance.volumeSeries) {
    instance.volumeSeries.applyOptions({
      color: themeConfig.volume.color,
    });
  }
}

/**
 * 获取性能统计（简化版本）
 */
export function getPerformanceStats(): {
  cacheSize: number;
  memoryUsage: number;
  renderTime: number;
} {
  return {
    cacheSize: dataCache.size,
    memoryUsage: 0, // 简化的内存使用统计
    renderTime: 0, // 简化的渲染时间统计
  };
}

/**
 * 清理缓存
 */
export function clearCache(): void {
  dataCache.clear();
}

/**
 * 预加载数据
 */
export function preloadData(key: string, data: ChartDataPoint[]): void {
  if (!key) return;
  
  if (dataCache.size >= 100) {
    // 限制缓存大小
    const firstKey = dataCache.keys().next().value;
    if (firstKey) {
      dataCache.delete(firstKey);
    }
  }
  dataCache.set(key, data);
}

/**
 * 格式化时间轴标签
 */
export function formatTimeAxis(time: number): string {
  const date = new Date(time * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化价格轴标签
 */
export function formatPriceAxis(price: number): string {
  if (price >= 1000) {
    return price.toFixed(0);
  } else if (price >= 100) {
    return price.toFixed(1);
  } else if (price >= 10) {
    return price.toFixed(2);
  } else if (price >= 1) {
    return price.toFixed(3);
  } else {
    return price.toFixed(4);
  }
}

/**
 * 格式化成交量标签
 */
export function formatVolumeAxis(volume: number): string {
  if (volume >= 100000000) {
    return `${(volume / 100000000).toFixed(1)}亿`;
  } else if (volume >= 10000) {
    return `${(volume / 10000).toFixed(1)}万`;
  } else {
    return volume.toString();
  }
}

/**
 * 配置图表轴格式化
 */
export function configureAxisFormatting(instance: ChartInstance): void {
  if (!instance.chart) return;

  instance.chart.applyOptions({
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      borderColor: '#e0e0e0',
      borderVisible: true,
    },
    localization: {
      priceFormatter: (price: number) => {
        return formatPriceAxis(price);
      },
    },
  });

  // 配置成交量轴格式化
  if (instance.volumeSeries) {
    instance.volumeSeries.applyOptions({
      priceFormat: {
        type: 'volume',
        precision: 0,
        minMove: 0.01,
      },
      scaleMargins: {
        top: 0.8,
        bottom: 0.1,
      },
    });

    instance.chart.priceScale('volume').applyOptions({
      borderColor: '#e0e0e0',
      borderVisible: true,
      autoScale: true,
      invertScale: false,
      alignLabels: true,
    });
  }
}

/**
 * 配置移动端图表轴格式化
 */
export function configureMobileAxisFormatting(instance: ChartInstance): void {
  if (!instance.chart) return;

  instance.chart.applyOptions({
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      borderColor: '#e0e0e0',
      borderVisible: true,
      barSpacing: 8, // 移动端减少柱间距
      minBarSpacing: 4,
    },
    localization: {
      priceFormatter: (price: number) => {
        // 移动端简化价格显示
        if (price >= 1000) {
          return price.toFixed(0);
        } else if (price >= 100) {
          return price.toFixed(1);
        } else {
          return price.toFixed(2);
        }
      },
    },
  });

  // 移动端优化成交量显示
  if (instance.volumeSeries) {
    instance.volumeSeries.applyOptions({
      priceFormat: {
        type: 'volume',
        minMove: 0.01,
      },
      scaleMargins: {
        top: 0.75, // 移动端调整成交量位置
        bottom: 0.05,
      },
    });

    instance.chart.priceScale('volume').applyOptions({
      borderColor: '#e0e0e0',
      borderVisible: true,
      autoScale: true,
      invertScale: false,
      alignLabels: true,
    });
  }
}

/**
 * 创建移动端优化的图表实例
 */
export function createMobileChartInstance(config: ChartConfig): ChartInstance {
  const { container, width = 375, height = 300 } = config;
  
  // 创建移动端优化的图表实例
  const chart = createChart(container, {
    width,
    height,
    layout: {
      background: { type: 'solid' as any, color: '#ffffff' },
      textColor: '#333333',
      fontSize: 12, // 移动端减小字体
    },
    grid: {
      vertLines: { color: '#e0e0e0', style: 0 as any },
      horzLines: { color: '#e0e0e0', style: 0 as any },
    },
    crosshair: {
      mode: 0,
      vertLine: {
        width: 1,
        color: '#758696',
        style: 3 as any,
        labelBackgroundColor: '#758696',
      },
      horzLine: {
        width: 1,
        color: '#758696',
        style: 3 as any,
        labelBackgroundColor: '#758696',
      },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
    handleScale: {
      mouseWheel: true,
      pinch: true,
      axisPressedMouseMove: true,
      axisDoubleClickReset: true,
    },
    kineticScroll: {
      mouse: true,
      touch: true,
    },
    // 移动端特定配置
    // trackingMode: 'exitMode', // 移动端跟踪模式 - 暂时注释掉，类型有问题
  });

  // 创建蜡烛图系列
  const candlestickSeries = chart.addSeries('candlestick' as any, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderUpColor: '#26a69a',
    borderDownColor: '#ef5350',
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    // 移动端优化
    borderVisible: true,
  });

  // 创建成交量系列
  const volumeSeries = chart.addSeries('histogram' as any, {
    color: '#2196f3',
    priceFormat: {
      type: 'volume',
    },
  });

  return {
    chart: chart as any,
    candlestickSeries: candlestickSeries as any,
    volumeSeries: volumeSeries as any,
    maSeries: new Map(),
    macdSeries: {},
    rsiSeries: new Map(),
  };
}

/**
 * 应用深色主题轴格式化
 */
export function applyDarkThemeAxisFormatting(instance: ChartInstance): void {
  if (!instance.chart) return;

  instance.chart.applyOptions({
    timeScale: {
      borderColor: '#2a2a2a',
    },
  });

  if (instance.volumeSeries) {
    instance.chart.priceScale('volume').applyOptions({
      borderColor: '#2a2a2a',
    });
  }
}

/**
 * 应用浅色主题轴格式化
 */
export function applyLightThemeAxisFormatting(instance: ChartInstance): void {
  if (!instance.chart) return;

  instance.chart.applyOptions({
    timeScale: {
      borderColor: '#e0e0e0',
    },
  });

  if (instance.volumeSeries) {
    instance.chart.priceScale('volume').applyOptions({
      borderColor: '#e0e0e0',
    });
  }
}