import React, { useState, useCallback } from 'react';
import { KLineChart } from './k-line-chart';
import type { KLineChartProps } from './k-line-chart';
import { TechnicalIndicatorControls } from './technical-indicator-controls';
import { cn } from '../../lib/utils';

interface EnhancedKLineChartProps extends Omit<KLineChartProps, 'visibleIndicators' | 'onIndicatorVisibilityChange'> {
  /** 是否显示技术指标控制面板 */
  showControls?: boolean;
  /** 控制面板位置 */
  controlsPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** 控制面板样式 */
  controlsVariant?: 'full' | 'compact';
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 增强版K线图组件
 * 
 * 集成了技术指标控制面板的K线图组件，提供：
 * - 完整的K线图功能
 * - 技术指标显示/隐藏切换
 * - 可配置的控制面板
 */
export const EnhancedKLineChart: React.FC<EnhancedKLineChartProps> = ({
  showControls = true,
  controlsPosition = 'top-right',
  controlsVariant = 'full',
  className,
  ...props
}) => {
  const [visibleIndicators, setVisibleIndicators] = useState({
    ma: true,
    macd: true,
    rsi: true,
  });

  // 切换技术指标可见性
  const handleToggleIndicator = useCallback((indicatorType: 'ma' | 'macd' | 'rsi') => {
    setVisibleIndicators(prev => ({
      ...prev,
      [indicatorType]: !prev[indicatorType]
    }));
  }, []);

  // 设置技术指标可见性
  const handleSetIndicatorVisible = useCallback((indicatorType: 'ma' | 'macd' | 'rsi', visible: boolean) => {
    setVisibleIndicators(prev => ({
      ...prev,
      [indicatorType]: visible
    }));
  }, []);

  // 技术指标可见性变化回调
  const handleIndicatorVisibilityChange = useCallback((indicators: { ma?: boolean; macd?: boolean; rsi?: boolean }) => {
    setVisibleIndicators(prev => ({
      ...prev,
      ...indicators
    }));
  }, []);

  // 控制面板位置样式
  const getControlsPosition = () => {
    switch (controlsPosition) {
      case 'top-left':
        return 'top-2 left-2';
      case 'top-right':
        return 'top-2 right-2';
      case 'bottom-left':
        return 'bottom-2 left-2';
      case 'bottom-right':
        return 'bottom-2 right-2';
      default:
        return 'top-2 right-2';
    }
  };

  return (
    <div className={cn(
      'relative w-full h-full',
      className
    )}>
      <KLineChart
        {...props}
        visibleIndicators={visibleIndicators}
        onIndicatorVisibilityChange={handleIndicatorVisibilityChange}
        className="w-full h-full"
      />
      
      {/* 技术指标控制面板 */}
      {showControls && (
        <div className={cn(
          'absolute z-10',
          getControlsPosition(),
          controlsVariant === 'compact' ? 'w-fit' : 'w-64'
        )}>
          <TechnicalIndicatorControls
            visibleIndicators={visibleIndicators}
            onToggleIndicator={handleToggleIndicator}
            onSetIndicatorVisible={handleSetIndicatorVisible}
            compact={controlsVariant === 'compact'}
            showLabels={controlsVariant === 'full'}
          />
        </div>
      )}
    </div>
  );
};

EnhancedKLineChart.displayName = 'EnhancedKLineChart';

// 导出接口类型
export type { EnhancedKLineChartProps };