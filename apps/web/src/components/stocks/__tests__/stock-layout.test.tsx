import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockLayout, StockPageContainer, StockGrid } from '../stock-layout';

describe('StockLayout', () => {
  describe('Basic Rendering', () => {
    it('should render children correctly', () => {
      render(
        <StockLayout>
          <div data-testid="main-content">Main content</div>
        </StockLayout>
      );
      
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
      expect(screen.getByText('Main content')).toBeInTheDocument();
    });

    it('should apply default classes', () => {
      render(
        <StockLayout>
          <div data-testid="main-content">Content</div>
        </StockLayout>
      );
      
      const mainContent = screen.getByTestId('main-content');
      const layoutRoot = mainContent.closest('.flex.flex-col.min-h-screen');
      
      expect(layoutRoot).toBeInTheDocument();
      expect(layoutRoot).toHaveClass('flex', 'flex-col', 'min-h-screen');
    });

    it('should apply custom className', () => {
      render(
        <StockLayout className="custom-layout-class">
          <div data-testid="main-content">Content</div>
        </StockLayout>
      );
      
      const mainContent = screen.getByTestId('main-content');
      const layoutRoot = mainContent.closest('div');
      
      expect(layoutRoot).toHaveClass('custom-layout-class');
    });
  });

  describe('Header Rendering', () => {
    it('should render header when provided', () => {
      render(
        <StockLayout header={<div data-testid="header">Header content</div>}>
          <div data-testid="main-content">Main content</div>
        </StockLayout>
      );
      
      const header = screen.getByTestId('header');
      expect(header).toBeInTheDocument();
      expect(screen.getByText('Header content')).toBeInTheDocument();
      
      // Header should be wrapped in appropriate container
      const headerContainer = header.parentElement;
      expect(headerContainer).toHaveClass('border-b', 'bg-background/95', 'backdrop-blur');
    });

    it('should not render header container when header is not provided', () => {
      render(
        <StockLayout>
          <div data-testid="main-content">Main content</div>
        </StockLayout>
      );
      
      // Should not find header container
      const headerContainer = document.querySelector('.border-b.bg-background\\/95');
      expect(headerContainer).not.toBeInTheDocument();
    });
  });

  describe('Sidebar Rendering', () => {
    it('should render sidebar when provided', () => {
      render(
        <StockLayout sidebar={<div data-testid="sidebar">Sidebar content</div>}>
          <div data-testid="main-content">Main content</div>
        </StockLayout>
      );
      
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toBeInTheDocument();
      expect(screen.getByText('Sidebar content')).toBeInTheDocument();
      
      // Sidebar should be wrapped in aside element
      const sidebarAside = sidebar.closest('aside');
      expect(sidebarAside).toBeInTheDocument();
      expect(sidebarAside).toHaveClass('hidden', 'lg:block', 'w-64', 'border-r');
    });

    it('should not render sidebar aside when sidebar is not provided', () => {
      render(
        <StockLayout>
          <div data-testid="main-content">Main content</div>
        </StockLayout>
      );
      
      // Should not find sidebar aside
      const sidebarAside = document.querySelector('aside');
      expect(sidebarAside).not.toBeInTheDocument();
    });
  });

  describe('Main Content Area', () => {
    it('should render main content in proper container', () => {
      render(
        <StockLayout>
          <div data-testid="main-content">Main content</div>
        </StockLayout>
      );
      
      const mainContent = screen.getByTestId('main-content');
      const mainElement = mainContent.closest('main');
      const contentContainer = mainContent.parentElement;
      
      expect(mainElement).toBeInTheDocument();
      expect(mainElement).toHaveClass('flex-1', 'overflow-auto');
      
      expect(contentContainer).toHaveClass('container', 'mx-auto', 'p-4', 'max-w-7xl');
    });
  });

  describe('Layout Structure', () => {
    it('should have proper layout structure with header and sidebar', () => {
      render(
        <StockLayout 
          header={<div data-testid="header">Header</div>}
          sidebar={<div data-testid="sidebar">Sidebar</div>}
        >
          <div data-testid="main-content">Main content</div>
        </StockLayout>
      );
      
      // Check overall structure
      const header = screen.getByTestId('header');
      const sidebar = screen.getByTestId('sidebar');
      const mainContent = screen.getByTestId('main-content');
      
      // Header should come before the flex container
      const flexContainer = document.querySelector('.flex.flex-1');
      const headerContainer = header.parentElement;
      
      expect(headerContainer?.nextElementSibling).toBe(flexContainer);
      
      // Sidebar should be inside flex container before main
      const sidebarAside = sidebar.closest('aside');
      const mainElement = mainContent.closest('main');
      
      expect(sidebarAside?.parentElement).toBe(flexContainer);
      expect(mainElement?.parentElement).toBe(flexContainer);
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive classes for sidebar', () => {
      render(
        <StockLayout sidebar={<div data-testid="sidebar">Sidebar</div>}>
          <div data-testid="main-content">Content</div>
        </StockLayout>
      );
      
      const sidebar = screen.getByTestId('sidebar');
      const sidebarAside = sidebar.closest('aside');
      
      expect(sidebarAside).toHaveClass('hidden', 'lg:block');
    });
  });

  describe('Backdrop Blur Effects', () => {
    it('should apply backdrop blur classes to header and sidebar', () => {
      render(
        <StockLayout 
          header={<div data-testid="header">Header</div>}
          sidebar={<div data-testid="sidebar">Sidebar</div>}
        >
          <div data-testid="main-content">Content</div>
        </StockLayout>
      );
      
      const header = screen.getByTestId('header');
      const sidebar = screen.getByTestId('sidebar');
      
      const headerContainer = header.parentElement;
      const sidebarAside = sidebar.closest('aside');
      
      expect(headerContainer).toHaveClass('backdrop-blur', 'bg-background/95');
      expect(sidebarAside).toHaveClass('backdrop-blur', 'bg-background/95');
    });
  });
});

describe('StockPageContainer', () => {
  describe('Basic Rendering', () => {
    it('should render children correctly', () => {
      render(
        <StockPageContainer>
          <div data-testid="page-content">Page content</div>
        </StockPageContainer>
      );
      
      expect(screen.getByTestId('page-content')).toBeInTheDocument();
    });

    it('should apply default grid classes', () => {
      render(
        <StockPageContainer>
          <div data-testid="page-content">Content</div>
        </StockPageContainer>
      );
      
      const pageContent = screen.getByTestId('page-content');
      const container = pageContent.parentElement;
      
      expect(container).toHaveClass('grid', 'grid-cols-1', 'gap-4');
    });

    it('should apply custom className', () => {
      render(
        <StockPageContainer className="custom-page-class">
          <div data-testid="page-content">Content</div>
        </StockPageContainer>
      );
      
      const pageContent = screen.getByTestId('page-content');
      const container = pageContent.parentElement;
      
      expect(container).toHaveClass('custom-page-class');
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive padding classes', () => {
      render(
        <StockPageContainer>
          <div data-testid="page-content">Content</div>
        </StockPageContainer>
      );
      
      const pageContent = screen.getByTestId('page-content');
      const container = pageContent.parentElement;
      
      expect(container).toHaveClass('sm:gap-4', 'sm:p-2');
      expect(container).toHaveClass('md:grid-cols-1', 'md:gap-6', 'md:p-4');
      expect(container).toHaveClass('lg:grid-cols-1', 'lg:gap-8', 'lg:p-6');
      expect(container).toHaveClass('xl:grid-cols-1', 'xl:gap-8');
    });
  });

  describe('Touch Optimizations', () => {
    it('should have touch optimization classes', () => {
      render(
        <StockPageContainer>
          <div data-testid="page-content">Content</div>
        </StockPageContainer>
      );
      
      const pageContent = screen.getByTestId('page-content');
      const container = pageContent.parentElement;
      
      expect(container).toHaveClass('touch-action-manipulation');
      expect(container).toHaveClass('-webkit-tap-highlight-color-transparent');
    });
  });
});

describe('StockGrid', () => {
  describe('Basic Rendering', () => {
    it('should render children correctly', () => {
      render(
        <StockGrid>
          <div data-testid="grid-item-1">Item 1</div>
          <div data-testid="grid-item-2">Item 2</div>
          <div data-testid="grid-item-3">Item 3</div>
        </StockGrid>
      );
      
      expect(screen.getByTestId('grid-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('grid-item-2')).toBeInTheDocument();
      expect(screen.getByTestId('grid-item-3')).toBeInTheDocument();
    });

    it('should apply default grid classes', () => {
      render(
        <StockGrid>
          <div data-testid="grid-item">Item</div>
        </StockGrid>
      );
      
      const gridItem = screen.getByTestId('grid-item');
      const gridContainer = gridItem.parentElement;
      
      expect(gridContainer).toHaveClass('grid', 'gap-4', 'grid-cols-1');
    });

    it('should apply custom className', () => {
      render(
        <StockGrid className="custom-grid-class">
          <div data-testid="grid-item">Item</div>
        </StockGrid>
      );
      
      const gridItem = screen.getByTestId('grid-item');
      const gridContainer = gridItem.parentElement;
      
      expect(gridContainer).toHaveClass('custom-grid-class');
    });
  });

  describe('Responsive Grid Columns', () => {
    it('should have responsive grid column classes', () => {
      render(
        <StockGrid>
          <div data-testid="grid-item">Item</div>
        </StockGrid>
      );
      
      const gridItem = screen.getByTestId('grid-item');
      const gridContainer = gridItem.parentElement;
      
      expect(gridContainer).toHaveClass('grid-cols-1'); // Base
      expect(gridContainer).toHaveClass('sm:grid-cols-2'); // Small screens
      expect(gridContainer).toHaveClass('lg:grid-cols-3'); // Large screens
      expect(gridContainer).toHaveClass('xl:grid-cols-4'); // Extra large screens
      expect(gridContainer).toHaveClass('2xl:grid-cols-5'); // 2X large screens
    });
  });

  describe('Multiple Items', () => {
    it('should render multiple grid items', () => {
      const items = Array.from({ length: 6 }, (_, i) => (
        <div key={i} data-testid={`grid-item-${i}`}>
          Item {i + 1}
        </div>
      ));
      
      render(<StockGrid>{items}</StockGrid>);
      
      items.forEach((_, i) => {
        expect(screen.getByTestId(`grid-item-${i}`)).toBeInTheDocument();
      });
    });
  });
});

describe('Integration Tests', () => {
  it('should work together in a complex layout', () => {
    render(
      <StockLayout
        header={
          <div data-testid="layout-header">
            <h1>Stock Dashboard</h1>
          </div>
        }
        sidebar={
          <div data-testid="layout-sidebar">
            <nav>Navigation</nav>
          </div>
        }
      >
        <StockPageContainer>
          <div className="section-header">
            <h2>Stock List</h2>
          </div>
          <StockGrid>
            <div data-testid="stock-1">Stock 1</div>
            <div data-testid="stock-2">Stock 2</div>
            <div data-testid="stock-3">Stock 3</div>
          </StockGrid>
        </StockPageContainer>
      </StockLayout>
    );
    
    // All components should be present
    expect(screen.getByTestId('layout-header')).toBeInTheDocument();
    expect(screen.getByTestId('layout-sidebar')).toBeInTheDocument();
    expect(screen.getByText('Stock List')).toBeInTheDocument();
    expect(screen.getByTestId('stock-1')).toBeInTheDocument();
    expect(screen.getByTestId('stock-2')).toBeInTheDocument();
    expect(screen.getByTestId('stock-3')).toBeInTheDocument();
    
    // Structure should be correct
    const header = screen.getByTestId('layout-header');
    const sidebar = screen.getByTestId('layout-sidebar');
    const stock1 = screen.getByTestId('stock-1');
    
    // Header should be in header container
    expect(header.parentElement).toHaveClass('border-b');
    
    // Sidebar should be in aside
    expect(sidebar.closest('aside')).toBeInTheDocument();
    
    // Stock items should be in grid
    expect(stock1.parentElement).toHaveClass('grid');
  });

  it('should handle empty states gracefully', () => {
    render(
      <StockLayout>
        <StockPageContainer>
          <StockGrid>
            {/* Empty grid */}
          </StockGrid>
        </StockPageContainer>
      </StockLayout>
    );
    
    // Should render without errors
    const gridContainer = document.querySelector('.grid.gap-4');
    expect(gridContainer).toBeInTheDocument();
  });
});