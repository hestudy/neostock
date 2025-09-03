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
  applyTheme,
  configureAxisFormatting,
  applyDarkThemeAxisFormatting,
  applyLightThemeAxisFormatting
} from '../../lib/chart-utils';
import { MultiIndicatorLayoutManager, type MultiIndicatorLayoutConfig } from '../../lib/multi-indicator-layout-manager';
import { useTheme } from '../../hooks/use-theme';
import { cn } from '../../lib/utils';

interface MultiIndicatorKLineChartProps {
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
  /** 技术指标可见性控制 */
  visibleIndicators?: {
    ma?: boolean;
    macd?: boolean;
    rsi?: boolean;
  };
  /** 多指标布局配置 */
  layoutConfig?: Partial<MultiIndicatorLayoutConfig>;
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
    /** 布局变化回调 */
  onLayoutChange?: (layout: MultiIndicatorLayoutConfig) => void;
}

/**
 * 多指标K线图组件
 * 
 * 支持多种布局模式的多技术指标显示组件：
 * - overlay: 指标叠加在主图上
 * - stacked: 指标堆叠在主图下方
 * - split: 指标在独立区域显示
 */
export const MultiIndicatorKLineChart: React.FC<MultiIndicatorKLineChartProps> = ({
  data,
  width,
  height,
  indicators = [],
  showVolume = true,
  visibleIndicators = { ma: true, macd: true, rsi: true },
  layoutConfig = {},
  theme: propTheme,
  performanceConfig = {},
  loading = false,
  error,
  className,
  onDataUpdate,
  onChartClick,
  onCrosshairMove,
  onLayoutChange,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ChartInstance | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { theme: contextTheme } = useTheme();
  const layoutManagerRef = useRef<MultiIndicatorLayoutManager | null>(null);
  
  // 确定使用的主题
  const theme = (propTheme || contextTheme || 'light') as 'light' | 'dark';

  // 初始化布局管理器
  useEffect(() => {
    if (chartContainerRef.current) {
      layoutManagerRef.current = new MultiIndicatorLayoutManager(layoutConfig);
      layoutManagerRef.current.init(chartContainerRef.current);
    }

    return () => {
      layoutManagerRef.current?.destroy();
    };
  }, [layoutConfig]);

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

      // 配置轴格式化
      configureAxisFormatting(instance);
      
      // 根据主题应用轴格式化
      if (theme === 'dark') {
        applyDarkThemeAxisFormatting(instance);
      } else {
        applyLightThemeAxisFormatting(instance);
      }

      // 设置事件监听器
      if (instance.chart) {
        instance.chart.subscribeCrosshairMove((param) => {
          if (param && param.time && param.seriesData) {
            const dataPoint = data.find(d => 
              new Date(d.time).getTime() / 1000 === param.time
            );
            onCrosshairMove?.(dataPoint || null);
          }
        });

        instance.chart.subscribeClick((param) => {
          if (param && param.time) {
            const dataPoint = data.find(d => 
              new Date(d.time).getTime() / 1000 === param.time
            );
            onChartClick?.(dataPoint || null);
          }
        });

        // 双击重置视图
        instance.chart.subscribeCrosshairMove((param) => {
          if (param && param.time) {
            const now = Date.now();
            if (instance.lastClickTime && (now - instance.lastClickTime < 300)) {
              instance.chart.timeScale().resetTimeScale();
            }
            instance.lastClickTime = now;
          }
        });
      }
    } catch (err) {
      console.error('Failed to initialize chart:', err);
    }
  }, [width, height, theme, isInitialized, data, onCrosshairMove, onChartClick]);

  // 更新图表数据
  const updateChart = useCallback(() => {
    if (!chartInstanceRef.current || !data.length) return;

    try {
      const config = { ...defaultPerformanceConfig, ...performanceConfig };
      updateChartData(chartInstanceRef.current, data, config, showVolume);
      
      // 更新布局
      if (layoutManagerRef.current) {
        const visibleIndicatorTypes = Object.entries(visibleIndicators)
          .filter(([, visible]) => visible)
          .map(([type]) => type as 'ma' | 'macd' | 'rsi');

        layoutManagerRef.current.updateLayout(visibleIndicatorTypes, height);
        
        // 添加技术指标到布局
        if (indicators.length > 0) {
          const indicatorConfig = {
            ma: {
              periods: [5, 10, 20, 60],
              colors: ['#ff9800', '#4caf50', '#2196f3', '#9c27b0'],
            },
            macd: {
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9,
              colors: {
                macd: '#2196f3',
                signal: '#ff9800',
                histogram: '#4caf50',
              },
            },
            rsi: {
              periods: [6, 12, 24],
              overbought: 70,
              oversold: 30,
              colors: ['#2196f3', '#ff9800', '#4caf50'],
            },
          };

          visibleIndicatorTypes.forEach(type => {
            if (layoutManagerRef.current) {
              layoutManagerRef.current.addIndicatorToLayout(
                chartInstanceRef.current!,
                type,
                indicators,
                indicatorConfig
              );
            }
          });
        }
      }
      
      // 触发数据更新回调
      onDataUpdate?.(data);
    } catch (err) {
      console.error('Failed to update chart data:', err);
    }
  }, [data, indicators, performanceConfig, showVolume, visibleIndicators, height, onDataUpdate]);

  // 调整图表大小
  const handleResize = useCallback(() => {
    if (!chartInstanceRef.current) return;
    
    try {
      resizeChart(chartInstanceRef.current, width, height);
      
      // 更新布局
      if (layoutManagerRef.current) {
        const visibleIndicatorTypes = Object.entries(visibleIndicators)
          .filter(([, visible]) => visible)
          .map(([type]) => type as 'ma' | 'macd' | 'rsi');
        
        layoutManagerRef.current.updateLayout(visibleIndicatorTypes, height);
      }
    } catch (err) {
      console.error('Failed to resize chart:', err);
    }
  }, [width, height, visibleIndicators]);

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

  // 处理技术指标可见性变化
  useEffect(() => {
    if (!chartInstanceRef.current || !isInitialized) return;

    try {
      const visibleIndicatorTypes = Object.entries(visibleIndicators)
        .filter(([, visible]) => visible)
        .map(([type]) => type as 'ma' | 'macd' | 'rsi');

      // 更新布局
      if (layoutManagerRef.current) {
        layoutManagerRef.current.updateLayout(visibleIndicatorTypes, height);
        
        // 重新添加可见的技术指标
        if (indicators.length > 0) {
          const indicatorConfig = {
            ma: {
              periods: [5, 10, 20, 60],
              colors: ['#ff9800', '#4caf50', '#2196f3', '#9c27b0'],
            },
            macd: {
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9,
              colors: {
                macd: '#2196f3',
                signal: '#ff9800',
                histogram: '#4caf50',
              },
            },
            rsi: {
              periods: [6, 12, 24],
              overbought: 70,
              oversold: 30,
              colors: ['#2196f3', '#ff9800', '#4caf50'],
            },
          };

          visibleIndicatorTypes.forEach(type => {
            layoutManagerRef.current?.addIndicatorToLayout(
              chartInstanceRef.current!,
              type,
              indicators,
              indicatorConfig
            );
          });
        }
      }
    } catch (err) {
      console.error('Failed to update indicator visibility:', err);
    }
  }, [visibleIndicators, indicators, height, isInitialized]);

  // 处理布局配置变化
  useEffect(() => {
    if (layoutManagerRef.current) {
      layoutManagerRef.current.updateConfig(layoutConfig);
      onLayoutChange?.(layoutManagerRef.current['config']);
    }
  }, [layoutConfig, onLayoutChange]);

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
      
      // 更新轴格式化
      if (theme === 'dark') {
        applyDarkThemeAxisFormatting(chartInstanceRef.current);
      } else {
        applyLightThemeAxisFormatting(chartInstanceRef.current);
      }
    }
  }, [theme, isInitialized]);

  // 尺寸变更效果
  useEffect(() => {
    if (isInitialized) {
      handleResize();
    }
  }, [width, height, isInitialized, handleResize]);

  return (
    <div
      ref={chartContainerRef}
      className={cn(
        'relative w-full h-full',
        'multi-indicator-chart-container',
        className
      )}
      data-theme={theme}
      data-layout-mode={layoutConfig.layoutMode || 'overlay'}
    >
      {/* 加载状态 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">加载图表数据...</p>
          </div>
        </div>
      )}
      
      {/* 错误状态 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="text-center text-destructive">
            <p className="text-sm font-medium">图表加载失败</p>
            <p className="text-xs">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

MultiIndicatorKLineChart.displayName = 'MultiIndicatorKLineChart';