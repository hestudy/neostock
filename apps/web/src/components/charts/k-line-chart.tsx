import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { 
  ChartDataPoint, 
  TechnicalIndicatorData, 
  ChartInstance, 
  PerformanceConfig 
} from '../../types/charts';
import { 
  createChartInstance, 
  updateChartData, 
  addMASeries, 
  addMACDSeries, 
  addRSISeries,
  resizeChart,
  defaultPerformanceConfig,
  destroyChart,
  applyTheme,
  monitorChartPerformance
} from '../../lib/chart-utils';
import { useTheme } from '../../hooks/use-theme';
import { cn } from '../../lib/utils';

interface KLineChartProps {
  /** 图表数据 */
  data: ChartDataPoint[];
  /** 技术指标数据 */
  technicalData?: TechnicalIndicatorData[];
  /** 图表宽度 */
  width: number;
  /** 图表高度 */
  height: number;
  /** 是否显示十字光标 */
  crosshair?: boolean;
  /** 是否支持缩放 */
  zoom?: boolean;
  /** 是否响应式 */
  responsive?: boolean;
  /** 技术指标配置 */
  indicators?: {
    ma?: number[];
    macd?: boolean;
    rsi?: number[];
  };
  /** 性能配置 */
  performance?: Partial<PerformanceConfig>;
  /** 点击事件回调 */
  onClick?: (data: ChartDataPoint | null) => void;
  /** 鼠标悬停事件回调 */
  onMouseOver?: (data: ChartDataPoint | null) => void;
  /** 鼠标移出事件回调 */
  onMouseOut?: () => void;
  /** 键盘事件回调 */
  onKeyDown?: (event: React.KeyboardEvent) => void;
  /** 是否显示移动平均线 */
  showMA?: boolean;
  /** 移动平均线周期 */
  maPeriods?: number[];
  /** 是否显示MACD */
  showMACD?: boolean;
  /** 是否显示RSI */
  showRSI?: boolean;
  /** RSI周期 */
  rsiPeriods?: number[];
  /** 图表点击事件（兼容旧版本） */
  onChartClick?: (data: ChartDataPoint | null) => void;
  /** 图表悬停事件（兼容旧版本） */
  onChartHover?: (data: ChartDataPoint | null) => void;
  /** 自定义样式类名 */
  className?: string;
}

export const KLineChart: React.FC<KLineChartProps> = ({
  data,
  technicalData = [],
  width,
  height,
  crosshair = true,
  responsive = false,
  indicators = {},
  performance = {},
  onClick,
  onMouseOver,
  onMouseOut,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ChartInstance | null>(null);
  const { theme = 'light' } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 创建图表实例
  const createChart = useCallback(() => {
    if (!containerRef.current) return;

    try {
      const instance = createChartInstance({
        container: containerRef.current,
        width,
        height,
        layout: {
          background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
          textColor: theme === 'dark' ? '#ffffff' : '#333333'
        },
        crosshair: {
          mode: crosshair ? 0 : undefined,
          vertLine: {
            width: 1,
            color: theme === 'dark' ? '#758696' : '#758696',
            style: 3
          },
          horzLine: {
            width: 1,
            color: theme === 'dark' ? '#758696' : '#758696',
            style: 3
          }
        }
      });

      chartInstanceRef.current = instance;
      
      // 应用主题
      applyTheme(instance, theme);
      
      return instance;
    } catch (err) {
      console.error('Failed to create chart:', err);
      setError('图表创建失败');
      return null;
    }
  }, [width, height, crosshair, theme]);

  // 更新图表数据
  const updateChart = useCallback(() => {
    if (!chartInstanceRef.current || !data.length) return;

    try {
      setIsLoading(true);
      setError(null);

      // 更新基础数据
      updateChartData(chartInstanceRef.current, data, { ...defaultPerformanceConfig, ...performance });

      // 添加技术指标
      if (technicalData.length > 0) {
        // MA指标
        if (indicators.ma) {
          indicators.ma.forEach(period => {
            const color = getMAColor(period);
            addMASeries(chartInstanceRef.current!, technicalData, period, color);
          });
        }

        // MACD指标
        if (indicators.macd) {
          addMACDSeries(chartInstanceRef.current!, technicalData, {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            colors: {
              macd: '#2196f3',
              signal: '#ff9800',
              histogram: '#4caf50'
            }
          });
        }

        // RSI指标
        if (indicators.rsi) {
          indicators.rsi.forEach(period => {
            const color = getRSIColor(period);
            addRSISeries(chartInstanceRef.current!, technicalData, period, color);
          });
        }
      }

      // 性能监控
      const perfData = monitorChartPerformance(chartInstanceRef.current);
      console.log('Chart performance:', perfData);

    } catch (err) {
      console.error('Failed to update chart:', err);
      setError('数据更新失败');
    } finally {
      setIsLoading(false);
    }
  }, [data, technicalData, indicators, performance]);

  // 清理图表
  const cleanupChart = useCallback(() => {
    if (chartInstanceRef.current) {
      try {
        destroyChart(chartInstanceRef.current);
        chartInstanceRef.current = null;
      } catch (err) {
        console.error('Failed to destroy chart:', err);
      }
    }
  }, []);

  // 获取MA颜色
  const getMAColor = (period: number): string => {
    const colors = ['#ff9800', '#4caf50', '#2196f3', '#9c27b0'];
    const index = [5, 10, 20, 60].indexOf(period);
    return colors[index] || '#666666';
  };

  // 获取RSI颜色
  const getRSIColor = (period: number): string => {
    const colors = ['#2196f3', '#ff9800', '#4caf50'];
    const index = [6, 12, 24].indexOf(period);
    return colors[index] || '#666666';
  };

  // 处理点击事件
  const handleClick = useCallback(() => {
    if (!onClick) return;
    
    // 简化的点击处理 - 实际应用中需要获取点击位置的数据
    const clickedData = data.length > 0 ? data[data.length - 1] : null;
    onClick(clickedData);
  }, [onClick, data]);

  // 处理鼠标悬停事件
  const handleMouseOver = useCallback(() => {
    if (!onMouseOver) return;
    
    // 简化的鼠标悬停处理
    const hoveredData = data.length > 0 ? data[data.length - 1] : null;
    onMouseOver(hoveredData);
  }, [onMouseOver, data]);

  // 处理窗口大小变化
  useEffect(() => {
    if (!responsive || !chartInstanceRef.current) return;

    const handleResize = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      resizeChart(chartInstanceRef.current!, rect.width, rect.height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [responsive]);

  // 主题变化时更新图表
  useEffect(() => {
    if (!chartInstanceRef.current) return;
    
    applyTheme(chartInstanceRef.current, theme);
  }, [theme]);

  // 数据变化时更新图表
  useEffect(() => {
    if (!chartInstanceRef.current) return;
    
    updateChart();
  }, [data, technicalData, indicators, updateChart]);

  // 组件挂载时创建图表
  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    const instance = createChart();
    if (instance) {
      updateChart();
    }

    return cleanupChart;
  }, [createChart, updateChart, cleanupChart, data.length]);

  // 组件卸载时清理
  useEffect(() => {
    return cleanupChart;
  }, [cleanupChart]);

  if (error) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-red-50 border border-red-200 rounded-lg",
          className
        )}
        style={{ width, height }}
        role="alert"
        aria-live="polite"
      >
        <div className="text-center">
          <div className="text-red-600 font-medium">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg",
          className
        )}
        style={{ width, height }}
        role="img"
        aria-label="K线图表"
      >
        <div className="text-gray-500">暂无数据</div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* 加载状态 */}
      {isLoading && (
        <div 
          className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10"
          data-testid="chart-loading"
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {/* 图表容器 */}
      <div
        ref={containerRef}
        data-testid="k-line-chart"
        className="w-full h-full"
        style={{ width, height }}
        role="img"
        aria-label="K线图表"
        onClick={handleClick}
        onMouseOver={handleMouseOver}
        onMouseOut={onMouseOut}
        tabIndex={0}
        onKeyDown={(e) => {
          // 键盘导航支持
          if (e.key === 'Enter' || e.key === ' ') {
            // 创建一个模拟的鼠标事件
            const mockEvent = {
              preventDefault: () => {},
              stopPropagation: () => {},
              currentTarget: e.currentTarget,
              target: e.target
            } as React.MouseEvent;
            handleClick(mockEvent);
          }
        }}
      />
    </div>
  );
};

KLineChart.displayName = 'KLineChart';