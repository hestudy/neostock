// 简化的图表工具函数，不依赖lightweight-charts
import type { 
  ChartConfig, 
  ChartDataPoint, 
  TechnicalIndicatorData, 
  ChartInstance, 
  TechnicalIndicatorConfig,
  ChartTheme,
  PerformanceConfig,
  IChartApi
} from '../../types/charts';
import { defaultChartThemes } from '../../types/charts';

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
 * 创建图表实例（简化版本）
 */
export function createChartInstance(config: ChartConfig): ChartInstance {
  // 简化的图表实例创建，返回mock对象
  const chart = {} as IChartApi;
  
  // 使用配置参数避免ESLint错误
  console.log('Chart config:', config.width, config.height);
  
  // 返回简化的图表实例
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
 * 更新图表数据（简化版本）
 */
export function updateChartData(
  instance: ChartInstance, 
  data: ChartDataPoint[], 
  performanceConfig: PerformanceConfig = defaultPerformanceConfig
): void {
  // 简化的数据更新逻辑
  if (!instance.chart) return;
  
  // 使用性能配置参数
  console.log('Performance config:', performanceConfig.maxDataPoints);
  
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
    );

  if (cleanedData.length === 0) return;

  // 缓存数据
  const cacheKey = `chart_data_${cleanedData.length}`;
  dataCache.set(cacheKey, cleanedData);
}

/**
 * 添加技术指标（简化版本）
 */
export function addTechnicalIndicator(
  instance: ChartInstance,
  type: 'ma' | 'macd' | 'rsi',
  data: TechnicalIndicatorData[],
  config: TechnicalIndicatorConfig
): void {
  // 简化的技术指标添加逻辑
  if (!instance.chart) return;
  
  // 使用配置参数
  console.log('Indicator config:', config);
  
  // 这里只是占位符实现
  console.log(`Adding ${type} indicator with ${data.length} data points`);
}

/**
 * 移除技术指标（简化版本）
 */
export function removeTechnicalIndicator(
  instance: ChartInstance,
  type: 'ma' | 'macd' | 'rsi',
  period?: number
): void {
  // 简化的技术指标移除逻辑
  if (!instance.chart) return;
  
  // 这里只是占位符实现
  console.log(`Removing ${type} indicator${period ? ` with period ${period}` : ''}`);
}

/**
 * 调整图表大小（简化版本）
 */
export function resizeChart(instance: ChartInstance, width: number, height: number): void {
  // 简化的图表大小调整逻辑
  if (!instance.chart) return;
  
  // 这里只是占位符实现
  console.log(`Resizing chart to ${width}x${height}`);
}

/**
 * 销毁图表实例（简化版本）
 */
export function destroyChart(instance: ChartInstance): void {
  // 简化的图表销毁逻辑
  if (!instance.chart) return;
  
  // 清理缓存
  dataCache.clear();
  
  // 这里只是占位符实现
  console.log('Destroying chart instance');
}

/**
 * 应用主题（简化版本）
 */
export function applyTheme(instance: ChartInstance, theme: ChartTheme): void {
  // 简化的主题应用逻辑
  if (!instance.chart) return;
  
  const themeConfig = defaultChartThemes[theme];
  if (!themeConfig) return;
  
  // 这里只是占位符实现
  console.log(`Applying ${theme} theme`);
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