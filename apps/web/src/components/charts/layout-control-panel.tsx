import React, { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import type { MultiIndicatorLayoutConfig } from '../../lib/multi-indicator-layout-manager';

interface LayoutControlPanelProps {
  /** 当前布局配置 */
  layoutConfig: MultiIndicatorLayoutConfig;
  /** 布局配置变化回调 */
  onLayoutChange: (config: MultiIndicatorLayoutConfig) => void;
  /** 自定义样式类名 */
  className?: string;
  /** 是否紧凑模式 */
  compact?: boolean;
}

/**
 * 布局控制面板组件
 * 
 * 提供多指标布局模式的控制功能：
 * - 布局模式切换（叠加、堆叠、分割）
 * - 高度分配调整
 * - 指标顺序调整
 * - 最大显示数量控制
 */
export const LayoutControlPanel: React.FC<LayoutControlPanelProps> = ({
  layoutConfig,
  onLayoutChange,
  className,
  compact = false,
}) => {
  const [localConfig, setLocalConfig] = useState(layoutConfig);

  // 更新配置
  const updateConfig = useCallback((updates: Partial<MultiIndicatorLayoutConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onLayoutChange(newConfig);
  }, [localConfig, onLayoutChange]);

  // 布局模式选项
  const layoutModes = [
    { value: 'overlay' as const, label: '叠加模式', description: '指标叠加在主图上' },
    { value: 'stacked' as const, label: '堆叠模式', description: '指标堆叠在主图下方' },
    { value: 'split' as const, label: '分割模式', description: '指标在独立区域显示' },
  ];

  // 处理布局模式切换
  const handleLayoutModeChange = (mode: 'overlay' | 'stacked' | 'split') => {
    updateConfig({ layoutMode: mode });
  };

  // 处理主图高度变化
  const handleMainChartHeightChange = (value: number) => {
    updateConfig({
      heightDistribution: {
        mainChart: value,
        indicators: 1 - value,
      },
    });
  };

  // 处理指标间距变化
  const handleIndicatorSpacingChange = (value: number) => {
    updateConfig({ indicatorSpacing: value });
  };

  // 处理最大显示指标数量变化
  const handleMaxVisibleIndicatorsChange = (value: number) => {
    updateConfig({ maxVisibleIndicators: value });
  };

  // 处理分隔线显示切换
  const handleShowSeparatorsChange = (show: boolean) => {
    updateConfig({ showSeparators: show });
  };

  if (compact) {
    return (
      <div className={cn(
        'flex items-center space-x-2 p-2 bg-background border rounded-lg',
        className
      )}>
        {layoutModes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => handleLayoutModeChange(mode.value)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-all duration-200',
              'hover:bg-muted',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              localConfig.layoutMode === mode.value && 'bg-primary text-primary-foreground'
            )}
            title={mode.description}
          >
            {mode.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-col space-y-4 p-4 bg-background border rounded-lg',
      className
    )}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">布局设置</h3>
        <div className="text-xs text-muted-foreground">
          {localConfig.layoutMode} 模式
        </div>
      </div>
      
      {/* 布局模式选择 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">布局模式</label>
        <div className="grid grid-cols-3 gap-2">
          {layoutModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => handleLayoutModeChange(mode.value)}
              className={cn(
                'flex flex-col items-center p-3 rounded-md border transition-all duration-200',
                'hover:bg-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                localConfig.layoutMode === mode.value && 'border-primary bg-primary/5'
              )}
            >
              <span className="text-sm font-medium">{mode.label}</span>
              <span className="text-xs text-muted-foreground mt-1">
                {mode.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 高度分配控制 */}
      {(localConfig.layoutMode === 'stacked' || localConfig.layoutMode === 'split') && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            主图高度: {Math.round(localConfig.heightDistribution.mainChart * 100)}%
          </label>
          <input
            type="range"
            min="0.3"
            max="0.8"
            step="0.05"
            value={localConfig.heightDistribution.mainChart}
            onChange={(e) => handleMainChartHeightChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>更多指标空间</span>
            <span>更多主图空间</span>
          </div>
        </div>
      )}

      {/* 指标间距控制 */}
      {(localConfig.layoutMode === 'stacked' || localConfig.layoutMode === 'split') && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            指标间距: {localConfig.indicatorSpacing}px
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={localConfig.indicatorSpacing}
            onChange={(e) => handleIndicatorSpacingChange(parseInt(e.target.value))}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          />
        </div>
      )}

      {/* 最大显示指标数量 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          最大显示指标数量: {localConfig.maxVisibleIndicators}
        </label>
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map((count) => (
            <button
              key={count}
              onClick={() => handleMaxVisibleIndicatorsChange(count)}
              className={cn(
                'flex-1 py-1 text-sm rounded-md transition-all duration-200',
                'hover:bg-muted',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                localConfig.maxVisibleIndicators === count && 'bg-primary text-primary-foreground'
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* 显示选项 */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-muted-foreground">显示选项</label>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">显示分隔线</span>
          <button
            onClick={() => handleShowSeparatorsChange(!localConfig.showSeparators)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              localConfig.showSeparators 
                ? 'bg-primary' 
                : 'bg-input'
            )}
            role="switch"
            aria-checked={localConfig.showSeparators}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                'shadow-sm',
                localConfig.showSeparators ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>

      {/* 预设配置 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">快速预设</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateConfig({
              layoutMode: 'overlay',
              heightDistribution: { mainChart: 1, indicators: 0 },
              maxVisibleIndicators: 3,
            })}
            className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            经典叠加
          </button>
          <button
            onClick={() => updateConfig({
              layoutMode: 'stacked',
              heightDistribution: { mainChart: 0.6, indicators: 0.4 },
              maxVisibleIndicators: 2,
            })}
            className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            技术分析
          </button>
          <button
            onClick={() => updateConfig({
              layoutMode: 'split',
              heightDistribution: { mainChart: 0.7, indicators: 0.3 },
              maxVisibleIndicators: 3,
            })}
            className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            专业分割
          </button>
          <button
            onClick={() => updateConfig({
              layoutMode: 'stacked',
              heightDistribution: { mainChart: 0.5, indicators: 0.5 },
              maxVisibleIndicators: 4,
            })}
            className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            指标密集
          </button>
        </div>
      </div>
    </div>
  );
};

LayoutControlPanel.displayName = 'LayoutControlPanel';