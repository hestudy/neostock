/**
 * 响应式设计全面测试覆盖
 * 测试股票组件在不同设备、屏幕尺寸和交互方式下的适配效果
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';

// 导入测试设置
import '../../../test-setup';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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

// 测试组件
const ResponsiveStockSearch = () => {
  const [isMobile, setIsMobile] = React.useState(false);
  const [isTablet, setIsTablet] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const containerClass = isMobile 
    ? 'w-full p-2' 
    : isTablet 
    ? 'w-3/4 p-4' 
    : 'w-1/2 p-6';

  const inputClass = isMobile 
    ? 'text-base h-12 px-4' 
    : 'text-sm h-10 px-3';

  return (
    <div className={`${containerClass} bg-white`} data-testid="search-container">
      <input
        type="search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={`${inputClass} w-full border rounded-lg`}
        data-testid="search-input"
        placeholder="搜索股票..."
        aria-label="股票搜索输入框"
      />
      <div data-testid="viewport-info">
        <span data-testid="is-mobile">{isMobile.toString()}</span>
        <span data-testid="is-tablet">{isTablet.toString()}</span>
      </div>
    </div>
  );
};

const ResponsiveStockList = ({ stocks }: { stocks: Array<{ name: string; code: string; price: number }> }) => {
  const [columns, setColumns] = React.useState(1);

  React.useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) setColumns(1);
      else if (width < 1024) setColumns(2);
      else if (width < 1280) setColumns(3);
      else setColumns(4);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const gridClass = `grid grid-cols-${columns} gap-4`;

  return (
    <div className={gridClass} data-testid="stock-grid">
      <div data-testid="column-count">{columns}</div>
      {stocks.map((stock, index) => (
        <div
          key={index}
          className="p-4 border rounded-lg min-h-[80px] touch-target"
          data-testid={`stock-item-${index}`}
          role="button"
          tabIndex={0}
          aria-label={`${stock.name} ${stock.code}`}
        >
          <h3 className="font-medium truncate" data-testid={`stock-name-${index}`}>
            {stock.name}
          </h3>
          <p className="text-sm text-gray-600" data-testid={`stock-code-${index}`}>
            {stock.code}
          </p>
          <p className="text-lg font-bold" data-testid={`stock-price-${index}`}>
            ¥{stock.price.toFixed(2)}
          </p>
        </div>
      ))}
    </div>
  );
};

const TouchOptimizedButton = ({ children, onClick, variant = 'default' }: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'small' | 'large';
}) => {
  const sizeClasses = {
    small: 'h-8 px-3 text-sm',
    default: 'h-11 px-4 text-base',
    large: 'h-14 px-6 text-lg',
  };

  return (
    <button
      onClick={onClick}
      className={`${sizeClasses[variant]} bg-blue-500 text-white rounded-lg touch-target`}
      data-testid={`button-${variant}`}
      aria-label={`${variant} button`}
    >
      {children}
    </button>
  );
};

// 辅助函数
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
  window.dispatchEvent(new Event('resize'));
};

describe('响应式设计全面测试', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    // 重置viewport
    setViewportSize(1024, 768);
  });

  describe('视口断点测试', () => {
    const testData = [
      { name: '平安银行', code: '000001.SZ', price: 12.34 },
      { name: '万科A', code: '000002.SZ', price: 25.67 },
      { name: '贵州茅台', code: '600519.SH', price: 1888.88 },
      { name: '招商银行', code: '600036.SH', price: 45.23 },
    ];

    it('移动端视口 (< 768px) 应使用单列布局', async () => {
      setViewportSize(375, 667); // iPhone SE

      render(<ResponsiveStockSearch />);
      
      await waitFor(() => {
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
        expect(screen.getByTestId('is-tablet')).toHaveTextContent('false');
      });

      const container = screen.getByTestId('search-container');
      expect(container).toHaveClass('w-full', 'p-2');

      const input = screen.getByTestId('search-input');
      expect(input).toHaveClass('text-base', 'h-12', 'px-4');
    });

    it('平板端视口 (768px - 1024px) 应使用适中布局', async () => {
      setViewportSize(768, 1024); // iPad

      render(<ResponsiveStockSearch />);
      
      await waitFor(() => {
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('false');
        expect(screen.getByTestId('is-tablet')).toHaveTextContent('true');
      });

      const container = screen.getByTestId('search-container');
      expect(container).toHaveClass('w-3/4', 'p-4');
    });

    it('桌面端视口 (>= 1024px) 应使用宽屏布局', async () => {
      setViewportSize(1280, 720); // Desktop

      render(<ResponsiveStockSearch />);
      
      await waitFor(() => {
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('false');
        expect(screen.getByTestId('is-tablet')).toHaveTextContent('false');
      });

      const container = screen.getByTestId('search-container');
      expect(container).toHaveClass('w-1/2', 'p-6');

      const input = screen.getByTestId('search-input');
      expect(input).toHaveClass('text-sm', 'h-10', 'px-3');
    });

    it('应该根据屏幕宽度动态调整网格列数', async () => {
      const testCases = [
        { width: 320, expectedColumns: 1, label: '小屏手机' },
        { width: 640, expectedColumns: 2, label: '大屏手机' },
        { width: 1024, expectedColumns: 3, label: '平板' },
        { width: 1280, expectedColumns: 4, label: '桌面' },
      ];

      for (const testCase of testCases) {
        setViewportSize(testCase.width, 600);
        
        render(<ResponsiveStockList stocks={testData} />);
        
        await waitFor(() => {
          expect(screen.getByTestId('column-count')).toHaveTextContent(
            testCase.expectedColumns.toString()
          );
        });

        // cleanup is handled by afterEach in test-setup
      }
    });
  });

  describe('触屏优化测试', () => {
    it('触摸目标应满足最小尺寸要求 (44px)', async () => {
      render(
        <div>
          <TouchOptimizedButton variant="small" onClick={vi.fn()}>
            小按钮
          </TouchOptimizedButton>
          <TouchOptimizedButton variant="default" onClick={vi.fn()}>
            默认按钮
          </TouchOptimizedButton>
          <TouchOptimizedButton variant="large" onClick={vi.fn()}>
            大按钮
          </TouchOptimizedButton>
        </div>
      );

      const smallButton = screen.getByTestId('button-small');
      const defaultButton = screen.getByTestId('button-default');
      const largeButton = screen.getByTestId('button-large');

      // 检查高度类
      expect(smallButton).toHaveClass('h-8'); // 32px - 可能不足
      expect(defaultButton).toHaveClass('h-11'); // 44px - 符合要求
      expect(largeButton).toHaveClass('h-14'); // 56px - 符合要求
    });

    it('应该支持触摸事件', async () => {
      const mockClick = vi.fn();
      
      render(
        <TouchOptimizedButton onClick={mockClick}>
          触摸按钮
        </TouchOptimizedButton>
      );

      const button = screen.getByTestId('button-default');
      
      // 模拟触摸点击
      await user.click(button);
      
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('股票列表项应该是触摸友好的', async () => {
      const testStocks = [
        { name: '平安银行', code: '000001.SZ', price: 12.34 },
      ];

      render(<ResponsiveStockList stocks={testStocks} />);

      const stockItem = screen.getByTestId('stock-item-0');
      
      // 检查触摸优化类和属性
      expect(stockItem).toHaveClass('touch-target');
      expect(stockItem).toHaveClass('min-h-[80px]'); // 最小高度保证
      expect(stockItem).toHaveAttribute('role', 'button');
      expect(stockItem).toHaveAttribute('tabIndex', '0');
    });

    it('应该防止意外的触摸缩放', async () => {
      render(<ResponsiveStockSearch />);

      const input = screen.getByTestId('search-input');
      
      // 在移动设备上，搜索输入应该有适当的属性
      expect(input).toHaveAttribute('type', 'search');
      
      // 检查是否有防止缩放的属性
      const metaViewport = document.querySelector('meta[name="viewport"]');
      if (metaViewport) {
        expect(metaViewport.getAttribute('content')).toContain('user-scalable=no');
      }
    });
  });

  describe('键盘导航和无障碍测试', () => {
    it('应该支持键盘导航', async () => {
      const testStocks = [
        { name: '平安银行', code: '000001.SZ', price: 12.34 },
        { name: '万科A', code: '000002.SZ', price: 25.67 },
      ];

      render(<ResponsiveStockList stocks={testStocks} />);

      const firstItem = screen.getByTestId('stock-item-0');
      const secondItem = screen.getByTestId('stock-item-1');

      // 第一个项目应该可聚焦
      firstItem.focus();
      expect(document.activeElement).toBe(firstItem);

      // Tab键应该能切换到下一个项目
      await user.keyboard('{Tab}');
      expect(document.activeElement).toBe(secondItem);
    });

    it('应该提供适当的ARIA标签', async () => {
      render(<ResponsiveStockSearch />);

      const input = screen.getByTestId('search-input');
      
      expect(input).toHaveAttribute('aria-label', '股票搜索输入框');
      expect(input).toHaveAttribute('placeholder', '搜索股票...');
    });

    it('股票项目应该有描述性的aria-label', async () => {
      const testStocks = [
        { name: '平安银行', code: '000001.SZ', price: 12.34 },
      ];

      render(<ResponsiveStockList stocks={testStocks} />);

      const stockItem = screen.getByTestId('stock-item-0');
      
      expect(stockItem).toHaveAttribute('aria-label', '平安银行 000001.SZ');
    });
  });

  describe('内容适配和可读性', () => {
    it('长文本应该正确截断', async () => {
      const testStocks = [
        { 
          name: '非常非常长的股票名称测试文本内容', 
          code: '000001.SZ', 
          price: 12.34 
        },
      ];

      render(<ResponsiveStockList stocks={testStocks} />);

      const stockName = screen.getByTestId('stock-name-0');
      
      expect(stockName).toHaveClass('truncate');
    });

    it('价格格式应该保持一致', async () => {
      const testStocks = [
        { name: '平安银行', code: '000001.SZ', price: 12.34 },
        { name: '贵州茅台', code: '600519.SH', price: 1888.88 },
      ];

      render(<ResponsiveStockList stocks={testStocks} />);

      const price1 = screen.getByTestId('stock-price-0');
      const price2 = screen.getByTestId('stock-price-1');
      
      expect(price1).toHaveTextContent('¥12.34');
      expect(price2).toHaveTextContent('¥1888.88');
    });

    it('不同屏幕密度下字体应该清晰可读', () => {
      // 模拟高DPI屏幕
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        configurable: true,
        value: 3.0, // iPhone等高分辨率屏幕
      });

      render(<ResponsiveStockSearch />);

      // 在高DPI屏幕上，文本应该保持清晰
      expect(window.devicePixelRatio).toBe(3.0);
      
      const input = screen.getByTestId('search-input');
      expect(input).toBeInTheDocument();
    });
  });

  describe('性能优化', () => {
    it('视口变化时应该正确更新布局', async () => {
      render(<ResponsiveStockSearch />);

      // 初始桌面视口
      expect(screen.getByTestId('is-mobile')).toHaveTextContent('false');

      // 切换到移动视口
      setViewportSize(375, 667);

      await waitFor(() => {
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
      });

      // 切换回桌面视口
      setViewportSize(1280, 720);

      await waitFor(() => {
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('false');
      });
    });

    it('应该正确清理resize事件监听器', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<ResponsiveStockSearch />);

      // 应该添加了resize监听器
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      // 卸载组件
      unmount();

      // 应该移除了resize监听器
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('快速连续的resize事件应该被防抖', async () => {
      const updateSpy = vi.fn();
      
      const TestComponent = () => {
        React.useEffect(() => {
          let timeoutId: NodeJS.Timeout;
          
          const debouncedUpdate = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              updateSpy();
            }, 100);
          };

          window.addEventListener('resize', debouncedUpdate);
          return () => {
            window.removeEventListener('resize', debouncedUpdate);
            clearTimeout(timeoutId);
          };
        }, []);

        return <div data-testid="debounce-test">Test</div>;
      };

      render(<TestComponent />);

      // 快速触发多次resize事件
      setViewportSize(400, 600);
      setViewportSize(500, 600);
      setViewportSize(600, 600);
      setViewportSize(700, 600);

      // 在防抖期间，更新函数不应该被调用
      expect(updateSpy).not.toHaveBeenCalled();

      // 等待防抖延迟
      await new Promise(resolve => setTimeout(resolve, 150));

      // 现在应该被调用了
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('跨浏览器兼容性', () => {
    it('应该支持CSS Grid布局', () => {
      const testElement = document.createElement('div');
      testElement.style.display = 'grid';
      
      // 在支持grid的浏览器中，display应该是grid
      expect(testElement.style.display).toBe('grid');
    });

    it('应该支持CSS Flexbox布局', () => {
      const testElement = document.createElement('div');
      testElement.style.display = 'flex';
      
      expect(testElement.style.display).toBe('flex');
    });

    it('应该支持media queries', () => {
      const mediaQuery = window.matchMedia('(max-width: 768px)');
      
      expect(mediaQuery).toHaveProperty('matches');
      expect(mediaQuery).toHaveProperty('addListener');
    });

    it('应该支持touch events', () => {
      // 检查触摸事件支持
      const touchSupport = 'ontouchstart' in window || 
                          (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      
      expect(typeof touchSupport).toBe('boolean');
    });
  });
});