import { trpc } from '@/utils/trpc';
import { useState, useMemo } from 'react';

// Type definitions for tRPC stocks API
type TRPCStocksAPI = {
  stocks: {
    list: {
      useQuery: (params: undefined, options?: { enabled?: boolean; staleTime?: number }) => {
        data: Stock[] | undefined;
        isLoading: boolean;
        error: unknown;
        refetch: () => void;
      };
    };
    search: {
      useQuery: (params: { term: string }, options?: { enabled?: boolean; staleTime?: number }) => {
        data: Stock[] | undefined;
        isLoading: boolean;
        error: unknown;
      };
    };
    detail: {
      useQuery: (params: { code: string }, options?: { enabled?: boolean; staleTime?: number; refetchInterval?: number }) => {
        data: Stock | undefined;
        isLoading: boolean;
        error: unknown;
        refetch: () => void;
      };
    };
  };
};

export interface Stock {
  code: string;
  name: string;
  industry: string;
  price?: number;
  change?: number;
  changePercent?: number;
}

export function useStocks() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  // Fetch all stocks (this would be implemented when the API is ready)
  const { data: stocks, isLoading, error, refetch } = (trpc as unknown as TRPCStocksAPI).stocks.list.useQuery(
    undefined,
    {
      // Enable query when we have the API implemented
      enabled: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Search stocks based on search term
  const { data: searchResults, isLoading: isSearching } = (trpc as unknown as TRPCStocksAPI).stocks.search.useQuery(
    { term: searchTerm },
    {
      enabled: searchTerm.length > 0,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

  // Get stock details
  const { data: stockDetail, isLoading: isLoadingDetail } = (trpc as unknown as TRPCStocksAPI).stocks.detail.useQuery(
    { code: selectedStock! },
    {
      enabled: !!selectedStock,
      staleTime: 30 * 1000, // 30 seconds for real-time data
    }
  );

  // Filtered stocks based on search term (client-side filtering as fallback)
  const filteredStocks = useMemo(() => {
    if (!stocks || !searchTerm) return stocks || [];
    
    return stocks.filter(
      (stock: Stock) =>
        stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.industry.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stocks, searchTerm]);

  const searchStocks = (term: string) => {
    setSearchTerm(term);
  };

  const selectStock = (code: string) => {
    setSelectedStock(code);
  };

  const clearSelection = () => {
    setSelectedStock(null);
  };

  const refreshData = () => {
    refetch();
  };

  return {
    // Data
    stocks: stocks || [],
    searchResults: searchResults || [],
    filteredStocks,
    selectedStock: stockDetail,
    searchTerm,
    selectedStockCode: selectedStock,

    // Loading states
    isLoading,
    isSearching,
    isLoadingDetail,

    // Error states
    error,

    // Actions
    searchStocks,
    selectStock,
    clearSelection,
    refreshData,
  };
}

export function useStockDetail(code: string) {
  const { data: stock, isLoading, error, refetch } = (trpc as unknown as TRPCStocksAPI).stocks.detail.useQuery(
    { code },
    {
      enabled: !!code,
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 60 * 1000, // Refresh every minute for real-time updates
    }
  );

  const refresh = () => {
    refetch();
  };

  return {
    stock,
    isLoading,
    error,
    refresh,
  };
}

export function useStockSearch() {
  const [query, setQuery] = useState('');
  const [isDebounced, setIsDebounced] = useState(false);

  // Debounced search
  const { data: results, isLoading, error } = (trpc as unknown as TRPCStocksAPI).stocks.search.useQuery(
    { term: query },
    {
      enabled: query.length > 1,
      staleTime: 2 * 60 * 1000,
    }
  );

  // Debounce search input
  const debouncedSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout;

    return (term: string) => {
      setIsDebounced(true);
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        setQuery(term);
        setIsDebounced(false);
      }, 300);
    };
  }, []);

  const search = (term: string) => {
    debouncedSearch(term);
  };

  const clearSearch = () => {
    setQuery('');
    setIsDebounced(false);
  };

  return {
    results: results || [],
    isLoading: isLoading || isDebounced,
    error,
    search,
    clearSearch,
    query,
  };
}