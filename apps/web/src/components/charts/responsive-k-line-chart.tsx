import React, { useEffect, useRef, useState } from 'react';
import { KLineChart } from './k-line-chart';
import type { KLineChartProps } from './k-line-chart';
import { MobileKLineChart } from './mobile-k-line-chart';
import type { MobileKLineChartProps } from './mobile-k-line-chart';
import { useMobileDetection, useDevicePerformance } from '../../hooks/use-mobile-detection';
import { cn } from '../../lib/utils';

interface ResponsiveKLineChartProps extends Omit<KLineChartProps, 'width' | 'height'> {
  /** 移动端特定配置 */
  mobileConfig?: Omit<MobileKLineChartProps, 'width' | 'height'>;
  /** 强制使用移动端组件 */
  forceMobile?: boolean;
  /** 自定义断点 */
  breakpoint?: number;
  /** 响应式配置 */
  responsiveConfig?: {
    /** 小屏幕配置 */
    small?: {
      width?: number;
      height?: number;
      aspectRatio?: number;
    };
    /** 中屏幕配置 */
    medium?: {
      width?: number;
      height?: number;
      aspectRatio?: number;
    };
    /** 大屏幕配置 */
    large?: {
      width?: number;
      height?: number;
      aspectRatio?: number;
    };
  };
  /** 自定义容器类名 */
  containerClassName?: string;
}

/**
 * 响应式K线图组件
 * 
 * 根据设备类型和屏幕尺寸自动选择合适的图表组件：
 * - 桌面端：使用标准KLineChart组件
 * - 移动端：使用MobileKLineChart组件（触摸优化）
 */
export const ResponsiveKLineChart: React.FC<ResponsiveKLineChartProps> = ({
  mobileConfig,
  forceMobile = false,
  breakpoint = 768,
  responsiveConfig,
  containerClassName,
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMobile, isTouchDevice, screenSize } = useMobileDetection();
  const { isLowEndDevice } = useDevicePerformance();
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // 监听容器尺寸变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({
        width: rect.width,
        height: rect.height,
      });
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    // 初始更新
    updateSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 根据屏幕尺寸判断设备类型
  const getDeviceType = () => {
    const width = containerSize.width || screenSize.width;
    
    if (width <= 375) return 'small';
    if (width <= 768) return 'medium';
    return 'large';
  };

  // 判断是否使用移动端组件
  const useMobileComponent = forceMobile || 
                           isMobile || 
                           (isTouchDevice && screenSize.width <= breakpoint);

  // 计算响应式尺寸
  const getResponsiveDimensions = () => {
    if (useMobileComponent) {
      return { width: 0, height: 0 }; // 移动端组件会自己计算
    }

    const deviceType = getDeviceType();
    const config = responsiveConfig?.[deviceType];
    const aspectRatio = config?.aspectRatio || 0.6;
    
    // 基于容器尺寸计算图表尺寸
    const containerWidth = containerSize.width || screenSize.width;
    const containerHeight = containerSize.height || window.innerHeight;
    
    let width = config?.width || containerWidth;
    let height = config?.height || containerHeight;

    // 如果没有明确指定高度，使用宽高比计算
    if (!config?.height && aspectRatio) {
      height = width * aspectRatio;
    }

    // 确保最小尺寸
    width = Math.max(300, width);
    height = Math.max(200, height);

    // 确保不超过容器尺寸
    width = Math.min(width, containerWidth);
    height = Math.min(height, containerHeight);

    return { width, height };
  };

  const dimensions = getResponsiveDimensions();

  // 获取响应式样式
  const getResponsiveStyles = () => {
    const deviceType = getDeviceType();
    
    const baseStyles = "relative w-full h-full";
    
    switch (deviceType) {
      case 'small':
        return cn(baseStyles, "text-xs", containerClassName);
      case 'medium':
        return cn(baseStyles, "text-sm", containerClassName);
      case 'large':
      default:
        return cn(baseStyles, "text-base", containerClassName);
    }
  };

  // 获取响应式配置
  const getMobileConfig = () => {
    const deviceType = getDeviceType();
    const baseConfig = {
      ...mobileConfig,
      optimizedForMobile: isLowEndDevice || deviceType === 'small',
    };

    // 小屏幕设备的特殊配置
    if (deviceType === 'small') {
      return {
        ...baseConfig,
        enableTouchGestures: true,
        preventPageScroll: true,
        showVolume: false, // 小屏幕隐藏成交量以节省空间
      };
    }

    return baseConfig;
  };

  if (useMobileComponent) {
    return (
      <div ref={containerRef} className={getResponsiveStyles()}>
        <MobileKLineChart
          {...props}
          {...getMobileConfig()}
          // 移动端组件会自己计算尺寸，不需要传递width和height
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={getResponsiveStyles()}>
      <KLineChart
        {...props}
        width={dimensions.width}
        height={dimensions.height}
        // 大屏幕设备可以显示更多信息
        showVolume={props.showVolume ?? true}
      />
    </div>
  );
};

ResponsiveKLineChart.displayName = 'ResponsiveKLineChart';

// 导出接口类型
export type { ResponsiveKLineChartProps };