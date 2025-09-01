/**
 * 实时数据更新和缓存机制测试
 * 验证股票数据的实时更新、缓存策略、错误处理和性能优化
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// 导入测试设置
import '../../../test-setup';

// Mock timers
vi.useFakeTimers();

// Mock tRPC client
const mockTRPCClient = {
  stocks: {
    detail: {
      query: vi.fn(),
      useQuery: vi.fn(),
    },
    search: {
      query: vi.fn(),
      useQuery: vi.fn(),
    },
    dailyData: {
      query: vi.fn(),
      useQuery: vi.fn(),
    }
  },
};

vi.mock('../../../utils/trpc', () => ({
  trpc: mockTRPCClient,
}));

// 测试组件
interface MockStockData {
  name: string;
  close: number;
  ts_code: string;
}

const MockStockDetail = ({ symbol, enableRealTime = true }: { symbol: string; enableRealTime?: boolean }) => {
  const [data, setData] = React.useState<MockStockData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const result = await mockTRPCClient.stocks.detail.query({ ts_code: symbol });
        setData(result);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    if (enableRealTime) {
      const interval = setInterval(fetchData, 30000); // 30秒刷新
      return () => clearInterval(interval);
    }
  }, [symbol, enableRealTime]);

  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">Error: {error.message}</div>;
  if (!data) return <div data-testid="no-data">No data</div>;

  return (
    <div data-testid="stock-detail">
      <h1 data-testid="stock-name">{data.name}</h1>
      <div data-testid="stock-price">{data.close}</div>
      <div data-testid="last-updated">
        {lastUpdated ? lastUpdated.toISOString() : 'Never'}
      </div>
    </div>
  );
};

interface CacheEntry {
  data: MockStockData[];
  timestamp: number;
}

const CachedStockSearch = () => {
  const [cache, setCache] = React.useState<Map<string, CacheEntry>>(new Map());
  const [searchTerm, setSearchTerm] = React.useState('');
  const [results, setResults] = React.useState<MockStockData[]>([]);
  const [cacheHits, setCacheHits] = React.useState(0);
  const [cacheMisses, setCacheMisses] = React.useState(0);

  const search = React.useCallback(async (term: string) => {
    const cacheKey = `search:${term}`;
    
    // Check cache first
    if (cache.has(cacheKey)) {
      const cachedResult = cache.get(cacheKey);
      if (cachedResult) {
        const isExpired = Date.now() - cachedResult.timestamp > 300000; // 5分钟过期
        
        if (!isExpired) {
          setCacheHits(prev => prev + 1);
          setResults(cachedResult.data);
          return;
        }
      }
    }

    // Cache miss - fetch from API
    setCacheMisses(prev => prev + 1);
    try {
      const result = await mockTRPCClient.stocks.search.query({ keyword: term });
      
      // Update cache
      const newCache = new Map(cache);
      newCache.set(cacheKey, {
        data: result.stocks,
        timestamp: Date.now(),
      });
      setCache(newCache);
      setResults(result.stocks);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    }
  }, [cache]);

  return (
    <div data-testid="cached-search">
      <input
        data-testid="search-input"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          search(e.target.value);
        }}
      />
      <div data-testid="cache-stats">
        Hits: {cacheHits}, Misses: {cacheMisses}
      </div>
      <div data-testid="search-results">
        {results.map((stock, index) => (
          <div key={index} data-testid={`result-${index}`}>
            {stock.name}
          </div>
        ))}
      </div>
    </div>
  );
};

describe('实时数据更新机制', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('自动刷新功能', () => {
    it('应该按照设定间隔自动刷新数据', async () => {
      const mockData = { name: '平安银行', close: 12.34, ts_code: '000001.SZ' };
      mockTRPCClient.stocks.detail.query.mockResolvedValue(mockData);

      render(
        <QueryClientProvider client={queryClient}>
          <MockStockDetail symbol="000001.SZ" />
        </QueryClientProvider>
      );

      // 初始加载
      await waitFor(() => {
        expect(screen.getByTestId('stock-name')).toHaveTextContent('平安银行');
      });

      expect(mockTRPCClient.stocks.detail.query).toHaveBeenCalledTimes(1);

      // 快进30秒
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // 应该触发第二次调用
      await waitFor(() => {
        expect(mockTRPCClient.stocks.detail.query).toHaveBeenCalledTimes(2);
      });

      // 再次快进30秒
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // 应该触发第三次调用
      await waitFor(() => {
        expect(mockTRPCClient.stocks.detail.query).toHaveBeenCalledTimes(3);
      });
    });

    it('应该在组件卸载时清理定时器', async () => {
      const mockData = { name: '平安银行', close: 12.34, ts_code: '000001.SZ' };
      mockTRPCClient.stocks.detail.query.mockResolvedValue(mockData);

      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <MockStockDetail symbol="000001.SZ" />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('stock-name')).toHaveTextContent('平安银行');
      });

      expect(mockTRPCClient.stocks.detail.query).toHaveBeenCalledTimes(1);

      // 卸载组件
      unmount();

      // 快进时间，不应该再触发API调用
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(mockTRPCClient.stocks.detail.query).toHaveBeenCalledTimes(1);
    });

    it('应该支持禁用实时更新', async () => {
      const mockData = { name: '平安银行', close: 12.34, ts_code: '000001.SZ' };
      mockTRPCClient.stocks.detail.query.mockResolvedValue(mockData);

      render(
        <QueryClientProvider client={queryClient}>
          <MockStockDetail symbol="000001.SZ" enableRealTime={false} />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('stock-name')).toHaveTextContent('平安银行');
      });

      expect(mockTRPCClient.stocks.detail.query).toHaveBeenCalledTimes(1);

      // 快进时间
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      // 禁用实时更新时不应该再次调用
      expect(mockTRPCClient.stocks.detail.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('数据变更检测', () => {
    it('应该检测到价格变更并更新显示', async () => {
      let price = 12.34;
      mockTRPCClient.stocks.detail.query.mockImplementation(() => 
        Promise.resolve({ name: '平安银行', close: price, ts_code: '000001.SZ' })
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockStockDetail symbol="000001.SZ" />
        </QueryClientProvider>
      );

      // 初始价格
      await waitFor(() => {
        expect(screen.getByTestId('stock-price')).toHaveTextContent('12.34');
      });

      // 更新价格
      price = 13.45;

      // 触发刷新
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // 应该显示新价格
      await waitFor(() => {
        expect(screen.getByTestId('stock-price')).toHaveTextContent('13.45');
      });
    });

    it('应该更新最后更新时间戳', async () => {
      const mockData = { name: '平安银行', close: 12.34, ts_code: '000001.SZ' };
      mockTRPCClient.stocks.detail.query.mockResolvedValue(mockData);

      render(
        <QueryClientProvider client={queryClient}>
          <MockStockDetail symbol="000001.SZ" />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('stock-name')).toHaveTextContent('平安银行');
      });

      const firstUpdate = screen.getByTestId('last-updated').textContent;
      expect(firstUpdate).not.toBe('Never');

      // 等待一段时间后触发刷新
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        const secondUpdate = screen.getByTestId('last-updated').textContent;
        expect(secondUpdate).not.toBe(firstUpdate);
      });
    });
  });

  describe('错误处理和重试机制', () => {
    it('应该优雅处理网络错误', async () => {
      mockTRPCClient.stocks.detail.query.mockRejectedValue(new Error('Network error'));

      render(
        <QueryClientProvider client={queryClient}>
          <MockStockDetail symbol="000001.SZ" />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Error: Network error');
      });
    });

    it('应该在错误后继续尝试自动刷新', async () => {
      // 第一次调用失败
      mockTRPCClient.stocks.detail.query
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ name: '平安银行', close: 12.34, ts_code: '000001.SZ' });

      render(
        <QueryClientProvider client={queryClient}>
          <MockStockDetail symbol="000001.SZ" />
        </QueryClientProvider>
      );

      // 初始错误状态
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      // 快进到下次刷新
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // 应该恢复正常
      await waitFor(() => {
        expect(screen.getByTestId('stock-name')).toHaveTextContent('平安银行');
      });
    });

    it('应该处理超时错误', async () => {
      mockTRPCClient.stocks.detail.query.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        )
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockStockDetail symbol="000001.SZ" />
        </QueryClientProvider>
      );

      // 快进5秒触发超时
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Request timeout');
      });
    });
  });
});

describe('缓存机制测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('搜索结果缓存', () => {
    it('应该缓存搜索结果', async () => {
      const mockResults = { stocks: [{ name: '平安银行', ts_code: '000001.SZ' }] };
      mockTRPCClient.stocks.search.query.mockResolvedValue(mockResults);

      render(<CachedStockSearch />);

      const input = screen.getByTestId('search-input');
      
      // 第一次搜索
      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(changeEvent, 'target', {
          value: { value: '平安' },
          enumerable: true,
        });
        input.dispatchEvent(changeEvent);
      });

      await waitFor(() => {
        expect(screen.getByTestId('cache-stats')).toHaveTextContent('Hits: 0, Misses: 1');
      });

      // 第二次相同搜索应该命中缓存
      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(changeEvent, 'target', {
          value: { value: '平安' },
          enumerable: true,
        });
        input.dispatchEvent(changeEvent);
      });

      await waitFor(() => {
        expect(screen.getByTestId('cache-stats')).toHaveTextContent('Hits: 1, Misses: 1');
      });

      // 只应该调用API一次
      expect(mockTRPCClient.stocks.search.query).toHaveBeenCalledTimes(1);
    });

    it('应该处理缓存过期', async () => {
      const mockResults = { stocks: [{ name: '平安银行', ts_code: '000001.SZ' }] };
      mockTRPCClient.stocks.search.query.mockResolvedValue(mockResults);

      render(<CachedStockSearch />);

      const input = screen.getByTestId('search-input');
      
      // 第一次搜索
      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(changeEvent, 'target', {
          value: { value: '平安' },
          enumerable: true,
        });
        input.dispatchEvent(changeEvent);
      });

      await waitFor(() => {
        expect(screen.getByTestId('cache-stats')).toHaveTextContent('Hits: 0, Misses: 1');
      });

      // 快进超过缓存过期时间（5分钟）
      act(() => {
        vi.advanceTimersByTime(300001);
      });

      // 再次搜索应该重新获取数据
      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(changeEvent, 'target', {
          value: { value: '平安' },
          enumerable: true,
        });
        input.dispatchEvent(changeEvent);
      });

      await waitFor(() => {
        expect(screen.getByTestId('cache-stats')).toHaveTextContent('Hits: 0, Misses: 2');
      });

      expect(mockTRPCClient.stocks.search.query).toHaveBeenCalledTimes(2);
    });

    it('应该支持缓存不同搜索词', async () => {
      mockTRPCClient.stocks.search.query
        .mockResolvedValueOnce({ stocks: [{ name: '平安银行', ts_code: '000001.SZ' }] })
        .mockResolvedValueOnce({ stocks: [{ name: '招商银行', ts_code: '600036.SH' }] });

      render(<CachedStockSearch />);

      const input = screen.getByTestId('search-input');
      
      // 搜索第一个词
      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(changeEvent, 'target', {
          value: { value: '平安' },
          enumerable: true,
        });
        input.dispatchEvent(changeEvent);
      });

      // 搜索第二个词
      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(changeEvent, 'target', {
          value: { value: '招商' },
          enumerable: true,
        });
        input.dispatchEvent(changeEvent);
      });

      // 再次搜索第一个词，应该命中缓存
      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(changeEvent, 'target', {
          value: { value: '平安' },
          enumerable: true,
        });
        input.dispatchEvent(changeEvent);
      });

      await waitFor(() => {
        expect(screen.getByTestId('cache-stats')).toHaveTextContent('Hits: 1, Misses: 2');
      });

      // 总共调用API两次（两个不同的搜索词）
      expect(mockTRPCClient.stocks.search.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('缓存性能优化', () => {
    it('缓存命中应该显著快于API调用', async () => {
      const mockResults = { stocks: [{ name: '平安银行', ts_code: '000001.SZ' }] };
      
      // 模拟API延迟
      mockTRPCClient.stocks.search.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResults), 100))
      );

      render(<CachedStockSearch />);

      const input = screen.getByTestId('search-input');
      
      // 第一次搜索（API调用）
      const apiStartTime = performance.now();
      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(changeEvent, 'target', {
          value: { value: '平安' },
          enumerable: true,
        });
        input.dispatchEvent(changeEvent);
      });
      
      act(() => {
        vi.advanceTimersByTime(100);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('result-0')).toHaveTextContent('平安银行');
      });
      const apiEndTime = performance.now();
      const apiTime = apiEndTime - apiStartTime;

      // 第二次搜索（缓存命中）
      const cacheStartTime = performance.now();
      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(changeEvent, 'target', {
          value: { value: '平安' },
          enumerable: true,
        });
        input.dispatchEvent(changeEvent);
      });
      const cacheEndTime = performance.now();
      const cacheTime = cacheEndTime - cacheStartTime;

      // 缓存应该比API调用快得多
      expect(cacheTime).toBeLessThan(apiTime / 2);
    });

    it('应该限制缓存大小防止内存泄漏', async () => {
      // 创建有缓存大小限制的组件
      const LimitedCacheSearch = () => {
        const [cache, setCache] = React.useState<Map<string, { data: string; timestamp: number }>>(new Map());
        const maxCacheSize = 50;

        const addToCache = (key: string, value: { data: string; timestamp: number }) => {
          const newCache = new Map(cache);
          if (newCache.size >= maxCacheSize) {
            // 删除最旧的条目
            const firstKey = newCache.keys().next().value;
            if (firstKey !== undefined) {
              newCache.delete(firstKey);
            }
          }
          newCache.set(key, value);
          setCache(newCache);
        };

        return (
          <div data-testid="limited-cache">
            <div data-testid="cache-size">{cache.size}</div>
            <button 
              onClick={() => {
                for (let i = 0; i < 60; i++) {
                  addToCache(`key${i}`, { data: `value${i}`, timestamp: Date.now() });
                }
              }}
              data-testid="fill-cache"
            >
              Fill Cache
            </button>
          </div>
        );
      };

      render(<LimitedCacheSearch />);

      const button = screen.getByTestId('fill-cache');
      await act(async () => {
        button.click();
      });

      // 缓存大小应该被限制在50
      expect(screen.getByTestId('cache-size')).toHaveTextContent('50');
    });
  });
});

describe('性能监控和优化', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('响应时间监控', () => {
    it('应该记录API响应时间', async () => {
      const responseTimes: number[] = [];
      
      mockTRPCClient.stocks.detail.query.mockImplementation(async () => {
        const startTime = performance.now();
        const result = await new Promise(resolve => 
          setTimeout(() => resolve({ name: '平安银行', close: 12.34 }), 50)
        );
        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
        return result;
      });

      const TestComponent = () => {
        const [data, setData] = React.useState<MockStockData | null>(null);
        
        React.useEffect(() => {
          mockTRPCClient.stocks.detail.query({ ts_code: '000001.SZ' })
            .then(setData);
        }, []);

        return data ? <div data-testid="success">Success</div> : <div data-testid="loading">Loading</div>;
      };

      render(<TestComponent />);

      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(screen.getByTestId('success')).toBeInTheDocument();
      });

      expect(responseTimes).toHaveLength(1);
      expect(responseTimes[0]).toBeGreaterThan(40);
      expect(responseTimes[0]).toBeLessThan(100);
    });

    it('应该检测性能异常', async () => {
      const performanceThreshold = 200; // 200ms阈值
      let isSlowResponse = false;

      mockTRPCClient.stocks.detail.query.mockImplementation(() => 
        new Promise(resolve => {
          const delay = isSlowResponse ? 300 : 50;
          setTimeout(() => resolve({ name: '平安银行', close: 12.34 }), delay);
        })
      );

      const TestComponent = ({ slow = false }: { slow?: boolean }) => {
        isSlowResponse = slow;
        const [performanceAlert, setPerformanceAlert] = React.useState(false);
        
        React.useEffect(() => {
          const startTime = performance.now();
          mockTRPCClient.stocks.detail.query({ ts_code: '000001.SZ' })
            .then(() => {
              const responseTime = performance.now() - startTime;
              if (responseTime > performanceThreshold) {
                setPerformanceAlert(true);
              }
            });
        }, [slow]);

        return performanceAlert ? 
          <div data-testid="performance-alert">Slow response detected</div> : 
          <div data-testid="normal-response">Normal response</div>;
      };

      // 正常响应
      const { rerender } = render(<TestComponent slow={false} />);
      act(() => { vi.advanceTimersByTime(50); });
      await waitFor(() => {
        expect(screen.getByTestId('normal-response')).toBeInTheDocument();
      });

      // 慢响应
      rerender(<TestComponent slow={true} />);
      act(() => { vi.advanceTimersByTime(300); });
      await waitFor(() => {
        expect(screen.getByTestId('performance-alert')).toBeInTheDocument();
      });
    });
  });

  describe('内存使用优化', () => {
    it('应该清理过期数据', async () => {
      const TestComponent = () => {
        const [dataMap, setDataMap] = React.useState<Map<string, { value: string; expires: number }>>(new Map());
        
        const addData = (key: string, value: string, ttl: number = 5000) => {
          const newMap = new Map(dataMap);
          newMap.set(key, {
            value,
            expires: Date.now() + ttl,
          });
          setDataMap(newMap);
        };

        React.useEffect(() => {
          const cleanExpiredData = () => {
            const now = Date.now();
            const newMap = new Map<string, { value: string; expires: number }>();
            dataMap.forEach((item, key) => {
              if (item.expires > now) {
                newMap.set(key, item);
              }
            });
            setDataMap(newMap);
          };

          const interval = setInterval(cleanExpiredData, 1000);
          return () => clearInterval(interval);
        }, [dataMap]);

        return (
          <div data-testid="memory-test">
            <div data-testid="data-count">{dataMap.size}</div>
            <button 
              onClick={() => addData('test1', 'value1', 2000)}
              data-testid="add-short"
            >
              Add Short TTL
            </button>
            <button 
              onClick={() => addData('test2', 'value2', 10000)}
              data-testid="add-long"
            >
              Add Long TTL
            </button>
          </div>
        );
      };

      render(<TestComponent />);

      // 添加数据
      screen.getByTestId('add-short').click();
      screen.getByTestId('add-long').click();

      expect(screen.getByTestId('data-count')).toHaveTextContent('2');

      // 快进超过短TTL的时间
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-count')).toHaveTextContent('1');
      });
    });
  });
});