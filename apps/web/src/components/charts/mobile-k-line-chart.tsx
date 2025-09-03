import React, { useEffect, useRef, useMemo } from 'react';
import { KLineChart } from './k-line-chart';
import type { KLineChartProps } from './k-line-chart';
import type { ChartDataPoint } from '../../types/charts';
import { useDevicePerformance, useNetworkStatus } from '../../hooks/use-mobile-detection';
import { 
  mobilePerformanceConfig, 
  lowEndDeviceConfig, 
  getNetworkBasedConfig,
  chartPerformanceOptimizer,
  touchEventOptimizer
} from '../../lib/mobile-performance-optimization';
import { useChartEventConflictResolver } from '../../lib/chart-event-conflict-resolver';
import { cn } from '../../lib/utils';

interface MobileKLineChartProps extends Omit<KLineChartProps, 'width' | 'height'> {
  /** 移动端特定配置 */
  enableTouchGestures?: boolean;
  /** 防止页面滚动冲突 */
  preventPageScroll?: boolean;
  /** 移动端性能优化 */
  optimizedForMobile?: boolean;
  /** 自定义移动端样式 */
  mobileClassName?: string;
}

/**
 * 移动端优化的K线图组件
 * 
 * 专门为移动设备优化的图表组件，包含：
 * - 触摸手势支持（缩放、平移）
 * - 防止页面滚动冲突
 * - 移动端性能优化
 * - 响应式布局适配
 */
export const MobileKLineChart: React.FC<MobileKLineChartProps> = ({
  enableTouchGestures = true,
  preventPageScroll = true,
  optimizedForMobile = true,
  mobileClassName,
  className,
  data,
  onCrosshairMove,
  onChartClick,
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isLowEndDevice, shouldReduceMotion } = useDevicePerformance();
  const { isSlowConnection, isOnline } = useNetworkStatus();
  
  // 图表事件冲突解决器
  const { lockInteraction, unlockInteraction } = useChartEventConflictResolver(
    containerRef as React.RefObject<HTMLElement>,
    preventPageScroll ? { current: document.body } : undefined
  );

  // 根据设备性能和网络条件计算性能配置
  const performanceConfig = useMemo(() => {
    if (!optimizedForMobile) return undefined;
    
    if (isLowEndDevice) {
      return lowEndDeviceConfig;
    }
    
    if (isSlowConnection) {
      return getNetworkBasedConfig();
    }
    
    return mobilePerformanceConfig;
  }, [optimizedForMobile, isLowEndDevice, isSlowConnection]);
  
  // 计算移动端适配的尺寸
  const getMobileDimensions = () => {
    if (!containerRef.current) {
      return { width: 375, height: 300 }; // 默认iPhone尺寸
    }
    
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // 根据屏幕尺寸计算合适的图表高度
    const aspectRatio = window.innerWidth < 768 ? 0.8 : 0.6;
    const calculatedHeight = Math.max(300, containerWidth * aspectRatio);
    
    return {
      width: containerWidth,
      height: Math.min(calculatedHeight, containerHeight)
    };
  };

  const [dimensions, setDimensions] = React.useState(getMobileDimensions());

  // 监听屏幕尺寸变化
  useEffect(() => {
    const handleResize = () => {
      setDimensions(getMobileDimensions());
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // 监听屏幕旋转
    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 处理触摸事件，防止页面滚动
  useEffect(() => {
    if (!preventPageScroll || !containerRef.current) return;

    const container = containerRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      const shouldHandle = touchEventOptimizer.handleTouchStart(e);
      if (shouldHandle && e.touches.length >= 2) {
        lockInteraction();
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const { preventDefault } = touchEventOptimizer.handleTouchMove(e);
      if (preventDefault) {
        lockInteraction();
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      touchEventOptimizer.handleTouchEnd();
      unlockInteraction();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [preventPageScroll, lockInteraction, unlockInteraction]);

  // 优化后的数据
  const optimizedData = useMemo(() => {
    if (!optimizedForMobile || !data.length) return data;
    
    // 使用性能优化器进行数据采样
    const maxPoints = performanceConfig?.maxDataPoints || 500;
    return chartPerformanceOptimizer.sampleData(data, maxPoints);
  }, [data, optimizedForMobile, performanceConfig]);

  // 图表交互回调
  const handleCrosshairMove = React.useCallback((dataPoint: ChartDataPoint | null) => {
    lockInteraction();
    onCrosshairMove?.(dataPoint);
  }, [onCrosshairMove, lockInteraction]);

  const handleChartClick = React.useCallback((dataPoint: ChartDataPoint | null) => {
    lockInteraction();
    onChartClick?.(dataPoint);
    // 短暂延迟后解锁，允许页面滚动
    setTimeout(unlockInteraction, 100);
  }, [onChartClick, lockInteraction, unlockInteraction]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full touch-none',
        'mobile-chart-container',
        mobileClassName,
        className
      )}
      data-mobile-optimized={optimizedForMobile}
      data-touch-gestures={enableTouchGestures}
    >
      <KLineChart
        {...props}
        data={optimizedData}
        width={dimensions.width}
        height={dimensions.height}
        performanceConfig={performanceConfig}
        onCrosshairMove={handleCrosshairMove}
        onChartClick={handleChartClick}
        className={cn(
          'touch-manipulation',
          optimizedForMobile && 'mobile-optimized',
          shouldReduceMotion && 'reduce-motion'
        )}
      />
      
      {/* 网络状态指示器 */}
      {!isOnline && (
        <div className="absolute top-2 left-2 text-xs text-destructive bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
          网络连接已断开
        </div>
      )}
      
      {isOnline && isSlowConnection && (
        <div className="absolute top-2 left-2 text-xs text-warning bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
          网络连接较慢
        </div>
      )}

      {/* 设备性能指示器 */}
      {isLowEndDevice && (
        <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
          性能优化模式
        </div>
      )}

      {/* 移动端操作提示 */}
      {enableTouchGestures && (
        <div className="absolute bottom-2 left-2 right-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg text-center">
          <div className="flex items-center justify-center space-x-4">
            <span>👆 单指查看详情</span>
            <span>✌️ 双指缩放</span>
            <span>👆👆 双击重置</span>
          </div>
        </div>
      )}
    </div>
  );
};

MobileKLineChart.displayName = 'MobileKLineChart';

// 导出接口类型
export type { MobileKLineChartProps };