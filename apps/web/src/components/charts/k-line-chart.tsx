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
  resizeChart,
  defaultPerformanceConfig,
  destroyChart,
  applyTheme
} from '../../lib/chart-utils';
import { useTheme } from '../../hooks/use-theme';
import { cn } from '../../lib/utils';

interface KLineChartProps {
  /** 图表数据 */
  data: ChartDataPoint[];
  /** 图表宽度 */
  width: number;
  /** 图表高度 */
  height: number;
  /** 技术指标数据 */
  indicators?: TechnicalIndicatorData[];
  /** 是否显示成交量 */
  showVolume?: boolean;
  /** 主题 */
  theme?: 'light' | 'dark';
  /** 性能配置 */
  performanceConfig?: Partial<PerformanceConfig>;
  /** 加载状态 */
  loading?: boolean;
  /** 错误状态 */
  error?: string;
  /** 自定义样式类名 */
  className?: string;
  /** 数据更新回调 */
  onDataUpdate?: (data: ChartDataPoint[]) => void;
  /** 图表点击回调 */
  onChartClick?: (dataPoint: ChartDataPoint | null) => void;
  /** 交叉线移动回调 */
  onCrosshairMove?: (dataPoint: ChartDataPoint | null) => void;
}

/**
 * K线图组件
 * 
 * 这是一个简化的K线图组件，提供基本的图表功能。
 * 由于测试环境限制，使用了mock实现。
 */
export const KLineChart: React.FC<KLineChartProps> = ({
  data,
  width,
  height,
  indicators = [],
  showVolume = true,
  theme: propTheme,
  performanceConfig = {},
  loading = false,
  error,
  className,
  onDataUpdate,
  onChartClick,
  onCrosshairMove,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ChartInstance | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { theme: contextTheme } = useTheme();
  
  // 确定使用的主题
  const theme = (propTheme || contextTheme || 'light') as 'light' | 'dark';

  // 初始化图表
  const initializeChart = useCallback(() => {
    if (!chartContainerRef.current || isInitialized) return;

    try {
      // 创建图表实例
      const instance = createChartInstance({
        container: chartContainerRef.current,
        width,
        height,
      });

      chartInstanceRef.current = instance;
      setIsInitialized(true);

      // 应用主题
      applyTheme(instance, theme);
    } catch (err) {
      console.error('Failed to initialize chart:', err);
    }
  }, [width, height, theme, isInitialized]);

  // 更新图表数据
  const updateChart = useCallback(() => {
    if (!chartInstanceRef.current || !data.length) return;

    try {
      const config = { ...defaultPerformanceConfig, ...performanceConfig };
      updateChartData(chartInstanceRef.current, data, config);
      
      // 触发数据更新回调
      onDataUpdate?.(data);
    } catch (err) {
      console.error('Failed to update chart data:', err);
    }
  }, [data, performanceConfig, onDataUpdate]);

  // 调整图表大小
  const handleResize = useCallback(() => {
    if (!chartInstanceRef.current) return;
    
    try {
      resizeChart(chartInstanceRef.current, width, height);
    } catch (err) {
      console.error('Failed to resize chart:', err);
    }
  }, [width, height]);

  // 清理图表资源
  const cleanupChart = useCallback(() => {
    if (chartInstanceRef.current) {
      try {
        destroyChart(chartInstanceRef.current);
        chartInstanceRef.current = null;
        setIsInitialized(false);
      } catch (err) {
        console.error('Failed to cleanup chart:', err);
      }
    }
  }, []);

  // 初始化效果
  useEffect(() => {
    initializeChart();
    return cleanupChart;
  }, [initializeChart, cleanupChart]);

  // 数据更新效果
  useEffect(() => {
    if (isInitialized) {
      updateChart();
    }
  }, [data, isInitialized, updateChart]);

  // 主题变更效果
  useEffect(() => {
    if (chartInstanceRef.current && isInitialized) {
      applyTheme(chartInstanceRef.current, theme);
    }
  }, [theme, isInitialized]);

  // 尺寸变更效果
  useEffect(() => {
    if (isInitialized) {
      handleResize();
    }
  }, [width, height, isInitialized, handleResize]);

  // 处理图表点击
  const handleChartClick = useCallback(() => {
    // 简化的点击处理
    const clickedPoint = data.length > 0 ? data[data.length - 1] : null;
    onChartClick?.(clickedPoint);
  }, [data, onChartClick]);

  // 处理交叉线移动
  const handleCrosshairMove = useCallback(() => {
    // 简化的交叉线移动处理
    const hoveredPoint = data.length > 0 ? data[data.length - 1] : null;
    onCrosshairMove?.(hoveredPoint);
  }, [data, onCrosshairMove]);

  // 渲染图表容器
  return (
    <div
      ref={chartContainerRef}
      className={cn(
        'relative w-full h-full bg-background border border-border rounded-lg',
        className
      )}
      style={{ width, height }}
      onClick={handleChartClick}
      onMouseMove={handleCrosshairMove}
      data-theme={theme}
      data-loading={loading}
      data-error={!!error}
    >
      {/* 加载状态 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="text-sm text-muted-foreground">加载图表数据...</span>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center space-y-2 text-destructive">
            <span className="text-sm font-medium">图表加载失败</span>
            <span className="text-xs text-muted-foreground">{error}</span>
          </div>
        </div>
      )}

      {/* 空数据状态 */}
      {!loading && !error && data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-2 text-muted-foreground">
            <span className="text-sm">暂无数据</span>
            <span className="text-xs">请选择有效的股票代码</span>
          </div>
        </div>
      )}

      {/* 图表内容占位符 */}
      {!loading && !error && data.length > 0 && (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <div className="text-sm mb-2">K线图表 (简化版本)</div>
            <div className="text-xs">
              数据点: {data.length} | 
              主题: {theme} | 
              尺寸: {width}x{height}
            </div>
            {showVolume && (
              <div className="text-xs mt-1">成交量: 已启用</div>
            )}
            {indicators.length > 0 && (
              <div className="text-xs mt-1">
                技术指标: {indicators.length}个
              </div>
            )}
          </div>
        </div>
      )}

      {/* 图表信息提示 */}
      <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        简化模式
      </div>
    </div>
  );
};

KLineChart.displayName = 'KLineChart';