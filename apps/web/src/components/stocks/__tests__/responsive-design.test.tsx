/**
 * 响应式设计测试覆盖
 * 测试不同屏幕尺寸下的布局适配和触屏操作体验
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StockSearch from '../stock-search';
import StockLayout from '../stock-layout';
import StockList from '../stock-list';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Test utilities
const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  // 更新 matchMedia mock
  (window.matchMedia as any).mockImplementation((query: string) => {
    const matches = {
      '(max-width: 767px)': width <= 767,
      '(min-width: 768px)': width >= 768,
      '(min-width: 768px) and (max-width: 1023px)': width >= 768 && width <= 1023,
      '(min-width: 1024px)': width >= 1024,
      '(max-width: 639px)': width <= 639,
      '(min-width: 640px)': width >= 640,
    }[query] || false;

    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });

  // 触发 resize 事件
  window.dispatchEvent(new Event('resize'));
};

const BREAKPOINTS = {
  mobile: 375,
  mobileLandscape: 667,
  tablet: 768,
  desktop: 1024,
  desktopLarge: 1440,
} as const;

describe('响应式设计测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('移动端布局 (320px - 767px)', () => {
    beforeEach(() => {
      setViewportSize(BREAKPOINTS.mobile, 667);
    });

    it('应该在移动端正确显示搜索组件', () => {
      const mockOnSearch = vi.fn();
      
      render(
        <StockSearch 
          onSearch={mockOnSearch}
          placeholder="搜索股票代码或名称..."
        />
      );

      const searchInput = screen.getByPlaceholderText('搜索股票代码或名称...');
      const searchContainer = searchInput.closest('[data-testid="search-container"]');

      // 搜索输入框应该占满宽度
      expect(searchContainer).toHaveClass('w-full');
      
      // 输入框高度应该适合触摸操作 (>=44px)
      const inputStyles = window.getComputedStyle(searchInput);
      const height = parseInt(inputStyles.height || '0');
      expect(height).toBeGreaterThanOrEqual(44);
    });

    it('应该在移动端隐藏非关键UI元素', () => {
      render(
        <StockLayout>
          <div>Content</div>
        </StockLayout>
      );

      // 面包屑在移动端应该简化或隐藏
      const breadcrumbs = screen.queryByTestId('breadcrumbs');
      if (breadcrumbs) {
        expect(breadcrumbs).toHaveClass('hidden', 'sm:block');
      }

      // 侧边栏在移动端应该隐藏
      const sidebar = screen.queryByTestId('sidebar');
      if (sidebar) {
        expect(sidebar).toHaveClass('hidden', 'lg:block');
      }
    });

    it('应该在移动端使用堆叠布局', () => {
      const mockStocks = [
        {
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
        {
          ts_code: '000002.SZ',
          symbol: '000002',
          name: '万科A',
          industry: '房地产开发',
          area: '深圳',
          market: '主板',
          list_date: '19910129',
          is_hs: '1',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      render(
        <StockList 
          stocks={mockStocks} 
          total={mockStocks.length}
          onStockClick={vi.fn()}
        />
      );

      const listContainer = screen.getByTestId('stock-list');
      
      // 移动端应该使用单列布局
      expect(listContainer).toHaveClass('grid-cols-1');
      expect(listContainer).not.toHaveClass('md:grid-cols-2', 'lg:grid-cols-3');
    });

    it('搜索结果项应该适合触摸操作', () => {
      const mockStocks = [{
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
      }];

      const mockOnClick = vi.fn();
      
      render(
        <StockList 
          stocks={mockStocks} 
          total={1}
          onStockClick={mockOnClick}
        />
      );

      const stockItem = screen.getByTestId('stock-item');
      const itemStyles = window.getComputedStyle(stockItem);
      const itemHeight = parseInt(itemStyles.minHeight || itemStyles.height || '0');

      // 触摸目标应该至少44px高
      expect(itemHeight).toBeGreaterThanOrEqual(44);

      // 点击应该工作
      fireEvent.click(stockItem);
      expect(mockOnClick).toHaveBeenCalledWith('000001.SZ');
    });
  });

  describe('平板端布局 (768px - 1023px)', () => {
    beforeEach(() => {
      setViewportSize(BREAKPOINTS.tablet, 1024);
    });

    it('应该在平板端使用两列网格布局', () => {
      const mockStocks = Array.from({ length: 6 }, (_, i) => ({
        ts_code: `00000${i + 1}.SZ`,
        symbol: `00000${i + 1}`,
        name: `测试股票${i + 1}`,
        industry: '测试行业',
        area: '深圳',
        market: '主板',
        list_date: '20200101',
        is_hs: '1',
        created_at: new Date(),
        updated_at: new Date(),
      }));

      render(
        <StockList 
          stocks={mockStocks} 
          total={6}
          onStockClick={vi.fn()}
        />
      );

      const listContainer = screen.getByTestId('stock-list');
      
      // 平板端应该使用两列布局
      expect(listContainer).toHaveClass('md:grid-cols-2');
    });

    it('应该显示更多UI元素', () => {
      render(
        <StockLayout>
          <div>Content</div>
        </StockLayout>
      );

      // 面包屑在平板端应该显示
      const breadcrumbs = screen.queryByTestId('breadcrumbs');
      if (breadcrumbs) {
        expect(breadcrumbs).not.toHaveClass('hidden');
      }
    });

    it('搜索栏应该显示更多功能', () => {
      const mockOnSearch = vi.fn();
      
      render(
        <StockSearch 
          onSearch={mockOnSearch}
          placeholder="搜索股票代码或名称..."
        />
      );

      // 搜索历史和收藏按钮应该显示
      expect(screen.getByRole('button', { name: /搜索历史/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /我的收藏/ })).toBeInTheDocument();
    });
  });

  describe('桌面端布局 (>=1024px)', () => {
    beforeEach(() => {
      setViewportSize(BREAKPOINTS.desktop, 768);
    });

    it('应该使用三列或更多列网格布局', () => {
      const mockStocks = Array.from({ length: 9 }, (_, i) => ({
        ts_code: `00000${i + 1}.SZ`,
        symbol: `00000${i + 1}`,
        name: `测试股票${i + 1}`,
        industry: '测试行业',
        area: '深圳',
        market: '主板',
        list_date: '20200101',
        is_hs: '1',
        created_at: new Date(),
        updated_at: new Date(),
      }));

      render(
        <StockList 
          stocks={mockStocks} 
          total={9}
          onStockClick={vi.fn()}
        />
      );

      const listContainer = screen.getByTestId('stock-list');
      
      // 桌面端应该使用三列布局
      expect(listContainer).toHaveClass('lg:grid-cols-3');
    });

    it('应该显示所有UI元素', () => {
      render(
        <StockLayout>
          <div>Content</div>
        </StockLayout>
      );

      // 所有导航元素都应该显示
      const breadcrumbs = screen.queryByTestId('breadcrumbs');
      if (breadcrumbs) {
        expect(breadcrumbs).toBeVisible();
      }

      const sidebar = screen.queryByTestId('sidebar');
      if (sidebar) {
        expect(sidebar).toHaveClass('lg:block');
      }
    });

    it('搜索功能应该完整显示', () => {
      const mockOnSearch = vi.fn();
      
      render(
        <StockSearch 
          onSearch={mockOnSearch}
          placeholder="搜索股票代码或名称..."
        />
      );

      // 所有搜索相关按钮都应该显示
      expect(screen.getByRole('button', { name: /搜索历史/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /我的收藏/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /高级搜索/ })).toBeInTheDocument();
    });
  });

  describe('超宽屏布局 (>=1440px)', () => {
    beforeEach(() => {
      setViewportSize(BREAKPOINTS.desktopLarge, 900);
    });

    it('应该使用四列或更多列网格布局', () => {
      const mockStocks = Array.from({ length: 12 }, (_, i) => ({
        ts_code: `00000${i + 1}.SZ`,
        symbol: `00000${i + 1}`,
        name: `测试股票${i + 1}`,
        industry: '测试行业',
        area: '深圳',
        market: '主板',
        list_date: '20200101',
        is_hs: '1',
        created_at: new Date(),
        updated_at: new Date(),
      }));

      render(
        <StockList 
          stocks={mockStocks} 
          total={12}
          onStockClick={vi.fn()}
        />
      );

      const listContainer = screen.getByTestId('stock-list');
      
      // 超宽屏应该使用四列或更多列布局
      expect(listContainer).toHaveClass('xl:grid-cols-4');
    });
  });

  describe('触屏操作优化', () => {
    beforeEach(() => {
      setViewportSize(BREAKPOINTS.mobile, 667);
    });

    it('所有可点击元素应该满足最小触摸目标尺寸', () => {
      const mockOnSearch = vi.fn();
      
      render(
        <StockSearch 
          onSearch={mockOnSearch}
          placeholder="搜索股票代码或名称..."
        />
      );

      // 检查搜索按钮
      const searchButton = screen.getByRole('button', { name: /搜索/ });
      const buttonRect = searchButton.getBoundingClientRect();
      
      expect(Math.min(buttonRect.width, buttonRect.height)).toBeGreaterThanOrEqual(44);

      // 检查其他交互元素
      const historyButton = screen.getByRole('button', { name: /搜索历史/ });
      const historyRect = historyButton.getBoundingClientRect();
      
      expect(Math.min(historyRect.width, historyRect.height)).toBeGreaterThanOrEqual(44);
    });

    it('应该禁用双击缩放', () => {
      const mockOnSearch = vi.fn();
      
      render(
        <StockSearch 
          onSearch={mockOnSearch}
          placeholder="搜索股票代码或名称..."
        />
      );

      const searchInput = screen.getByPlaceholderText('搜索股票代码或名称...');
      
      // 输入框应该有 touch-action: manipulation 来禁用双击缩放
      expect(searchInput).toHaveStyle({ touchAction: 'manipulation' });
    });

    it('应该优化滚动体验', () => {
      const mockStocks = Array.from({ length: 20 }, (_, i) => ({
        ts_code: `00000${i + 1}.SZ`,
        symbol: `00000${i + 1}`,
        name: `测试股票${i + 1}`,
        industry: '测试行业',
        area: '深圳',
        market: '主板',
        list_date: '20200101',
        is_hs: '1',
        created_at: new Date(),
        updated_at: new Date(),
      }));

      render(
        <StockList 
          stocks={mockStocks} 
          total={20}
          onStockClick={vi.fn()}
        />
      );

      const listContainer = screen.getByTestId('stock-list');
      
      // 滚动容器应该有平滑滚动
      const computedStyles = window.getComputedStyle(listContainer);
      expect(computedStyles.scrollBehavior).toBe('smooth');
    });
  });

  describe('屏幕方向变化', () => {
    it('应该在横屏时调整布局', () => {
      // 竖屏模式
      setViewportSize(375, 667);

      const mockStocks = Array.from({ length: 6 }, (_, i) => ({
        ts_code: `00000${i + 1}.SZ`,
        symbol: `00000${i + 1}`,
        name: `测试股票${i + 1}`,
        industry: '测试行业',
        area: '深圳',
        market: '主板',
        list_date: '20200101',
        is_hs: '1',
        created_at: new Date(),
        updated_at: new Date(),
      }));

      const { rerender } = render(
        <StockList 
          stocks={mockStocks} 
          total={6}
          onStockClick={vi.fn()}
        />
      );

      let listContainer = screen.getByTestId('stock-list');
      expect(listContainer).toHaveClass('grid-cols-1');

      // 切换到横屏模式
      setViewportSize(667, 375);

      rerender(
        <StockList 
          stocks={mockStocks} 
          total={6}
          onStockClick={vi.fn()}
        />
      );

      listContainer = screen.getByTestId('stock-list');
      // 横屏时应该可能显示更多列
      expect(listContainer).toHaveClass('sm:grid-cols-2');
    });

    it('应该处理屏幕方向变化事件', () => {
      setViewportSize(375, 667);

      render(
        <StockLayout>
          <div>Content</div>
        </StockLayout>
      );

      // 模拟屏幕方向变化
      const orientationChangeEvent = new Event('orientationchange');
      window.dispatchEvent(orientationChangeEvent);

      // 布局应该重新计算
      // 这里主要是确保没有错误发生
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('高密度屏幕支持', () => {
    it('应该在高DPI屏幕上正确显示', () => {
      // 模拟高DPI屏幕
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        configurable: true,
        value: 2,
      });

      render(
        <StockLayout>
          <div>High DPI Content</div>
        </StockLayout>
      );

      // 布局应该正常显示
      expect(screen.getByText('High DPI Content')).toBeInTheDocument();
    });
  });

  describe('可访问性支持', () => {
    it('应该支持键盘导航', () => {
      const mockOnSearch = vi.fn();
      
      render(
        <StockSearch 
          onSearch={mockOnSearch}
          placeholder="搜索股票代码或名称..."
        />
      );

      const searchInput = screen.getByPlaceholderText('搜索股票代码或名称...');
      
      // Tab 键应该能够聚焦到输入框
      searchInput.focus();
      expect(searchInput).toHaveFocus();

      // Enter 键应该触发搜索
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
      expect(mockOnSearch).toHaveBeenCalled();
    });

    it('应该有适当的焦点指示器', () => {
      const mockOnSearch = vi.fn();
      
      render(
        <StockSearch 
          onSearch={mockOnSearch}
          placeholder="搜索股票代码或名称..."
        />
      );

      const searchButton = screen.getByRole('button', { name: /搜索/ });
      
      // 焦点时应该有明显的指示器
      searchButton.focus();
      expect(searchButton).toHaveFocus();
      
      const focusStyles = window.getComputedStyle(searchButton, ':focus');
      // 应该有焦点环或其他焦点指示器
      expect(focusStyles.outline).not.toBe('none');
    });

    it('应该支持屏幕阅读器', () => {
      const mockStocks = [{
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
      }];

      render(
        <StockList 
          stocks={mockStocks} 
          total={1}
          onStockClick={vi.fn()}
        />
      );

      const stockItem = screen.getByTestId('stock-item');
      
      // 应该有适当的 aria 标签
      expect(stockItem).toHaveAttribute('role', 'button');
      expect(stockItem).toHaveAttribute('aria-label');
    });
  });

  describe('性能优化', () => {
    it('应该在小屏幕上限制渲染数量', () => {
      setViewportSize(BREAKPOINTS.mobile, 667);

      const manyStocks = Array.from({ length: 100 }, (_, i) => ({
        ts_code: `${String(i + 1).padStart(6, '0')}.SZ`,
        symbol: String(i + 1).padStart(6, '0'),
        name: `测试股票${i + 1}`,
        industry: '测试行业',
        area: '深圳',
        market: '主板',
        list_date: '20200101',
        is_hs: '1',
        created_at: new Date(),
        updated_at: new Date(),
      }));

      render(
        <StockList 
          stocks={manyStocks} 
          total={100}
          onStockClick={vi.fn()}
        />
      );

      // 移动端应该限制显示数量或实现虚拟滚动
      const visibleItems = screen.getAllByTestId('stock-item');
      
      // 不应该一次性渲染所有100个项目
      expect(visibleItems.length).toBeLessThanOrEqual(20);
    });

    it('应该延迟加载非关键内容', async () => {
      setViewportSize(BREAKPOINTS.mobile, 667);

      render(
        <StockLayout>
          <div>Critical Content</div>
        </StockLayout>
      );

      // 关键内容应该立即显示
      expect(screen.getByText('Critical Content')).toBeInTheDocument();

      // 非关键内容可能延迟加载
      const lazyContent = screen.queryByTestId('lazy-sidebar');
      if (lazyContent) {
        // 如果有延迟加载的内容，应该在适当的时候加载
        expect(lazyContent).toHaveAttribute('loading', 'lazy');
      }
    });
  });
});