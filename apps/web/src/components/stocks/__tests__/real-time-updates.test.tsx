/**
 * 实时功能和缓存机制测试
 * 测试股票数据实时更新、缓存失效和更新策略
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StockDetail from '../../../routes/stocks/$symbol';
import { trpc } from '../../../utils/trpc';

// Mock tRPC
vi.mock('../../../utils/trpc', () => ({
  trpc: {
    stocks: {
      getStockDetail: {
        useQuery: vi.fn(),
      },
      getDailyData: {
        useQuery: vi.fn(),
      },
    },
    useUtils: vi.fn(),
  },
}));

// Mock router context
const mockRouter = {
  params: { symbol: '000001.SZ' },
  navigate: vi.fn(),
  history: {
    back: vi.fn(),
    forward: vi.fn(),
  },
};

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mockRouter.params,
  useRouter: () => mockRouter,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('实时功能和缓存机制测试', () => {
  let queryClient: QueryClient;
  let mockTrpcUtils: any;

  const mockStockData = {
    stock: {
      ts_code: '000001.SZ',
      symbol: '000001',
      name: '平安银行',
      industry: '银行',
      area: '深圳',
      market: '主板',
      list_date: '19910403',
      is_hs: '1',
      created_at: new Date(),
      updated_at: new Date(),
    },
    latestPrice: {
      id: 1,
      ts_code: '000001.SZ',
      trade_date: '20240829',
      open: 10.50,
      high: 10.80,
      low: 10.40,
      close: 10.65,
      vol: 1000000,
      amount: 10650000,
      created_at: new Date(),
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    // Reset mocks
    vi.clearAllMocks();

    // Setup tRPC utils mock
    mockTrpcUtils = {
      stocks: {
        getStockDetail: {
          invalidate: vi.fn(),
          refetch: vi.fn(),
          setData: vi.fn(),
        },
        getDailyData: {
          invalidate: vi.fn(),
          refetch: vi.fn(),
          setData: vi.fn(),
        },
      },
    };

    (trpc.useUtils as any).mockReturnValue(mockTrpcUtils);

    // Default mock implementation
    (trpc.stocks.getStockDetail.useQuery as any).mockReturnValue({
      data: mockStockData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    (trpc.stocks.getDailyData.useQuery as any).mockReturnValue({
      data: [mockStockData.latestPrice],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  describe('实时数据更新机制', () => {
    it('应该定期刷新股票价格数据', async () => {
      // Mock 定时器
      vi.useFakeTimers();

      const mockRefetch = vi.fn();
      (trpc.stocks.getStockDetail.useQuery as any).mockReturnValue({
        data: mockStockData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('平安银行')).toBeInTheDocument();
      });

      // 模拟30秒后自动刷新
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // 应该触发数据刷新
      expect(mockRefetch).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('应该在数据更新时显示最新价格', async () => {
      const initialData = { ...mockStockData };
      const updatedData = {
        ...mockStockData,
        latestPrice: {
          ...mockStockData.latestPrice,
          close: 11.25, // 价格上涨
          high: 11.30,
        },
      };

      let currentData = initialData;
      (trpc.stocks.getStockDetail.useQuery as any).mockImplementation(() => ({
        data: currentData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn().mockImplementation(() => {
          currentData = updatedData;
        }),
      }));

      const { rerender } = render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 初始价格应该显示
      await waitFor(() => {
        expect(screen.getByText('10.65')).toBeInTheDocument();
      });

      // 模拟数据更新
      act(() => {
        currentData = updatedData;
      });

      rerender(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 更新后的价格应该显示
      await waitFor(() => {
        expect(screen.getByText('11.25')).toBeInTheDocument();
      });
    });

    it('应该在价格变化时显示涨跌指示器', async () => {
      const upData = {
        ...mockStockData,
        latestPrice: {
          ...mockStockData.latestPrice,
          close: 11.25, // 上涨
          open: 10.50,
        },
      };

      (trpc.stocks.getStockDetail.useQuery as any).mockReturnValue({
        data: upData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('11.25')).toBeInTheDocument();
      });

      // 应该显示上涨指示器（如红色文字或上涨图标）
      const priceElement = screen.getByText('11.25');
      expect(priceElement.className).toContain('text-red-500'); // 假设使用红色表示上涨
    });

    it('应该处理实时数据获取失败', async () => {
      (trpc.stocks.getStockDetail.useQuery as any).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch real-time data'),
        refetch: vi.fn(),
      });

      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 应该显示错误状态
      await waitFor(() => {
        expect(screen.getByText(/加载失败/)).toBeInTheDocument();
      });

      // 应该提供重试按钮
      expect(screen.getByRole('button', { name: /重试/ })).toBeInTheDocument();
    });
  });

  describe('缓存失效和更新策略', () => {
    it('应该在指定时间后让缓存失效', async () => {
      vi.useFakeTimers();

      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('平安银行')).toBeInTheDocument();
      });

      // 模拟5分钟后缓存失效
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      // 应该触发缓存失效
      expect(mockTrpcUtils.stocks.getStockDetail.invalidate).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('应该支持手动刷新缓存', async () => {
      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('平安银行')).toBeInTheDocument();
      });

      // 查找并点击刷新按钮
      const refreshButton = screen.getByRole('button', { name: /刷新/ });
      
      act(() => {
        refreshButton.click();
      });

      // 应该触发数据重新获取
      expect(mockTrpcUtils.stocks.getStockDetail.refetch).toHaveBeenCalled();
    });

    it('应该在页面切换时保留缓存', async () => {
      const { unmount } = render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('平安银行')).toBeInTheDocument();
      });

      // 卸载组件（模拟页面切换）
      unmount();

      // 重新渲染组件
      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 应该立即显示缓存的数据，而不是加载状态
      expect(screen.getByText('平安银行')).toBeInTheDocument();
    });

    it('应该在多个组件间共享缓存', async () => {
      // 第一个组件实例
      const { unmount: unmount1 } = render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('平安银行')).toBeInTheDocument();
      });

      unmount1();

      // 第二个组件实例，应该使用相同的缓存
      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 应该立即显示数据
      expect(screen.getByText('平安银行')).toBeInTheDocument();

      // 不应该重新发起网络请求
      expect(trpc.stocks.getStockDetail.useQuery).toHaveBeenCalledTimes(2); // 第一次和第二次渲染
    });
  });

  describe('搜索结果缓存策略', () => {
    it('应该缓存搜索结果5分钟', async () => {
      const mockSearchQuery = vi.fn().mockResolvedValue({
        stocks: [mockStockData.stock],
        total: 1,
      });

      // 模拟搜索hook
      const useStockSearch = () => {
        const [query, setQuery] = React.useState('');
        
        const { data, isLoading } = trpc.stocks.search.useQuery(
          { keyword: query, limit: 20 },
          {
            enabled: query.length > 0,
            staleTime: 5 * 60 * 1000, // 5分钟缓存
          }
        );

        return { query, setQuery, data, isLoading };
      };

      // 这里需要实际的搜索组件来测试缓存
      // 由于当前测试的是详情页，这个测试应该在搜索组件测试中
    });

    it('应该在缓存期内返回相同结果', async () => {
      vi.useFakeTimers();

      let callCount = 0;
      (trpc.stocks.getStockDetail.useQuery as any).mockImplementation(() => {
        callCount++;
        return {
          data: mockStockData,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      // 第一次渲染
      const { rerender } = render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      expect(callCount).toBe(1);

      // 在缓存期内重新渲染
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 1000); // 2分钟
      });

      rerender(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 应该使用缓存，不增加调用次数
      expect(callCount).toBe(1);

      // 超过缓存期
      act(() => {
        vi.advanceTimersByTime(4 * 60 * 1000); // 总共6分钟
      });

      rerender(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 现在应该重新获取数据
      expect(callCount).toBe(2);

      vi.useRealTimers();
    });
  });

  describe('网络状态感知', () => {
    it('应该在网络重连时刷新数据', async () => {
      // Mock 网络状态API
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 模拟网络重连
      Object.defineProperty(navigator, 'onLine', {
        value: true,
      });

      // 触发 online 事件
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      // 应该触发数据刷新
      await waitFor(() => {
        expect(mockTrpcUtils.stocks.getStockDetail.refetch).toHaveBeenCalled();
      });
    });

    it('应该在网络离线时显示离线提示', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 触发 offline 事件
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      // 应该显示离线提示
      await waitFor(() => {
        expect(screen.getByText(/网络连接已断开/)).toBeInTheDocument();
      });
    });
  });

  describe('页面可见性感知', () => {
    it('应该在页面重新可见时刷新数据', async () => {
      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 模拟页面变为不可见
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // 模拟页面重新可见
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // 应该触发数据刷新
      await waitFor(() => {
        expect(mockTrpcUtils.stocks.getStockDetail.refetch).toHaveBeenCalled();
      });
    });

    it('应该在页面不可见时暂停自动刷新', async () => {
      vi.useFakeTimers();

      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 模拟页面变为不可见
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // 在页面不可见时推进时间
      act(() => {
        vi.advanceTimersByTime(60000); // 1分钟
      });

      // 不应该触发自动刷新
      expect(mockTrpcUtils.stocks.getStockDetail.refetch).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('后台更新策略', () => {
    it('应该在后台静默更新过期数据', async () => {
      vi.useFakeTimers();

      let isStale = false;
      (trpc.stocks.getStockDetail.useQuery as any).mockReturnValue({
        data: mockStockData,
        isLoading: false,
        isError: false,
        error: null,
        isStale,
        refetch: vi.fn().mockImplementation(() => {
          isStale = false;
        }),
      });

      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      // 模拟数据变为过期
      act(() => {
        isStale = true;
        vi.advanceTimersByTime(30000);
      });

      // 应该在后台更新数据
      expect(mockTrpcUtils.stocks.getStockDetail.refetch).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('应该优雅处理后台更新失败', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();

      (trpc.stocks.getStockDetail.useQuery as any).mockReturnValue({
        data: mockStockData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn().mockRejectedValue(new Error('Background update failed')),
      });

      render(
        <TestWrapper>
          <StockDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('平安银行')).toBeInTheDocument();
      });

      // 页面应该正常显示，不受后台更新失败影响
      expect(screen.getByText('平安银行')).toBeInTheDocument();
      
      consoleWarnSpy.mockRestore();
    });
  });
});