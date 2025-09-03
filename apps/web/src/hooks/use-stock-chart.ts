import { useState, useEffect } from 'react';
import type { ChartDataPoint } from '../types/charts';

interface StockChartHookReturn {
  data: ChartDataPoint[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStockChart(symbol?: string): StockChartHookReturn {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const refetch = () => {
    // Mock implementation
    console.log('Refetching stock data for:', symbol);
  };

  useEffect(() => {
    if (symbol) {
      setLoading(true);
      // Mock data fetching
      setTimeout(() => {
        setData([]);
        setLoading(false);
      }, 1000);
    }
  }, [symbol]);

  return {
    data,
    loading,
    error,
    refetch
  };
}