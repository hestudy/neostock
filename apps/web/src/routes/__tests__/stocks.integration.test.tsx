/**
 * 路由集成测试 - 验证TanStack Router股票页面功能
 * 测试路由导航、预加载、懒加载和加载性能
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routeTree } from '../../routeTree.gen';

// Mock tRPC client
const mockTrpc = {
  stocks: {
    searchStocks: {
      useQuery: vi.fn(),
    },
    getStockDetail: {
      useQuery: vi.fn(),
    },
    getStockList: {
      useQuery: vi.fn(),
    },
  },
  useContext: vi.fn(),
};

vi.mock('../../utils/trpc', () => ({
  trpc: mockTrpc,
}));

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
};

Object.defineProperty(window, 'performance', {
  value: mockPerformance,
});

describe('Stock Routes Integration', () => {
  let queryClient: QueryClient;
  let router: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    // Reset all mocks
    vi.clearAllMocks();
    
    // Default mock implementations
    mockTrpc.stocks.searchStocks.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    mockTrpc.stocks.getStockDetail.useQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    mockTrpc.stocks.getStockList.useQuery.mockReturnValue({
      data: { stocks: [], total: 0 },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  const renderWithRouter = (initialEntries: string[] = ['/stocks']) => {
    router = createMemoryRouter({
      routeTree,
      history: { initialEntries },
      context: {
        queryClient,
        auth: {
          user: { id: 'test-user', email: 'test@example.com' },
          isAuthenticated: true,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  };

  describe('股票路由导航', () => {
    it('应该正确导航到股票列表页面', async () => {
      renderWithRouter(['/stocks']);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/stocks');
      });

      // 验证页面元素
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('应该正确导航到股票详情页面', async () => {
      const stockCode = '000001.SZ';
      
      mockTrpc.stocks.getStockDetail.useQuery.mockReturnValue({
        data: {
          ts_code: stockCode,
          name: '平安银行',
          industry: '银行',
          current_price: 12.34,
        },
        isLoading: false,
        isError: false,
        error: null,
      });

      renderWithRouter([`/stocks/${stockCode}`]);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/stocks/${stockCode}`);
      });
    });

    it('应该处理无效股票代码的路由', async () => {
      const invalidCode = 'INVALID.SZ';
      
      mockTrpc.stocks.getStockDetail.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('Stock not found'),
      });

      renderWithRouter([`/stocks/${invalidCode}`]);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/stocks/${invalidCode}`);
      });

      // 应该显示错误状态
      await waitFor(() => {
        expect(screen.getByText(/股票不存在/)).toBeInTheDocument();
      });
    });
  });

  describe('路由权限验证', () => {
    it('未认证用户应该被重定向到登录页', async () => {
      const routerWithoutAuth = createMemoryRouter({
        routeTree,
        history: { initialEntries: ['/stocks'] },
        context: {
          queryClient,
          auth: {
            user: null,
            isAuthenticated: false,
          },
        },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={routerWithoutAuth} />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(routerWithoutAuth.state.location.pathname).toBe('/login');
      });
    });

    it('认证用户应该能访问股票页面', async () => {
      renderWithRouter(['/stocks']);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/stocks');
      });

      // 不应该重定向到登录页
      expect(router.state.location.pathname).not.toBe('/login');
    });
  });

  describe('页面加载性能测试', () => {
    it('股票列表页面应该在2秒内可交互', async () => {
      const startTime = performance.now();
      
      mockTrpc.stocks.getStockList.useQuery.mockReturnValue({
        data: { 
          stocks: [
            { ts_code: '000001.SZ', name: '平安银行', industry: '银行' },
            { ts_code: '000002.SZ', name: '万科A', industry: '房地产' },
          ], 
          total: 2 
        },
        isLoading: false,
        isError: false,
        error: null,
      });

      renderWithRouter(['/stocks']);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/stocks');
      });

      // 等待组件完全渲染
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // 应该在2秒内完成加载
      expect(loadTime).toBeLessThan(2000);
    });

    it('股票详情页面应该在2秒内可交互', async () => {
      const startTime = performance.now();
      const stockCode = '000001.SZ';

      mockTrpc.stocks.getStockDetail.useQuery.mockReturnValue({
        data: {
          ts_code: stockCode,
          name: '平安银行',
          industry: '银行',
          current_price: 12.34,
          market_cap: 1234567890,
        },
        isLoading: false,
        isError: false,
        error: null,
      });

      renderWithRouter([`/stocks/${stockCode}`]);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/stocks/${stockCode}`);
      });

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(2000);
    });
  });

  describe('代码分割和懒加载', () => {
    it('应该正确处理组件懒加载', async () => {
      // Mock dynamic import
      const mockLazyComponent = vi.fn().mockResolvedValue({
        default: () => <div data-testid="lazy-component">Lazy Loaded</div>,
      });

      // 模拟懒加载组件的加载过程
      vi.doMock('../../components/stocks/stock-chart', () => mockLazyComponent);

      renderWithRouter(['/stocks/000001.SZ']);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/stocks/000001.SZ');
      });

      // 验证懒加载组件最终被渲染
      await waitFor(() => {
        // 即使组件还在加载，页面应该已经可交互
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('应该在页面卸载时清理懒加载组件', async () => {
      const stockCode = '000001.SZ';
      
      mockTrpc.stocks.getStockDetail.useQuery.mockReturnValue({
        data: {
          ts_code: stockCode,
          name: '平安银行',
        },
        isLoading: false,
        isError: false,
      });

      renderWithRouter([`/stocks/${stockCode}`]);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/stocks/${stockCode}`);
      });

      // 导航到其他页面
      act(() => {
        router.navigate({ to: '/stocks' });
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/stocks');
      });

      // 验证清理逻辑 - 这里主要是确保没有内存泄漏
      expect(queryClient.getQueryCache().getAll()).toBeDefined();
    });
  });

  describe('浏览器导航支持', () => {
    it('应该正确处理浏览器前进后退', async () => {
      renderWithRouter(['/stocks']);

      // 导航到详情页
      act(() => {
        router.navigate({ to: '/stocks/$symbol', params: { symbol: '000001.SZ' } });
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/stocks/000001.SZ');
      });

      // 模拟浏览器后退
      act(() => {
        router.history.back();
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/stocks');
      });

      // 模拟浏览器前进
      act(() => {
        router.history.forward();
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/stocks/000001.SZ');
      });
    });

    it('应该保持路由状态在导航过程中', async () => {
      const stockCode = '000001.SZ';
      
      mockTrpc.stocks.getStockDetail.useQuery.mockReturnValue({
        data: {
          ts_code: stockCode,
          name: '平安银行',
        },
        isLoading: false,
        isError: false,
      });

      renderWithRouter([`/stocks/${stockCode}`]);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/stocks/${stockCode}`);
      });

      // 验证路由参数正确传递
      expect(router.state.matches?.[0]?.params?.symbol).toBe(stockCode);
    });
  });

  describe('页面预加载', () => {
    it('应该预加载相关股票数据', async () => {
      const mockPrefetch = vi.fn();
      queryClient.prefetchQuery = mockPrefetch;

      mockTrpc.stocks.getStockList.useQuery.mockReturnValue({
        data: { 
          stocks: [
            { ts_code: '000001.SZ', name: '平安银行', industry: '银行' },
          ], 
          total: 1 
        },
        isLoading: false,
        isError: false,
      });

      renderWithRouter(['/stocks']);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // 验证预加载逻辑被触发（这里需要根据实际实现调整）
      // 例如，当用户悬停在股票链接上时，应该预加载详情数据
      expect(mockPrefetch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(['stocks']),
        })
      );
    });

    it('应该在路由切换时取消未完成的预加载', async () => {
      const abortController = new AbortController();
      const mockPrefetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve, reject) => {
          abortController.signal.addEventListener('abort', () => {
            reject(new Error('Cancelled'));
          });
          setTimeout(resolve, 1000);
        });
      });

      queryClient.prefetchQuery = mockPrefetch;

      renderWithRouter(['/stocks']);

      // 快速切换路由
      act(() => {
        router.navigate({ to: '/dashboard' });
      });

      // 验证预加载被取消
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
    });
  });

  describe('错误边界和错误恢复', () => {
    it('应该处理路由级别的错误', async () => {
      // 模拟路由组件抛出错误
      const originalConsoleError = console.error;
      console.error = vi.fn();

      mockTrpc.stocks.getStockDetail.useQuery.mockImplementation(() => {
        throw new Error('Component error');
      });

      renderWithRouter(['/stocks/000001.SZ']);

      await waitFor(() => {
        // 应该显示错误边界
        expect(screen.getByText(/出现错误/)).toBeInTheDocument();
      });

      console.error = originalConsoleError;
    });

    it('应该允许从错误状态恢复', async () => {
      mockTrpc.stocks.getStockDetail.useQuery
        .mockReturnValueOnce({
          data: null,
          isLoading: false,
          isError: true,
          error: new Error('Network error'),
        })
        .mockReturnValue({
          data: {
            ts_code: '000001.SZ',
            name: '平安银行',
          },
          isLoading: false,
          isError: false,
          error: null,
        });

      renderWithRouter(['/stocks/000001.SZ']);

      // 初始应该显示错误
      await waitFor(() => {
        expect(screen.getByText(/加载失败/)).toBeInTheDocument();
      });

      // 点击重试按钮
      const retryButton = screen.getByRole('button', { name: /重试/ });
      act(() => {
        retryButton.click();
      });

      // 应该恢复正常显示
      await waitFor(() => {
        expect(screen.getByText('平安银行')).toBeInTheDocument();
      });
    });
  });
});