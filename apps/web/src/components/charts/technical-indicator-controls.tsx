import React from 'react';
import { cn } from '../../lib/utils';

interface TechnicalIndicatorControlsProps {
  /** 当前技术指标可见性状态 */
  visibleIndicators: {
    ma?: boolean;
    macd?: boolean;
    rsi?: boolean;
  };
  /** 切换技术指标可见性的回调函数 */
  onToggleIndicator: (indicatorType: 'ma' | 'macd' | 'rsi') => void;
  /** 设置技术指标可见性的回调函数 */
  onSetIndicatorVisible: (indicatorType: 'ma' | 'macd' | 'rsi', visible: boolean) => void;
  /** 技术指标可见性变化回调函数 */
  onIndicatorVisibilityChange?: (indicators: { ma?: boolean; macd?: boolean; rsi?: boolean }) => void;
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示标签 */
  showLabels?: boolean;
  /** 是否紧凑模式 */
  compact?: boolean;
}

/**
 * 技术指标控制面板组件
 * 
 * 提供技术指标的显示/隐藏切换功能，支持：
 * - MA移动平均线
 * - MACD指标
 * - RSI指标
 */
export const TechnicalIndicatorControls: React.FC<TechnicalIndicatorControlsProps> = ({
  visibleIndicators,
  onToggleIndicator,
  onSetIndicatorVisible,
  className,
  showLabels = true,
  compact = false,
}) => {
  const indicatorConfig = [
    {
      type: 'ma' as const,
      label: 'MA',
      description: '移动平均线',
      color: '#ff9800',
      visible: visibleIndicators.ma,
    },
    {
      type: 'macd' as const,
      label: 'MACD',
      description: '指数平滑异同移动平均线',
      color: '#2196f3',
      visible: visibleIndicators.macd,
    },
    {
      type: 'rsi' as const,
      label: 'RSI',
      description: '相对强弱指标',
      color: '#4caf50',
      visible: visibleIndicators.rsi,
    },
  ];

  const handleToggle = (indicatorType: 'ma' | 'macd' | 'rsi') => {
    onToggleIndicator(indicatorType);
  };

  const handleSetVisible = (indicatorType: 'ma' | 'macd' | 'rsi', visible: boolean) => {
    onSetIndicatorVisible(indicatorType, visible);
  };

  if (compact) {
    return (
      <div className={cn(
        'flex items-center space-x-1 p-1 bg-background border rounded-lg',
        className
      )}>
        {indicatorConfig.map((indicator) => (
          <button
            key={indicator.type}
            onClick={() => handleToggle(indicator.type)}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200',
              'hover:bg-muted',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              indicator.visible && 'bg-primary text-primary-foreground'
            )}
            title={indicator.description}
            aria-label={`${indicator.label} ${indicator.visible ? '隐藏' : '显示'}`}
          >
            <span 
              className="text-sm font-medium"
              style={{ color: indicator.visible ? 'inherit' : indicator.color }}
            >
              {indicator.label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-col space-y-2 p-3 bg-background border rounded-lg',
      className
    )}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">技术指标</h3>
        <div className="text-xs text-muted-foreground">
          {Object.values(visibleIndicators).filter(Boolean).length}/3 已启用
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {indicatorConfig.map((indicator) => (
          <div
            key={indicator.type}
            className={cn(
              'flex items-center justify-between p-2 rounded-md transition-colors',
              'hover:bg-muted/50'
            )}
          >
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: indicator.color }}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {indicator.label}
                </span>
                {showLabels && (
                  <span className="text-xs text-muted-foreground">
                    {indicator.description}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleToggle(indicator.type)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  indicator.visible 
                    ? 'bg-primary' 
                    : 'bg-input'
                )}
                role="switch"
                aria-checked={indicator.visible}
                aria-label={`切换${indicator.label}显示`}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    'shadow-sm',
                    indicator.visible ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* 快速操作按钮 */}
      <div className="flex items-center justify-between pt-2 border-t">
        <button
          onClick={() => {
            // 全部显示
            indicatorConfig.forEach(indicator => {
              if (!indicator.visible) {
                handleSetVisible(indicator.type, true);
              }
            });
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          全部显示
        </button>
        <button
          onClick={() => {
            // 全部隐藏
            indicatorConfig.forEach(indicator => {
              if (indicator.visible) {
                handleSetVisible(indicator.type, false);
              }
            });
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          全部隐藏
        </button>
      </div>
    </div>
  );
};

TechnicalIndicatorControls.displayName = 'TechnicalIndicatorControls';