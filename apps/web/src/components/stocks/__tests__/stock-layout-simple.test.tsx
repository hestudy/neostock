import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StockLayout } from '../stock-layout';

// 导入测试设置
import '../../../test-setup';

describe('StockLayout - Simple Tests', () => {
  it('should render without crashing', () => {
    const result = render(
      <StockLayout>
        <div>Test content</div>
      </StockLayout>
    );
    
    expect(result).toBeTruthy();
    expect(result.container).toBeTruthy();
  });

  it('should render children', () => {
    const result = render(
      <StockLayout>
        <div data-testid="child">Child content</div>
      </StockLayout>
    );
    
    // 使用 container.querySelector 而不是 screen
    const childElement = result.container.querySelector('[data-testid="child"]');
    expect(childElement).toBeTruthy();
    expect(childElement?.textContent).toBe('Child content');
  });
});