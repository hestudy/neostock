import { CrosshairMode } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

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
  candlestickSeries: ISeriesApi<'Candlestick'> | null;
  volumeSeries: ISeriesApi<'Histogram'> | null;
  maSeries: Map<number, ISeriesApi<'Line'>>;
  macdSeries: {
    macd?: ISeriesApi<'Line'>;
    signal?: ISeriesApi<'Line'>;
    histogram?: ISeriesApi<'Histogram'>;
  };
  rsiSeries: Map<number, ISeriesApi<'Line'>>;
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
}

// 导出默认主题配置
export const defaultChartThemes: Record<ChartTheme, ChartThemeConfig> = {
  light: {
    background: '#ffffff',
    grid: {
      vertLines: { color: '#e0e0e0', style: 0 },
      horzLines: { color: '#e0e0e0', style: 0 },
    },
    crosshair: {
      vertLine: { color: '#758696', style: 3 },
      horzLine: { color: '#758696', style: 3 },
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
      vertLines: { color: '#2a2a2a', style: 0 },
      horzLines: { color: '#2a2a2a', style: 0 },
    },
    crosshair: {
      vertLine: { color: '#758696', style: 3 },
      horzLine: { color: '#758696', style: 3 },
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