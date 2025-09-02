import { trpc } from '@/utils/trpc';
import { useState, useMemo, useCallback } from 'react';
import { searchResultsCache } from '@/lib/search-cache';

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
  const [lastQueryTime, setLastQueryTime] = useState(0);
  const [cachedResults, setCachedResults] = useState<Stock[]>([]);

  // Optimized debounced search with enhanced caching
  const { data: results, isLoading, error } = (trpc as unknown as TRPCStocksAPI).stocks.search.useQuery(
    { term: query },
    {
      enabled: query.length > 1,
      staleTime: 5 * 60 * 1000, // 5 minutes cache for better performance
    }
  );

  // Enhanced search function with intelligent caching
  const performSearch = useCallback(async (searchTerm: string): Promise<Stock[]> => {
    const startTime = performance.now();
    
    try {
      // Check cache first
      const cached = await searchResultsCache.getSearchResults(searchTerm, async () => {
        // Fallback to tRPC query
        const response = await fetch('/api/trpc/stocks.search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            json: { term: searchTerm },
          }),
        });
        
        if (!response.ok) {
          throw new Error('Search failed');
        }
        
        const data = await response.json();
        return data.result.data.json || [];
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      if (responseTime > 200) {
        console.warn(`Cached search response time ${responseTime.toFixed(2)}ms exceeded 200ms target`);
      }
      
      setCachedResults(cached);
      return cached;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }, []);

  // High-performance debounce with adaptive timing
  const debouncedSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout;

    return (term: string) => {
      const startTime = performance.now();
      setIsDebounced(true);
      clearTimeout(timeoutId);
      
      // Adaptive debounce timing based on input length and cache availability
      const hasCache = searchResultsCache.getStats().cache.size > 0;
      const debounceTime = term.length <= 2 ? (hasCache ? 50 : 150) : 
                         term.length <= 4 ? (hasCache ? 30 : 100) : 
                         (hasCache ? 20 : 50);
      
      timeoutId = setTimeout(() => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        setLastQueryTime(responseTime);
        
        setQuery(term);
        setIsDebounced(false);
        
        // Perform cached search
        if (term.length > 1) {
          performSearch(term);
        }
        
        // Performance logging
        if (responseTime > 100) {
          console.warn(`Search debounce time ${responseTime.toFixed(2)}ms exceeded 100ms target`);
        }
      }, debounceTime);
    };
  }, [performSearch]);

  // Real-time filtering for instant feedback (<100ms)
  const { data: allStocks } = (trpc as unknown as TRPCStocksAPI).stocks.list.useQuery(
    undefined,
    {
      enabled: true, // Always enabled for client-side filtering
      staleTime: 30 * 60 * 1000, // 30 minutes cache
    }
  );

  // Enhanced client-side filtering with performance optimization
  const instantResults = useMemo(() => {
    if (!query || !allStocks) return [];
    
    const startTime = performance.now();
    const searchTerm = query.toLowerCase();
    
    // Optimized filtering with early termination
    const filtered = [];
    const maxResults = 10; // Limit for performance
    
    for (let i = 0; i < allStocks.length && filtered.length < maxResults; i++) {
      const stock = allStocks[i];
      
      // Check all conditions with early termination
      if (stock.name.toLowerCase().includes(searchTerm) ||
          stock.code.toLowerCase().includes(searchTerm) ||
          stock.industry.toLowerCase().includes(searchTerm)) {
        filtered.push(stock);
      }
    }
    
    const endTime = performance.now();
    const filterTime = endTime - startTime;
    
    if (filterTime > 50) {
      console.warn(`Client-side filter time ${filterTime.toFixed(2)}ms exceeded 50ms target`);
    }
    
    return filtered;
  }, [query, allStocks]);

  // Combine results: cached results first, then API results
  const combinedResults = useMemo(() => {
    if (cachedResults.length > 0) {
      return cachedResults;
    }
    return results || [];
  }, [cachedResults, results]);

  const search = (term: string) => {
    debouncedSearch(term);
  };

  const clearSearch = () => {
    setQuery('');
    setIsDebounced(false);
    setCachedResults([]);
  };

  return {
    results: combinedResults,
    instantResults,
    isLoading: isLoading || isDebounced,
    error,
    search,
    clearSearch,
    query,
    performanceMetrics: {
      lastQueryTime,
      hasInstantResults: instantResults.length > 0,
      cacheStats: searchResultsCache.getStats(),
    },
  };
}