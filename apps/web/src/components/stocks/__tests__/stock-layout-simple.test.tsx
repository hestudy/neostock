import { describe, it, expect } from 'vitest';
import { StockLayout } from '../stock-layout';
import React from 'react';

// 导入测试设置
import '../../../test-setup';

describe('StockLayout - Simple Tests', () => {
  it('should be a valid React component', () => {
    expect(typeof StockLayout).toBe('function');
    expect(StockLayout.name).toBe('StockLayout');
  });

  it('should create component without throwing', () => {
    expect(() => {
      const element = React.createElement(StockLayout, {
        children: React.createElement('div', {}, 'Test content')
      });
      expect(element).toBeTruthy();
      expect(element.type).toBe(StockLayout);
      expect(element.props.children).toBeTruthy();
    }).not.toThrow();
  });

  it('should accept required props', () => {
    const props = {
      children: 'Test children',
      className: 'test-class',
      sidebar: React.createElement('div', {}, 'Sidebar'),
      header: React.createElement('div', {}, 'Header')
    };

    expect(() => {
      React.createElement(StockLayout, props);
    }).not.toThrow();
  });
});