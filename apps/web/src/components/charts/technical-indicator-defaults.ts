import type { IndicatorConfig } from './technical-indicator-config';

export type { IndicatorConfig };

// 获取默认配置
export function getDefaultConfig(): IndicatorConfig {
  return {
    ma: {
      enabled: true,
      periods: [5, 10, 20, 60],
      colors: ['#ff9800', '#4caf50', '#2196f3', '#9c27b0'],
    },
    macd: {
      enabled: true,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      colors: {
        macd: '#2196f3',
        signal: '#ff9800',
        histogram: '#4caf50',
      },
    },
    rsi: {
      enabled: true,
      periods: [6, 12, 24],
      overbought: 70,
      oversold: 30,
      colors: ['#2196f3', '#ff9800', '#4caf50'],
    },
  };
}