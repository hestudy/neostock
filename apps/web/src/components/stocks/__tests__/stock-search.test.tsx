import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockSearch, SearchQuickActions, SearchContainer } from '../stock-search';

describe('StockSearch', () => {
  const mockOnSearch = vi.fn();
  const mockOnClear = vi.fn();
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should render with default props', () => {
      render(<StockSearch />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      expect(input).toBeInTheDocument();
      
      const searchButton = screen.getByRole('button', { name: '搜索' });
      expect(searchButton).toBeInTheDocument();
      expect(searchButton).toBeDisabled(); // Should be disabled when empty
    });

    it('should render with custom placeholder', () => {
      render(<StockSearch placeholder="自定义占位符" />);
      
      expect(screen.getByPlaceholderText('自定义占位符')).toBeInTheDocument();
    });

    it('should focus input when autoFocus is true', () => {
      render(<StockSearch autoFocus />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      expect(input).toHaveFocus();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<StockSearch disabled />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      const searchButton = screen.getByRole('button', { name: '搜索' });
      
      expect(input).toBeDisabled();
      expect(searchButton).toBeDisabled();
    });
  });

  describe('Controlled vs Uncontrolled', () => {
    it('should work as uncontrolled component', async () => {
      const user = userEvent.setup();
      render(<StockSearch onSearch={mockOnSearch} />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      
      await user.type(input, '000001');
      expect(input).toHaveValue('000001');
      
      const searchButton = screen.getByRole('button', { name: '搜索' });
      expect(searchButton).toBeEnabled();
      
      await user.click(searchButton);
      expect(mockOnSearch).toHaveBeenCalledWith('000001');
    });

    it('should work as controlled component', async () => {
      const user = userEvent.setup();
      render(
        <StockSearch
          value="平安银行"
          onChange={mockOnChange}
          onSearch={mockOnSearch}
        />
      );
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      expect(input).toHaveValue('平安银行');
      
      await user.type(input, '123');
      expect(mockOnChange).toHaveBeenLastCalledWith('平安银行123');
      
      const searchButton = screen.getByRole('button', { name: '搜索' });
      await user.click(searchButton);
      expect(mockOnSearch).toHaveBeenCalledWith('平安银行');
    });
  });

  describe('Search Functionality', () => {
    it('should call onSearch when search button is clicked', async () => {
      const user = userEvent.setup();
      render(<StockSearch onSearch={mockOnSearch} />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      await user.type(input, '000001.SZ');
      
      const searchButton = screen.getByRole('button', { name: '搜索' });
      await user.click(searchButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('000001.SZ');
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });

    it('should call onSearch when Enter key is pressed', async () => {
      const user = userEvent.setup();
      render(<StockSearch onSearch={mockOnSearch} />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      await user.type(input, '平安银行');
      await user.keyboard('{Enter}');
      
      expect(mockOnSearch).toHaveBeenCalledWith('平安银行');
    });

    it('should trim whitespace before searching', async () => {
      const user = userEvent.setup();
      render(<StockSearch onSearch={mockOnSearch} />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      await user.type(input, '  000001  ');
      
      const searchButton = screen.getByRole('button', { name: '搜索' });
      await user.click(searchButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('000001');
    });

    it('should not call onSearch for empty or whitespace-only queries', async () => {
      const user = userEvent.setup();
      render(<StockSearch onSearch={mockOnSearch} />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      const searchButton = screen.getByRole('button', { name: '搜索' });
      
      // Test empty string
      expect(searchButton).toBeDisabled();
      
      // Test whitespace only
      await user.type(input, '   ');
      expect(searchButton).toBeDisabled();
    });
  });

  describe('Clear Functionality', () => {
    it('should show clear button when input has value', async () => {
      const user = userEvent.setup();
      render(<StockSearch onClear={mockOnClear} />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      
      // No clear button initially
      expect(screen.queryByRole('button', { name: '清除搜索' })).not.toBeInTheDocument();
      
      await user.type(input, '000001');
      
      // Clear button should appear
      expect(screen.getByRole('button', { name: '清除搜索' })).toBeInTheDocument();
    });

    it('should clear input when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<StockSearch onClear={mockOnClear} onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      await user.type(input, '000001');
      
      const clearButton = screen.getByRole('button', { name: '清除搜索' });
      await user.click(clearButton);
      
      expect(input).toHaveValue('');
      expect(mockOnClear).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenLastCalledWith('');
    });

    it('should clear input when Escape key is pressed', async () => {
      const user = userEvent.setup();
      render(<StockSearch onClear={mockOnClear} />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      await user.type(input, '000001');
      await user.keyboard('{Escape}');
      
      expect(input).toHaveValue('');
      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });

    it('should focus input after clearing', async () => {
      const user = userEvent.setup();
      render(<StockSearch />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      await user.type(input, '000001');
      
      const clearButton = screen.getByRole('button', { name: '清除搜索' });
      await user.click(clearButton);
      
      expect(input).toHaveFocus();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle Enter key correctly', async () => {
      const user = userEvent.setup();
      render(<StockSearch onSearch={mockOnSearch} />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      await user.type(input, '000001');
      
      // Prevent default should be called
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefaultSpy = vi.spyOn(enterEvent, 'preventDefault');
      
      fireEvent.keyDown(input, enterEvent);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should handle Escape key to clear', async () => {
      const user = userEvent.setup();
      render(<StockSearch />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      await user.type(input, '000001');
      
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input).toHaveValue('');
    });
  });

  describe('Mobile Optimizations', () => {
    it('should have appropriate touch target sizes', () => {
      render(<StockSearch />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      expect(input).toHaveClass('min-h-[44px]');
      
      const searchButton = screen.getByRole('button', { name: '搜索' });
      expect(searchButton).toHaveClass('min-h-[32px]');
    });

    it('should have proper input attributes for mobile', () => {
      render(<StockSearch />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      expect(input).toHaveAttribute('autoComplete', 'off');
      expect(input).toHaveAttribute('spellCheck', 'false');
      expect(input).toHaveClass('text-base'); // Prevents iOS zoom
    });
  });

  describe('Focus States', () => {
    it('should apply focus styles when input is focused', async () => {
      const user = userEvent.setup();
      render(<StockSearch />);
      
      const input = screen.getByPlaceholderText('搜索股票代码或名称...');
      
      await user.click(input);
      expect(input).toHaveClass('ring-2', 'ring-ring');
      
      await user.tab(); // Move focus away
      expect(input).not.toHaveClass('ring-2', 'ring-ring');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(<StockSearch className="custom-class" />);
      
      const container = screen.getByPlaceholderText('搜索股票代码或名称...').parentElement?.parentElement;
      expect(container).toHaveClass('custom-class');
    });
  });
});

describe('SearchQuickActions', () => {
  const mockOnHistoryClick = vi.fn();
  const mockOnFavoritesClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render history and favorites buttons', () => {
    render(
      <SearchQuickActions
        onHistoryClick={mockOnHistoryClick}
        onFavoritesClick={mockOnFavoritesClick}
      />
    );
    
    expect(screen.getByRole('button', { name: '搜索历史' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我的收藏' })).toBeInTheDocument();
  });

  it('should call onHistoryClick when history button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SearchQuickActions
        onHistoryClick={mockOnHistoryClick}
        onFavoritesClick={mockOnFavoritesClick}
      />
    );
    
    await user.click(screen.getByRole('button', { name: '搜索历史' }));
    expect(mockOnHistoryClick).toHaveBeenCalledTimes(1);
  });

  it('should call onFavoritesClick when favorites button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SearchQuickActions
        onHistoryClick={mockOnHistoryClick}
        onFavoritesClick={mockOnFavoritesClick}
      />
    );
    
    await user.click(screen.getByRole('button', { name: '我的收藏' }));
    expect(mockOnFavoritesClick).toHaveBeenCalledTimes(1);
  });

  it('should have appropriate touch target sizes', () => {
    render(<SearchQuickActions />);
    
    const historyButton = screen.getByRole('button', { name: '搜索历史' });
    const favoritesButton = screen.getByRole('button', { name: '我的收藏' });
    
    expect(historyButton).toHaveClass('min-h-[36px]');
    expect(favoritesButton).toHaveClass('min-h-[36px]');
  });

  it('should apply custom className', () => {
    render(<SearchQuickActions className="custom-actions-class" />);
    
    const container = screen.getByRole('button', { name: '搜索历史' }).parentElement;
    expect(container).toHaveClass('custom-actions-class');
  });
});

describe('SearchContainer', () => {
  it('should render children correctly', () => {
    render(
      <SearchContainer>
        <div data-testid="test-child">Test content</div>
      </SearchContainer>
    );
    
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('should apply default styling classes', () => {
    render(
      <SearchContainer>
        <div data-testid="test-child">Test content</div>
      </SearchContainer>
    );
    
    const container = screen.getByTestId('test-child').parentElement;
    expect(container).toHaveClass('space-y-4', 'rounded-lg', 'border', 'p-4');
  });

  it('should apply custom className', () => {
    render(
      <SearchContainer className="custom-container-class">
        <div data-testid="test-child">Test content</div>
      </SearchContainer>
    );
    
    const container = screen.getByTestId('test-child').parentElement;
    expect(container).toHaveClass('custom-container-class');
  });

  it('should apply backdrop blur styles', () => {
    render(
      <SearchContainer>
        <div data-testid="test-child">Test content</div>
      </SearchContainer>
    );
    
    const container = screen.getByTestId('test-child').parentElement;
    expect(container).toHaveClass('bg-background/95', 'backdrop-blur');
  });
});

describe('Integration Tests', () => {
  it('should work together in a complete search interface', async () => {
    const user = userEvent.setup();
    const mockOnSearch = vi.fn();
    const mockOnHistoryClick = vi.fn();
    const mockOnFavoritesClick = vi.fn();

    render(
      <SearchContainer>
        <StockSearch onSearch={mockOnSearch} />
        <SearchQuickActions
          onHistoryClick={mockOnHistoryClick}
          onFavoritesClick={mockOnFavoritesClick}
        />
      </SearchContainer>
    );

    // Test search functionality
    const input = screen.getByPlaceholderText('搜索股票代码或名称...');
    await user.type(input, '000001');
    
    const searchButton = screen.getByRole('button', { name: '搜索' });
    await user.click(searchButton);
    expect(mockOnSearch).toHaveBeenCalledWith('000001');

    // Test quick actions
    const historyButton = screen.getByRole('button', { name: '搜索历史' });
    await user.click(historyButton);
    expect(mockOnHistoryClick).toHaveBeenCalledTimes(1);

    const favoritesButton = screen.getByRole('button', { name: '我的收藏' });
    await user.click(favoritesButton);
    expect(mockOnFavoritesClick).toHaveBeenCalledTimes(1);
  });
});