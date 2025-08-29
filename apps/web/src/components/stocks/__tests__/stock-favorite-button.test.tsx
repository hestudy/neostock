import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockFavoriteButton, StockFavoriteToggle } from '../stock-favorite-button';

// Mock the useStockFavorites hook
const mockToggleFavorite = vi.fn();
const mockIsFavorite = vi.fn();

vi.mock('@/hooks/use-stock-favorites', () => ({
  useStockFavorites: () => ({
    isFavorite: mockIsFavorite,
    toggleFavorite: mockToggleFavorite,
  }),
}));

describe('StockFavoriteButton', () => {
  const defaultProps = {
    tsCode: '000001.SZ',
    name: '平安银行',
    symbol: '000001',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFavorite.mockReturnValue(false);
    mockToggleFavorite.mockResolvedValue(undefined);
  });

  describe('Basic Rendering', () => {
    it('should render unfavorited state correctly', () => {
      mockIsFavorite.mockReturnValue(false);
      render(<StockFavoriteButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', '添加收藏');
      expect(button).toHaveClass('text-muted-foreground');
    });

    it('should render favorited state correctly', () => {
      mockIsFavorite.mockReturnValue(true);
      render(<StockFavoriteButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', '取消收藏');
      expect(button).toHaveClass('text-yellow-500');
      
      // Star should be filled
      const star = button.querySelector('svg');
      expect(star).toHaveClass('fill-current');
    });

    it('should show text when showText is true', () => {
      mockIsFavorite.mockReturnValue(false);
      render(<StockFavoriteButton {...defaultProps} showText />);
      
      expect(screen.getByText('收藏')).toBeInTheDocument();
      
      mockIsFavorite.mockReturnValue(true);
      render(<StockFavoriteButton {...defaultProps} showText />);
      
      expect(screen.getByText('已收藏')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('should apply correct classes for different sizes', () => {
      // Small size
      render(<StockFavoriteButton {...defaultProps} size="sm" />);
      const smallButton = screen.getByRole('button');
      expect(smallButton).toHaveClass('min-h-[36px]');
      
      const smallStar = smallButton.querySelector('svg');
      expect(smallStar).toHaveClass('h-4 w-4');
    });

    it('should apply icon size classes correctly', () => {
      render(<StockFavoriteButton {...defaultProps} size="icon" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('min-h-[44px] min-w-[44px]');
    });

    it('should apply large size classes correctly', () => {
      render(<StockFavoriteButton {...defaultProps} size="lg" />);
      
      const star = screen.getByRole('button').querySelector('svg');
      expect(star).toHaveClass('h-5 w-5');
    });
  });

  describe('Interaction', () => {
    it('should toggle favorite when clicked', async () => {
      const user = userEvent.setup();
      mockIsFavorite.mockReturnValue(false);
      
      render(<StockFavoriteButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockToggleFavorite).toHaveBeenCalledWith({
        ts_code: '000001.SZ',
        name: '平安银行',
        symbol: '000001',
      });
      expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
    });

    it('should stop event propagation when clicked', async () => {
      const user = userEvent.setup();
      const mockParentClick = vi.fn();
      
      render(
        <div onClick={mockParentClick}>
          <StockFavoriteButton {...defaultProps} />
        </div>
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Parent click should not be triggered due to stopPropagation
      expect(mockParentClick).not.toHaveBeenCalled();
    });

    it('should prevent multiple clicks while toggling', async () => {
      const user = userEvent.setup();
      let resolveToggle: () => void;
      
      mockToggleFavorite.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveToggle = resolve;
        })
      );
      
      render(<StockFavoriteButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      
      // First click
      await user.click(button);
      expect(button).toBeDisabled();
      
      // Second click should be ignored
      await user.click(button);
      expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
      
      // Resolve the first toggle
      resolveToggle();
      
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should show loading state while toggling', async () => {
      const user = userEvent.setup();
      let resolveToggle: () => void;
      
      mockToggleFavorite.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveToggle = resolve;
        })
      );
      
      render(<StockFavoriteButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Button should be disabled and star should animate
      expect(button).toBeDisabled();
      
      const star = button.querySelector('svg');
      expect(star).toHaveClass('animate-pulse');
      
      // Resolve the toggle
      resolveToggle();
      
      await waitFor(() => {
        expect(button).not.toBeDisabled();
        expect(star).not.toHaveClass('animate-pulse');
      });
    });

    it('should handle toggle failure gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockToggleFavorite.mockRejectedValue(new Error('Toggle failed'));
      
      render(<StockFavoriteButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Toggle favorite failed:', expect.any(Error));
        expect(button).not.toBeDisabled();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<StockFavoriteButton {...defaultProps} disabled />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not toggle when disabled', async () => {
      const user = userEvent.setup();
      render(<StockFavoriteButton {...defaultProps} disabled />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockToggleFavorite).not.toHaveBeenCalled();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(<StockFavoriteButton {...defaultProps} className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should apply different variants', () => {
      const { rerender } = render(
        <StockFavoriteButton {...defaultProps} variant="outline" />
      );
      
      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('class');
      
      rerender(<StockFavoriteButton {...defaultProps} variant="secondary" />);
      
      button = screen.getByRole('button');
      expect(button).toHaveAttribute('class');
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate title attributes', () => {
      mockIsFavorite.mockReturnValue(false);
      const { rerender } = render(<StockFavoriteButton {...defaultProps} />);
      
      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', '添加收藏');
      
      mockIsFavorite.mockReturnValue(true);
      rerender(<StockFavoriteButton {...defaultProps} />);
      
      button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', '取消收藏');
    });

    it('should have appropriate touch targets for mobile', () => {
      render(<StockFavoriteButton {...defaultProps} size="icon" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('min-h-[44px] min-w-[44px]');
    });
  });
});

describe('StockFavoriteToggle', () => {
  const defaultProps = {
    tsCode: '000001.SZ',
    name: '平安银行',
    symbol: '000001',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFavorite.mockReturnValue(false);
    mockToggleFavorite.mockResolvedValue(undefined);
  });

  describe('Render Props Pattern', () => {
    it('should render children function with correct props', () => {
      mockIsFavorite.mockReturnValue(true);
      
      const mockChildrenFn = vi.fn().mockReturnValue(<div>Custom content</div>);
      
      render(
        <StockFavoriteToggle {...defaultProps}>
          {mockChildrenFn}
        </StockFavoriteToggle>
      );
      
      expect(mockChildrenFn).toHaveBeenCalledWith({
        isFavorite: true,
        isToggling: false,
        toggleFavorite: expect.any(Function),
      });
      
      expect(screen.getByText('Custom content')).toBeInTheDocument();
    });

    it('should call toggleFavorite from render props', async () => {
      const mockChildrenFn = vi.fn(({ toggleFavorite }) => {
        return <button onClick={toggleFavorite}>Custom Toggle</button>;
      });
      
      render(
        <StockFavoriteToggle {...defaultProps}>
          {mockChildrenFn}
        </StockFavoriteToggle>
      );
      
      const customButton = screen.getByText('Custom Toggle');
      const user = userEvent.setup();
      await user.click(customButton);
      
      expect(mockToggleFavorite).toHaveBeenCalledWith({
        ts_code: '000001.SZ',
        name: '平安银行',
        symbol: '000001',
      });
    });

    it('should update isToggling state correctly in render props', async () => {
      const user = userEvent.setup();
      let resolveToggle: () => void;
      
      mockToggleFavorite.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveToggle = resolve;
        })
      );
      
      const mockChildrenFn = vi.fn(({ isToggling, toggleFavorite }) => (
        <div>
          <span>{isToggling ? 'Loading...' : 'Ready'}</span>
          <button onClick={toggleFavorite}>Toggle</button>
        </div>
      ));
      
      render(
        <StockFavoriteToggle {...defaultProps}>
          {mockChildrenFn}
        </StockFavoriteToggle>
      );
      
      // Initially not toggling
      expect(screen.getByText('Ready')).toBeInTheDocument();
      
      // Click to start toggle
      const toggleButton = screen.getByText('Toggle');
      await user.click(toggleButton);
      
      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      // Resolve the promise
      resolveToggle();
      
      // Should return to ready state
      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument();
      });
    });
  });

  describe('Default Rendering', () => {
    it('should render StockFavoriteButton when no children provided', () => {
      render(<StockFavoriteToggle {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', '添加收藏');
    });

    it('should apply className to wrapper when no children provided', () => {
      render(<StockFavoriteToggle {...defaultProps} className="wrapper-class" />);
      
      // Since it renders StockFavoriteButton, the className should be passed through
      const button = screen.getByRole('button');
      expect(button).toHaveClass('wrapper-class');
    });

    it('should apply className to wrapper div when children provided', () => {
      const mockChildrenFn = vi.fn(() => <span>Test content</span>);
      
      render(
        <StockFavoriteToggle {...defaultProps} className="wrapper-class">
          {mockChildrenFn}
        </StockFavoriteToggle>
      );
      
      const wrapper = screen.getByText('Test content').parentElement;
      expect(wrapper).toHaveClass('wrapper-class');
    });
  });

  describe('Error Handling', () => {
    it('should handle toggle errors in render props', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockToggleFavorite.mockRejectedValue(new Error('Toggle failed'));
      
      const mockChildrenFn = vi.fn(({ toggleFavorite, isToggling }) => (
        <div>
          <span>{isToggling ? 'Loading...' : 'Ready'}</span>
          <button onClick={toggleFavorite}>Toggle</button>
        </div>
      ));
      
      render(
        <StockFavoriteToggle {...defaultProps}>
          {mockChildrenFn}
        </StockFavoriteToggle>
      );
      
      const toggleButton = screen.getByText('Toggle');
      await user.click(toggleButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Toggle favorite failed:', expect.any(Error));
        expect(screen.getByText('Ready')).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });
  });
});

describe('Integration Tests', () => {
  const defaultProps = {
    tsCode: '000001.SZ',
    name: '平安银行',
    symbol: '000001',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockToggleFavorite.mockResolvedValue(undefined);
  });

  it('should work with state changes from unfavorited to favorited', async () => {
    const user = userEvent.setup();
    
    // Start unfavorited
    mockIsFavorite.mockReturnValue(false);
    
    const { rerender } = render(<StockFavoriteButton {...defaultProps} showText />);
    
    expect(screen.getByText('收藏')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveClass('text-muted-foreground');
    
    // Simulate favorite toggle
    await user.click(screen.getByRole('button'));
    expect(mockToggleFavorite).toHaveBeenCalled();
    
    // Simulate state change to favorited
    mockIsFavorite.mockReturnValue(true);
    rerender(<StockFavoriteButton {...defaultProps} showText />);
    
    expect(screen.getByText('已收藏')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveClass('text-yellow-500');
    
    const star = screen.getByRole('button').querySelector('svg');
    expect(star).toHaveClass('fill-current');
  });

  it('should work with complex UI compositions', async () => {
    const user = userEvent.setup();
    mockIsFavorite.mockReturnValue(false);
    
    render(
      <div className="stock-card">
        <h3>平安银行</h3>
        <div className="stock-actions">
          <StockFavoriteToggle {...defaultProps}>
            {({ isFavorite, isToggling, toggleFavorite }) => (
              <div className="custom-favorite-control">
                <span className="favorite-status">
                  {isFavorite ? '★ 已收藏' : '☆ 未收藏'}
                </span>
                <button 
                  onClick={toggleFavorite}
                  disabled={isToggling}
                  className="custom-toggle-btn"
                >
                  {isToggling ? '处理中...' : '切换收藏'}
                </button>
              </div>
            )}
          </StockFavoriteToggle>
        </div>
      </div>
    );
    
    expect(screen.getByText('☆ 未收藏')).toBeInTheDocument();
    expect(screen.getByText('切换收藏')).toBeInTheDocument();
    
    const toggleButton = screen.getByText('切换收藏');
    await user.click(toggleButton);
    
    expect(mockToggleFavorite).toHaveBeenCalledWith({
      ts_code: '000001.SZ',
      name: '平安银行',
      symbol: '000001',
    });
  });
});