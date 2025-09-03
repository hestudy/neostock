import { useQuery } from '@tanstack/react-query';
import { trpc } from '../utils/trpc';
import type { ChartDataPoint, TechnicalIndicatorData } from '../types/charts';
import { calculateMA, calculateMACD, calculateRSI } from '../lib/technical-indicators-calculator';

export interface StockDailyData {
  id: number;
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
}

export interface UseStockChartDataOptions {
  ts_code: string;
  start_date?: string;
  end_date?: string;
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * 股票图表数据 Hook
 * 用于获取和缓存股票日线数据
 */
export function useStockChartData({
  ts_code,
  start_date,
  end_date,
  enabled = true,
  refetchInterval
}: UseStockChartDataOptions) {
  return useQuery({
    queryKey: ['stocks', 'daily', ts_code, start_date, end_date],
    queryFn: () => (trpc as any).stocks?.getStockDailyData?.query?.({
      ts_code,
      start_date,
      end_date
    }) || Promise.resolve([]),
    enabled: enabled && !!ts_code,
    refetchInterval,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    gcTime: 30 * 60 * 1000, // 30分钟保持
    select: (data: any) => {
      // 转换数据格式以适配图表组件
      return (data || []).map((item: any) => ({
        time: item.trade_date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.vol
      })) as ChartDataPoint[];
    }
  });
}

export interface TechnicalIndicatorsData {
  ts_code: string;
  trade_date: string;
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

export interface UseTechnicalIndicatorsOptions {
  ts_code: string;
  indicators?: string[];
  start_date?: string;
  end_date?: string;
  enabled?: boolean;
}

/**
 * 技术指标数据 Hook
 * 用于获取和缓存技术指标数据
 */
export function useTechnicalIndicators({
  ts_code,
  indicators = ['ma', 'macd', 'rsi'],
  start_date,
  end_date,
  enabled = true
}: UseTechnicalIndicatorsOptions) {
  return useQuery({
    queryKey: ['stocks', 'indicators', ts_code, indicators, start_date, end_date],
    queryFn: async () => {
      // 首先获取基础数据
      const dailyData = await (trpc as any).stocks?.getStockDailyData?.query?.({
        ts_code,
        start_date,
        end_date
      }) || [];

      if (!dailyData || dailyData.length === 0) {
        return [] as TechnicalIndicatorsData[];
      }

      // 转换数据格式
      const chartData: ChartDataPoint[] = (dailyData as any[]).map((item: any) => ({
        time: item.trade_date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.vol
      }));

      // 计算技术指标
      const result: TechnicalIndicatorsData[] = [];

      for (let i = 0; i < chartData.length; i++) {
        const item = chartData[i];
        const indicatorData: TechnicalIndicatorsData = {
          ts_code,
          trade_date: item.time,
        };

        // 计算MA指标
        if (indicators.includes('ma')) {
          const ma5 = calculateMA(chartData.slice(0, i + 1), 5);
          const ma10 = calculateMA(chartData.slice(0, i + 1), 10);
          const ma20 = calculateMA(chartData.slice(0, i + 1), 20);
          const ma60 = calculateMA(chartData.slice(0, i + 1), 60);

          if (ma5[ma5.length - 1] !== undefined) indicatorData.ma5 = ma5[ma5.length - 1];
          if (ma10[ma10.length - 1] !== undefined) indicatorData.ma10 = ma10[ma10.length - 1];
          if (ma20[ma20.length - 1] !== undefined) indicatorData.ma20 = ma20[ma20.length - 1];
          if (ma60[ma60.length - 1] !== undefined) indicatorData.ma60 = ma60[ma60.length - 1];
        }

        // 计算MACD指标
        if (indicators.includes('macd')) {
          const macdData = calculateMACD(chartData.slice(0, i + 1));
          const latestMACD = macdData[macdData.length - 1];
          if (latestMACD) {
            indicatorData.macd_dif = latestMACD.macd_dif;
            indicatorData.macd_dea = latestMACD.macd_dea;
            indicatorData.macd_hist = latestMACD.macd_hist;
          }
        }

        // 计算RSI指标
        if (indicators.includes('rsi')) {
          const rsi6 = calculateRSI(chartData.slice(0, i + 1), 6);
          const rsi12 = calculateRSI(chartData.slice(0, i + 1), 12);
          const rsi24 = calculateRSI(chartData.slice(0, i + 1), 24);

          if (rsi6[rsi6.length - 1] !== undefined) indicatorData.rsi_6 = rsi6[rsi6.length - 1];
          if (rsi12[rsi12.length - 1] !== undefined) indicatorData.rsi_12 = rsi12[rsi12.length - 1];
          if (rsi24[rsi24.length - 1] !== undefined) indicatorData.rsi_24 = rsi24[rsi24.length - 1];
        }

        result.push(indicatorData);
      }

      return result;
    },
    enabled: enabled && !!ts_code && indicators.length > 0,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    gcTime: 30 * 60 * 1000, // 30分钟保持
  });
}

export interface UseStockChartOptions {
  ts_code: string;
  start_date?: string;
  end_date?: string;
  showTechnicalIndicators?: boolean;
  enabled?: boolean;
  refetchInterval?: number;
}

interface StockChartHookReturn {
  data: ChartDataPoint[];
  technicalIndicators: TechnicalIndicatorData[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * 完整的股票图表数据 Hook
 * 组合日线数据和技术指标数据
 * 保持向后兼容的API
 */
export function useStockChart(symbol?: string): StockChartHookReturn {
  const { data: dailyData = [], isLoading, error, refetch } = useStockChartData({
    ts_code: symbol || '',
    enabled: !!symbol
  });

  const { data: technicalIndicators = [] } = useTechnicalIndicators({
    ts_code: symbol || '',
    enabled: !!symbol
  });

  return {
    data: dailyData,
    technicalIndicators: technicalIndicators.map(indicator => ({
      ...indicator,
      time: (indicator as any).time || ''
    })) as TechnicalIndicatorData[],
    loading: isLoading,
    error,
    refetch
  };
}

/**
 * 新的图表Hook API，支持更多配置选项
 */
export function useStockChartAdvanced(options: UseStockChartOptions) {
  const dailyData = useStockChartData({
    ts_code: options.ts_code,
    start_date: options.start_date,
    end_date: options.end_date,
    enabled: options.enabled,
    refetchInterval: options.refetchInterval
  });

  const technicalIndicators = useTechnicalIndicators({
    ts_code: options.ts_code,
    start_date: options.start_date,
    end_date: options.end_date,
    enabled: options.enabled && options.showTechnicalIndicators
  });

  return {
    dailyData,
    technicalIndicators,
    isLoading: dailyData.isLoading || technicalIndicators.isLoading,
    isError: dailyData.isError || technicalIndicators.isError,
    error: dailyData.error || technicalIndicators.error,
    refetch: () => {
      dailyData.refetch();
      technicalIndicators.refetch();
    }
  };
}