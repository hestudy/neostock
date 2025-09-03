import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
import { OptimizedMultiIndicatorLayoutManager, defaultOptimizedLayoutConfig, type OptimizedLayoutConfig } from '../../lib/optimized-multi-indicator-layout-manager';
import { useTheme } from '../../hooks/use-theme';
import { useDebounce } from '../../hooks/use-debounce';
import { cn } from '../../lib/utils';

interface OptimizedMultiIndicatorKLineChartProps {
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
  /** 优化的布局配置 */
  layoutConfig?: Partial<OptimizedLayoutConfig>;
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
    /** 性能指标回调 */
  onPerformanceMetrics?: (metrics: { renderTime: number; memoryUsage: number; fps: number }) => void;
}

/**
 * 性能优化的多指标K线图组件
 * 
 * 集成了多种性能优化策略：
 * - 数据虚拟化渲染
 * - 智能缓存机制
 * - 防抖和批量更新
 * - 惰性渲染
 * - 性能监控
 */
export const OptimizedMultiIndicatorKLineChart: React.FC<OptimizedMultiIndicatorKLineChartProps> = ({
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
    onPerformanceMetrics,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ChartInstance | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { theme: contextTheme } = useTheme();
  const layoutManagerRef = useRef<OptimizedMultiIndicatorLayoutManager | null>(null);
  const scrollPositionRef = useRef(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<{ 
    renderTime: number; 
    memoryUsage: number; 
    fps: number;
    cacheHitRate?: number;
    visibleIndicators?: number;
    totalIndicators?: number;
  } | null>(null);
  
  // 确定使用的主题
  const theme = (propTheme || contextTheme || 'light') as 'light' | 'dark';

  // 防抖滚动位置
  const debouncedScrollPosition = useDebounce(scrollPositionRef.current, 16);

  // 优化的配置
  const optimizedConfig = useMemo(() => ({
    ...defaultOptimizedLayoutConfig,
    ...layoutConfig,
  }), [layoutConfig]);

  // 初始化布局管理器
  useEffect(() => {
    if (chartContainerRef.current) {
      layoutManagerRef.current = new OptimizedMultiIndicatorLayoutManager(optimizedConfig);
      layoutManagerRef.current.init(chartContainerRef.current);
      
      // 设置完整数据集
      layoutManagerRef.current.setFullData(data, indicators);
    }

    return () => {
      layoutManagerRef.current?.destroy();
    };
  }, [data, indicators, optimizedConfig]);

  // 优化的初始化图表
  const initializeChart = useCallback(() => {
    if (!chartContainerRef.current || isInitialized) return;

    try {
      const startTime = performance.now();
      
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

      // 设置优化的时间轴配置
      if (instance.chart) {
        instance.chart.applyOptions({
          timeScale: {
            barSpacing: Math.max(4, Math.min(20, width / 200)), // 动态调整柱间距
            minBarSpacing: 2,
            rightOffset: 10,
            fixLeftEdge: true,
          },
        });
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

        // 优化的双击重置视图
        let lastClickTime = 0;
        instance.chart.subscribeCrosshairMove((param) => {
          if (param && param.time) {
            const now = Date.now();
            if (lastClickTime && (now - lastClickTime < 300)) {
              instance.chart.timeScale().resetTimeScale();
            }
            lastClickTime = now;
          }
        });
      }

      const endTime = performance.now();
      const initTime = endTime - startTime;
      
      // 记录初始化性能
      if (layoutManagerRef.current) {
        layoutManagerRef.current['performanceMonitor']?.recordMetric('renderTime', initTime);
      }

    } catch (err) {
      console.error('Failed to initialize chart:', err);
    }
  }, [width, height, theme, isInitialized, data, onCrosshairMove, onChartClick]);

  // 优化的数据更新
  const updateChart = useCallback(() => {
    if (!chartInstanceRef.current || !data.length) return;

    try {
      const startTime = performance.now();
      
      const config = { ...defaultPerformanceConfig, ...performanceConfig };
      
      // 使用虚拟化数据
      let effectiveData = data;
      if (layoutManagerRef.current) {
        effectiveData = layoutManagerRef.current['virtualizationManager']?.getVisibleData() || data;
      }
      
      updateChartData(chartInstanceRef.current, effectiveData, config, showVolume);
      
      // 优化的布局更新
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
            layoutManagerRef.current?.addIndicatorToLayout(
              chartInstanceRef.current!,
              type,
              indicators,
              indicatorConfig
            );
          });
        }
      }
      
      // 触发数据更新回调
      onDataUpdate?.(effectiveData);
      
      const endTime = performance.now();
      const updateTime = endTime - startTime;
      
      // 记录更新性能
      if (layoutManagerRef.current) {
        layoutManagerRef.current['performanceMonitor']?.recordMetric('dataProcessingTime', updateTime);
      }

    } catch (err) {
      console.error('Failed to update chart data:', err);
    }
  }, [data, indicators, performanceConfig, showVolume, visibleIndicators, height, onDataUpdate]);

  // 优化的调整大小
  const handleResize = useCallback(() => {
    if (!chartInstanceRef.current) return;
    
    try {
      const startTime = performance.now();
      
      resizeChart(chartInstanceRef.current, width, height);
      
      // 更新布局
      if (layoutManagerRef.current) {
        const visibleIndicatorTypes = Object.entries(visibleIndicators)
          .filter(([, visible]) => visible)
          .map(([type]) => type as 'ma' | 'macd' | 'rsi');
        
        layoutManagerRef.current.updateLayout(visibleIndicatorTypes, height);
      }
      
      const endTime = performance.now();
      const resizeTime = endTime - startTime;
      
      // 记录调整大小性能
      if (layoutManagerRef.current) {
        layoutManagerRef.current['performanceMonitor']?.recordMetric('renderTime', resizeTime);
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

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    const scrollPosition = window.scrollY;
    scrollPositionRef.current = scrollPosition;
    
    if (layoutManagerRef.current) {
      layoutManagerRef.current.handleScroll(scrollPosition);
    }
  }, []);

  // 处理技术指标可见性变化
  useEffect(() => {
    if (!chartInstanceRef.current || !isInitialized) return;

    try {
      const visibleIndicatorTypes = Object.entries(visibleIndicators)
        .filter(([, visible]) => visible)
        .map(([type]) => type as 'ma' | 'macd' | 'rsi');

      // 优化的布局更新
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

  // 性能监控
  useEffect(() => {
    if (!layoutManagerRef.current || !isInitialized) return;

    const interval = setInterval(() => {
      if (layoutManagerRef.current) {
        const metrics = layoutManagerRef.current.getPerformanceMetrics();
        setPerformanceMetrics(metrics as any);
        onPerformanceMetrics?.(metrics as any);
        
        // 自动性能优化
        layoutManagerRef.current.optimizePerformance();
      }
    }, 5000); // 每5秒检查一次性能

    return () => clearInterval(interval);
  }, [isInitialized, onPerformanceMetrics]);

  // 设置ResizeObserver
  useEffect(() => {
    if (!chartContainerRef.current) return;

    resizeObserverRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // 触发重新调整大小
        if (chartInstanceRef.current) {
          handleResize();
        }
      }
    });

    resizeObserverRef.current.observe(chartContainerRef.current);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [handleResize]);

  // 设置滚动监听
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // 处理防抖滚动
  useEffect(() => {
    if (layoutManagerRef.current) {
      layoutManagerRef.current.handleScroll(debouncedScrollPosition);
    }
  }, [debouncedScrollPosition]);

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
    <div className={cn('relative', className)}>
      {/* 图表容器 */}
      <div
        ref={chartContainerRef}
        className={cn(
          'relative w-full h-full',
          'optimized-multi-indicator-chart-container',
          'transition-all duration-200'
        )}
        data-theme={theme}
        data-layout-mode={layoutConfig.layoutMode || 'overlay'}
        data-optimized="true"
      >
        {/* 加载状态 */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">优化加载中...</p>
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

      {/* 性能指标显示（开发模式） */}
      {process.env.NODE_ENV === 'development' && performanceMetrics && (
        <div className="absolute top-2 right-2 bg-black/80 text-white p-2 rounded text-xs font-mono">
          <div>渲染: {performanceMetrics.renderTime.toFixed(1)}ms</div>
          <div>内存: {(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
          <div>缓存: {((performanceMetrics.cacheHitRate || 0) * 100).toFixed(0)}%</div>
          <div>指标: {performanceMetrics.visibleIndicators}/{performanceMetrics.totalIndicators}</div>
        </div>
      )}
    </div>
  );
};

OptimizedMultiIndicatorKLineChart.displayName = 'OptimizedMultiIndicatorKLineChart';