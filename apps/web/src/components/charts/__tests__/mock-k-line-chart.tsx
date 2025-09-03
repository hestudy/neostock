import React from 'react';
import type { ChartDataPoint } from '../../../types/charts';

// Mock KLineChart component for testing
export const MockKLineChart: React.FC<{
  data: ChartDataPoint[];
  width: number;
  height: number;
  theme?: string;
  loading?: boolean;
  className?: string;
  customTheme?: Record<string, unknown>;
  bundleAnalyzer?: { getChartBundleSize: () => number };
  deviceInfo?: { isLowEndDevice: boolean; maxDataPoints: number };
  performanceMonitor?: Record<string, unknown>;
  [key: string]: unknown;
}> = ({ 
  data, 
  width, 
  height, 
  theme = 'light',
  loading = false,
  className = '',
  customTheme,
  deviceInfo,
  ...props 
}) => {
  // Handle unknown theme by falling back to light
  const safeTheme = theme === 'light' || theme === 'dark' ? theme : 'light';
  
  // Handle custom theme
  const backgroundColor = customTheme?.background || (safeTheme === 'dark' ? '#1a1a1a' : '#ffffff');
  
  return (
    <div 
      data-testid="chart-container"
      className={`chart-container theme-${safeTheme} mobile-optimized touch-friendly ${className} ${customTheme ? 'theme-custom' : ''}`}
      data-mobile-optimized="true"
      data-performance-mode={deviceInfo?.isLowEndDevice ? 'low' : 'normal'}
      style={{ 
        width, 
        height,
        backgroundColor,
        color: safeTheme === 'dark' ? '#ffffff' : '#000000'
      } as React.CSSProperties}
      role="img"
      aria-label={`股票K线图表 - ${safeTheme === 'dark' ? '深色主题' : '浅色主题'}`}
      {...props}
    >
      {loading && (
        <div data-testid="chart-loading" className="loading-indicator">
          加载中...
        </div>
      )}
      
      {/* Mock chart elements */}
      <div 
        data-testid="chart-grid" 
        className="chart-grid"
        style={{ 
          stroke: safeTheme === 'dark' ? '#2a2a2a' : '#e0e0e0' 
        }}
      ></div>
      {data.map((point, index) => (
        <div 
          key={index} 
          data-testid="chart-data-point" 
          data-value={point.close}
          className="data-point"
        />
      ))}
    </div>
  );
};

// Export as KLineChart for testing
export const KLineChart = MockKLineChart;