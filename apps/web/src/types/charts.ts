// Lightweight Charts TypeScript 类型定义
import { LineStyle } from 'lightweight-charts';
export interface IChartApi {
  applyOptions(options: Partial<ChartOptions>): void;
  options(): ChartOptions;
  resize(width: number, height: number, forceRepaint?: boolean): void;
  addSeries<T extends SeriesType>(seriesType: T, options?: SeriesOptions<T>): ISeriesApi<T>;
  removeSeries(series: ISeriesApi<SeriesType>): void;
  subscribeCrosshairMove(handler: CrosshairMoveEventHandler): void;
  unsubscribeCrosshairMove(handler: CrosshairMoveEventHandler): void;
  subscribeClick(handler: ClickEventHandler): void;
  unsubscribeClick(handler: ClickEventHandler): void;
  takeScreenshot(): string;
  subscribeVisibleTimeRangeChange(handler: VisibleTimeRangeChangeEventHandler): void;
  unsubscribeVisibleTimeRangeChange(handler: VisibleTimeRangeChangeEventHandler): void;
  subscribeVisibleLogicalRangeChange(handler: VisibleLogicalRangeChangeEventHandler): void;
  unsubscribeVisibleLogicalRangeChange(handler: VisibleLogicalRangeChangeEventHandler): void;
  priceScale(priceScaleId?: string): IPriceScaleApi;
  timeScale(): ITimeScaleApi;
}

export interface ISeriesApi<T extends SeriesType> {
  applyOptions(options: SeriesOptions<T>): void;
  options(): SeriesOptions<T>;
  setData(data: SeriesData[T]): void;
  update(bar: SeriesData[T]): void;
  markers(): readonly Marker[];
  setMarkers(markers: Marker[]): void;
  createPriceLine(options: PriceLineOptions): IPriceLine;
  removePriceLine(priceLine: IPriceLine): void;
  priceLines(): readonly IPriceLine[];
  series(): ISeriesApi<T>;
  priceScale(): IPriceScaleApi;
}

export interface IPriceScaleApi {
  applyOptions(options: PriceScaleOptions): void;
  options(): PriceScaleOptions;
  width(): number;
  height(): number;
}

export interface ITimeScaleApi {
  applyOptions(options: TimeScaleOptions): void;
  options(): TimeScaleOptions;
  width(): number;
  height(): number;
  scrollPosition(): number;
  scrollToPosition(position: number, animated?: boolean): void;
  getVisibleRange(): Range | null;
  setVisibleRange(range: Range): void;
  resetTimeScale(): void;
  fitContent(): void;
  logicalToCoordinate(logical: number): number | null;
  coordinateToLogical(coordinate: number): number | null;
}

export interface IPriceLine {
  applyOptions(options: PriceLineOptions): void;
  options(): PriceLineOptions;
  series(): ISeriesApi<SeriesType>;
}

export type CrosshairMode = 'normal' | 'magnet' | 'hidden';

// 图表选项
export interface ChartOptions {
  width?: number;
  height?: number;
  layout: {
    background?: string;
    textColor?: string;
    fontSize?: number;
    fontFamily?: string;
  };
  crosshair: {
    mode?: CrosshairMode;
    vertLine?: {
      width?: number;
      color?: string;
      style?: LineStyle;
      visible?: boolean;
      labelVisible?: boolean;
    };
    horzLine?: {
      width?: number;
      color?: string;
      style?: LineStyle;
      visible?: boolean;
      labelVisible?: boolean;
    };
  };
  grid: {
    vertLines?: {
      color?: string;
      style?: LineStyle;
      visible?: boolean;
    };
    horzLines?: {
      color?: string;
      style?: LineStyle;
      visible?: boolean;
    };
  };
  watermark?: {
    color?: string;
    visible?: boolean;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontStyle?: string;
  };
  handleScroll?: {
    mouseWheel?: boolean;
    pressedMouseMove?: boolean;
    horzTouchDrag?: boolean;
    vertTouchDrag?: boolean;
  };
  handleScale?: {
    axisPressedMouseMove?: boolean;
    axisDoubleClickReset?: boolean;
    mouseWheel?: boolean;
    pinch?: boolean;
  };
  localization?: {
    locale?: string;
    dateFormat?: string;
    timeFormatter?: (time: Time) => string;
    priceFormatter?: (price: number) => string;
  };
  timeScale?: {
    barSpacing?: number;
    minBarSpacing?: number;
    rightOffset?: number;
    fixLeftEdge?: boolean;
    lockVisibleTimeRangeOnResize?: boolean;
    rightBarStaysOnScroll?: boolean;
    borderVisible?: boolean;
    borderColor?: string;
    visible?: boolean;
    timeVisible?: boolean;
    secondsVisible?: boolean;
  };
}

// 系列类型
export type SeriesType = 'line' | 'candlestick' | 'bar' | 'area' | 'histogram' | 'baseline';

// 系列数据
export interface SeriesData {
  line: LineData[];
  candlestick: CandlestickData[];
  bar: BarData[];
  area: AreaData[];
  histogram: HistogramData[];
  baseline: BaselineData[];
}

export interface LineData {
  time: Time;
  value: number;
}

export interface CandlestickData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface BarData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AreaData {
  time: Time;
  value: number;
}

export interface HistogramData {
  time: Time;
  value: number;
  color?: string;
}

export interface BaselineData {
  time: Time;
  value: number;
}

export type Time = number | string | BusinessDay;

export interface BusinessDay {
  year: number;
  month: number;
  day: number;
}

// 系列选项
export type SeriesOptions<T extends SeriesType> = 
  T extends 'line' ? LineSeriesOptions :
  T extends 'candlestick' ? CandlestickSeriesOptions :
  T extends 'bar' ? BarSeriesOptions :
  T extends 'area' ? AreaSeriesOptions :
  T extends 'histogram' ? HistogramSeriesOptions :
  T extends 'baseline' ? BaselineSeriesOptions :
  never;

export interface LineSeriesOptions {
  title?: string;
  visible?: boolean;
  color?: string;
  lineStyle?: LineStyle;
  lineWidth?: number;
  lineType?: LineType;
  crosshairMarkerVisible?: boolean;
  crosshairMarkerRadius?: number;
  lastValueVisible?: boolean;
  priceLineVisible?: boolean;
  priceLineWidth?: number;
  priceLineColor?: string;
  priceLineStyle?: LineStyle;
  baseLineVisible?: boolean;
  baseLineWidth?: number;
  baseLineColor?: string;
  baseLineStyle?: LineStyle;
  priceFormat?: PriceFormat;
}

export interface CandlestickSeriesOptions {
  title?: string;
  visible?: boolean;
  upColor?: string;
  downColor?: string;
  borderUpColor?: string;
  borderDownColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
  borderVisible?: boolean;
  borderColor?: string;
  wickVisible?: boolean;
  wickColor?: string;
  wickStyle?: LineStyle;
  barStyle?: LineStyle;
  lineWidth?: number;
  scaleMargins?: {
    top: number;
    bottom: number;
  };
  priceFormat?: PriceFormat;
}

export interface BarSeriesOptions {
  title?: string;
  visible?: boolean;
  upColor?: string;
  downColor?: string;
  borderUpColor?: string;
  borderDownColor?: string;
  borderVisible?: boolean;
  borderColor?: string;
  wickVisible?: boolean;
  wickColor?: string;
  wickStyle?: LineStyle;
  barStyle?: LineStyle;
  lineWidth?: number;
  scaleMargins?: {
    top: number;
    bottom: number;
  };
  priceFormat?: PriceFormat;
}

export interface AreaSeriesOptions {
  title?: string;
  visible?: boolean;
  color?: string;
  lineStyle?: LineStyle;
  lineWidth?: number;
  lineType?: LineType;
  crosshairMarkerVisible?: boolean;
  crosshairMarkerRadius?: number;
  lastValueVisible?: boolean;
  priceLineVisible?: boolean;
  priceLineWidth?: number;
  priceLineColor?: string;
  priceLineStyle?: LineStyle;
  baseLineVisible?: boolean;
  baseLineWidth?: number;
  baseLineColor?: string;
  baseLineStyle?: LineStyle;
  priceFormat?: PriceFormat;
  topColor?: string;
  bottomColor?: string;
  invertFilledArea?: boolean;
}

export interface HistogramSeriesOptions {
  title?: string;
  visible?: boolean;
  color?: string;
  base?: number;
  lineWidth?: number;
  priceFormat?: PriceFormat;
  scaleMargins?: {
    top: number;
    bottom: number;
  };
}

export interface BaselineSeriesOptions {
  title?: string;
  visible?: boolean;
  color?: string;
  lineStyle?: LineStyle;
  lineWidth?: number;
  lineType?: LineType;
  crosshairMarkerVisible?: boolean;
  crosshairMarkerRadius?: number;
  lastValueVisible?: boolean;
  priceLineVisible?: boolean;
  priceLineWidth?: number;
  priceLineColor?: string;
  priceLineStyle?: LineStyle;
  baseLineVisible?: boolean;
  baseLineWidth?: number;
  baseLineColor?: string;
  baseLineStyle?: LineStyle;
  priceFormat?: PriceFormat;
  baseValue?: {
    type: 'price' | 'average';
    price?: number;
  };
  topFillColor1?: string;
  topFillColor2?: string;
  bottomFillColor1?: string;
  bottomFillColor2?: string;
}

export type LineType = 0 | 1 | 2; // Simple, WithSteps, Curved

export interface PriceFormat {
  type: 'price' | 'volume' | 'percent' | 'custom';
  precision?: number;
  minMove?: number;
}

// 标记
export interface Marker {
  id?: string;
  time: Time;
  position: 'aboveBar' | 'belowBar' | 'inBar' | 'behindBar';
  color: string;
  shape: 'circle' | 'square' | 'triangleUp' | 'triangleDown' | 'cross' | 'x' | 'arrowUp' | 'arrowDown';
  size?: number;
  text?: string;
}

// 价格线
export interface PriceLineOptions {
  price: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  style?: LineStyle;
  lineWidth?: number;
  axisLabelVisible?: boolean;
  title?: string;
}

// 价格比例选项
export interface PriceScaleOptions {
  visible?: boolean;
  autoScale?: boolean;
  mode?: 'normal' | 'logarithmic' | 'percentage' | 'indexedTo100';
  invertScale?: boolean;
  alignLabels?: boolean;
  borderVisible?: boolean;
  borderColor?: string;
  entireTextOnly?: boolean;
  lockVisibleTextRange?: boolean;
  scaleMargins?: {
    top: number;
    bottom: number;
  };
}

// 时间比例选项
export interface TimeScaleOptions {
  visible?: boolean;
  timeVisible?: boolean;
  secondsVisible?: boolean;
  shiftVisibleRangeOnNewBar?: boolean;
  borderVisible?: boolean;
  borderColor?: string;
  rightOffset?: number;
  barSpacing?: number;
  minBarSpacing?: number;
  fixLeftEdge?: boolean;
  fixRightEdge?: boolean;
  lockVisibleTimeRangeOnResize?: boolean;
  rightBarStaysOnScroll?: boolean;
  allowShiftVisibleRangeOnWhitespaceReplacement?: boolean;
}

// 事件处理程序类型
export type CrosshairMoveEventHandler = (param: CrosshairMovedEvent) => void;
export type ClickEventHandler = (param: MouseEventParams) => void;
export type VisibleTimeRangeChangeEventHandler = (param: TimeRangeEvent) => void;
export type VisibleLogicalRangeChangeEventHandler = (param: LogicalRangeEvent) => void;

export interface CrosshairMovedEvent extends MouseEventParams {
  hoveredObject?: HoveredObject;
}

export interface MouseEventParams {
  time?: Time;
  point?: { x: number; y: number };
  hoveredSeries?: ISeriesApi<SeriesType>;
  hoveredObjectId?: number;
  seriesData?: Record<string, TimePointData>;
}

export interface TimePointData {
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface HoveredObject {
  hitTestData?: unknown;
  externalId?: string;
}

export interface TimeRangeEvent {
  from: Time;
  to: Time;
}

export interface LogicalRangeEvent {
  from: Logical;
  to: Logical;
}

export interface Range {
  from: Time;
  to: Time;
}

export interface Logical {
  index: number;
}

// 图表数据类型
export interface ChartDataPoint {
  time: string; // YYYY-MM-DD 格式
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// 技术指标数据类型
export interface TechnicalIndicatorData {
  time: string;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
  macd_dif?: number;
  macd_dea?: number;
  macd_hist?: number;
  rsi_6?: number;
  rsi_12?: number;
  rsi_24?: number;
}

// 图表配置类型
export interface ChartConfig {
  container: HTMLElement;
  width?: number;
  height?: number;
  layout?: {
    background?: string;
    textColor?: string;
  };
  grid?: {
    vertLines?: {
      color?: string;
      style?: number;
    };
    horzLines?: {
      color?: string;
      style?: number;
    };
  };
  crosshair?: {
    mode?: CrosshairMode;
    vertLine?: {
      width?: number;
      color?: string;
      style?: number;
    };
    horzLine?: {
      width?: number;
      color?: string;
      style?: number;
    };
  };
}

// 技术指标配置
export interface TechnicalIndicatorConfig {
  ma?: {
    periods: number[];
    colors: string[];
  };
  macd?: {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
    colors: {
      macd: string;
      signal: string;
      histogram: string;
    };
  };
  rsi?: {
    periods: number[];
    overbought: number;
    oversold: number;
    colors: string[];
  };
}

// 图表主题类型
export type ChartTheme = 'light' | 'dark';

// 图表实例管理
export interface ChartInstance {
  chart: IChartApi;
  candlestickSeries: ISeriesApi<'candlestick'> | null;
  volumeSeries: ISeriesApi<'histogram'> | null;
  maSeries: Map<number, ISeriesApi<'line'>>;
  macdSeries: {
    macd?: ISeriesApi<'line'>;
    signal?: ISeriesApi<'line'>;
    histogram?: ISeriesApi<'histogram'>;
  };
  rsiSeries: Map<number, ISeriesApi<'line'>>;
  lastClickTime?: number;
}

// 图表工具函数类型
export type ChartUtils = {
  createChart: (config: ChartConfig) => ChartInstance;
  updateData: (instance: ChartInstance, data: ChartDataPoint[]) => void;
  addTechnicalIndicator: (
    instance: ChartInstance,
    type: 'ma' | 'macd' | 'rsi',
    data: TechnicalIndicatorData[],
    config: TechnicalIndicatorConfig
  ) => void;
  removeTechnicalIndicator: (
    instance: ChartInstance,
    type: 'ma' | 'macd' | 'rsi',
    period?: number
  ) => void;
  resizeChart: (instance: ChartInstance, width: number, height: number) => void;
  destroyChart: (instance: ChartInstance) => void;
};

// 主题配置类型
export interface ChartThemeConfig {
  background: string;
  grid: {
    vertLines: { color: string; style: number };
    horzLines: { color: string; style: number };
  };
  crosshair: {
    vertLine: { color: string; style: number };
    horzLine: { color: string; style: number };
  };
  watermark: { color: string };
  candlestick: {
    upColor: string;
    downColor: string;
    borderUpColor: string;
    borderDownColor: string;
    wickUpColor: string;
    wickDownColor: string;
  };
  volume: {
    color: string;
  };
  ma: {
    colors: string[];
  };
  macd: {
    macd: string;
    signal: string;
    histogram: string;
  };
  rsi: {
    colors: string[];
    overbought: string;
    oversold: string;
  };
}

// 图表事件类型
export interface ChartEvents {
  onCrosshairMove?: (param: unknown) => void;
  onClick?: (param: unknown) => void;
  onVisibleTimeRangeChange?: (param: unknown) => void;
  onVisibleLogicalRangeChange?: (param: unknown) => void;
}

// 图表性能配置
export interface PerformanceConfig {
  maxDataPoints: number;
  updateInterval: number;
  enableCache: boolean;
  enableLazyLoading: boolean;
  chunkSize: number;
  enableSmartCaching?: boolean;
  enablePerformanceMonitoring?: boolean;
}

// 多指标布局配置类型
export interface MultiIndicatorLayoutConfig {
  layoutMode: 'stacked' | 'overlay' | 'grid' | 'tabs';
  gridColumns?: number;
  gridRows?: number;
  stackedHeight?: { [key: string]: number };
  overlayZIndex?: { [key: string]: number };
  spacing?: number;
  enableAnimations?: boolean;
  responsiveBreakpoints?: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  virtualization?: {
    visibleDataPoints: number;
    preloadDataPoints: number;
    chunkSize: number;
    enabled: boolean;
    scrollThreshold: number;
    renderDelay: number;
  };
  enablePerformanceMonitoring?: boolean;
  enableSmartCaching?: boolean;
  rendering?: {
    enableDebouncing: boolean;
    debounceDelay: number;
  };
}

// 指标布局信息
export interface IndicatorLayoutInfo {
  id: string;
  type: 'ma' | 'macd' | 'rsi';
  position: { x: number; y: number; width: number; height: number };
  visible: boolean;
  zIndex: number;
  chartRef?: IChartApi;
  seriesRefs?: ISeriesApi<SeriesType>[];
  priceScaleId?: string;
}

// 指标配置类型
export interface IndicatorConfig {
  ma: {
    enabled: boolean;
    periods: number[];
    colors: string[];
  };
  macd?: {
    enabled: boolean;
    fastPeriod: number;
    slowPeriod?: number;
    signalPeriod?: number;
    colors?: {
      macd: string;
      signal: string;
      histogram: string;
    };
  };
  rsi?: {
    enabled: boolean;
    periods: number[];
    overbought: number;
    oversold: number;
    colors: string[];
  };
}

// 技术指标数据接口 - 用于向后兼容
export interface TechnicalIndicatorsData {
  time: string;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
  macd?: number;
  macd_dif?: number;
  macd_dea?: number;
  macd_hist?: number;
  rsi?: number;
  rsi_6?: number;
  rsi_12?: number;
  rsi_24?: number;
}

// 性能指标类型
export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  fps: number;
  cacheHitRate?: number;
  visibleIndicators?: number;
  totalIndicators?: number;
  dataProcessingTime?: number;
  layoutCalculationTime?: number;
}

// 颜色类型
export type ColorType = 'solid' | 'gradient';

// 导出默认主题配置
export const defaultChartThemes: Record<ChartTheme, ChartThemeConfig> = {
  light: {
    background: '#ffffff',
    grid: {
      vertLines: { color: '#e0e0e0', style: LineStyle.Solid },
      horzLines: { color: '#e0e0e0', style: LineStyle.Solid },
    },
    crosshair: {
      vertLine: { color: '#758696', style: LineStyle.Dashed },
      horzLine: { color: '#758696', style: LineStyle.Dashed },
    },
    watermark: { color: 'rgba(0, 0, 0, 0.1)' },
    candlestick: {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    },
    volume: {
      color: '#2196f3',
    },
    ma: {
      colors: ['#ff9800', '#4caf50', '#2196f3', '#9c27b0'],
    },
    macd: {
      macd: '#2196f3',
      signal: '#ff9800',
      histogram: '#4caf50',
    },
    rsi: {
      colors: ['#2196f3', '#ff9800', '#4caf50'],
      overbought: '#f44336',
      oversold: '#4caf50',
    },
  },
  dark: {
    background: '#1a1a1a',
    grid: {
      vertLines: { color: '#2a2a2a', style: LineStyle.Solid },
      horzLines: { color: '#2a2a2a', style: LineStyle.Solid },
    },
    crosshair: {
      vertLine: { color: '#758696', style: LineStyle.Dashed },
      horzLine: { color: '#758696', style: LineStyle.Dashed },
    },
    watermark: { color: 'rgba(255, 255, 255, 0.1)' },
    candlestick: {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    },
    volume: {
      color: '#2196f3',
    },
    ma: {
      colors: ['#ff9800', '#4caf50', '#2196f3', '#9c27b0'],
    },
    macd: {
      macd: '#2196f3',
      signal: '#ff9800',
      histogram: '#4caf50',
    },
    rsi: {
      colors: ['#2196f3', '#ff9800', '#4caf50'],
      overbought: '#f44336',
      oversold: '#4caf50',
    },
  },
};

