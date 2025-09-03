import React, { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { getDefaultConfig } from './technical-indicator-defaults';

export interface IndicatorConfig {
  /** 移动平均线配置 */
  ma?: {
    /** 是否启用 */
    enabled: boolean;
    /** 周期设置 */
    periods: number[];
    /** 颜色设置 */
    colors: string[];
  };
  /** MACD配置 */
  macd?: {
    /** 是否启用 */
    enabled: boolean;
    /** 快线周期 */
    fastPeriod: number;
    /** 慢线周期 */
    slowPeriod: number;
    /** 信号线周期 */
    signalPeriod: number;
    /** 颜色设置 */
    colors: {
      macd: string;
      signal: string;
      histogram: string;
    };
  };
  /** RSI配置 */
  rsi?: {
    /** 是否启用 */
    enabled: boolean;
    /** 周期设置 */
    periods: number[];
    /** 超买线 */
    overbought: number;
    /** 超卖线 */
    oversold: number;
    /** 颜色设置 */
    colors: string[];
  };
}

export interface TechnicalIndicatorConfigProps {
  /** 当前配置 */
  config: IndicatorConfig;
  /** 配置变更回调 */
  onConfigChange: (config: IndicatorConfig) => void;
  /** 是否显示重置按钮 */
  showReset?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 技术指标参数配置界面
 */
export const TechnicalIndicatorConfig: React.FC<TechnicalIndicatorConfigProps> = ({
  config,
  onConfigChange,
  showReset = true,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<'ma' | 'macd' | 'rsi'>('ma');

  // 更新配置
  const updateConfig = useCallback((newConfig: Partial<IndicatorConfig>) => {
    onConfigChange({ ...config, ...newConfig });
  }, [config, onConfigChange]);

  // 重置配置
  const resetConfig = useCallback(() => {
    onConfigChange(getDefaultConfig());
  }, [onConfigChange]);

  // 处理MA配置变更
  const handleMaChange = useCallback((maConfig: Partial<IndicatorConfig['ma']>) => {
    const defaultMaConfig = {
      enabled: false,
      periods: [5, 10, 20],
      colors: ['#ff9800', '#4caf50', '#2196f3']
    };
    updateConfig({ ma: { ...defaultMaConfig, ...config.ma, ...maConfig } });
  }, [config.ma, updateConfig]);

  // 处理MACD配置变更
  const handleMacdChange = useCallback((macdConfig: Partial<IndicatorConfig['macd']>) => {
    const defaultMacdConfig = {
      enabled: false,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      colors: { macd: '#2196f3', signal: '#ff9800', histogram: '#4caf50' }
    };
    updateConfig({ macd: { ...defaultMacdConfig, ...config.macd, ...macdConfig } });
  }, [config.macd, updateConfig]);

  // 处理RSI配置变更
  const handleRsiChange = useCallback((rsiConfig: Partial<IndicatorConfig['rsi']>) => {
    const defaultRsiConfig = {
      enabled: false,
      periods: [6, 14],
      overbought: 70,
      oversold: 30,
      colors: ['#f44336', '#9c27b0']
    };
    updateConfig({ rsi: { ...defaultRsiConfig, ...config.rsi, ...rsiConfig } });
  }, [config.rsi, updateConfig]);

  return (
    <div className={cn('bg-card border rounded-lg shadow-sm', className)}>
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">技术指标配置</h3>
        <p className="text-sm text-muted-foreground mt-1">
          自定义技术指标的参数和显示样式
        </p>
      </div>

      {/* 标签页导航 */}
      <div className="border-b">
        <nav className="flex space-x-1 p-1">
          {[
            { key: 'ma', label: '移动平均线' },
            { key: 'macd', label: 'MACD' },
            { key: 'rsi', label: 'RSI' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as 'ma' | 'macd' | 'rsi')}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                activeTab === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* 配置内容 */}
      <div className="p-4 space-y-4">
        {activeTab === 'ma' && (
          <MAConfigPanel
            config={config.ma}
            onChange={handleMaChange}
          />
        )}
        {activeTab === 'macd' && (
          <MACDConfigPanel
            config={config.macd}
            onChange={handleMacdChange}
          />
        )}
        {activeTab === 'rsi' && (
          <RSIConfigPanel
            config={config.rsi}
            onChange={handleRsiChange}
          />
        )}
      </div>

      {/* 操作按钮 */}
      {showReset && (
        <div className="p-4 border-t bg-muted/50">
          <button
            onClick={resetConfig}
            className="px-4 py-2 text-sm font-medium text-destructive hover:text-destructive/90 transition-colors"
          >
            重置为默认配置
          </button>
        </div>
      )}
    </div>
  );
};

// MA配置面板
interface MAConfigPanelProps {
  config: IndicatorConfig['ma'];
  onChange: (config: Partial<IndicatorConfig['ma']>) => void;
}

const MAConfigPanel: React.FC<MAConfigPanelProps> = ({ config, onChange }) => {
  const handleEnabledChange = (enabled: boolean) => {
    onChange({ enabled });
  };

  const handlePeriodChange = (index: number, value: number) => {
    if (!config?.periods) return;
    const newPeriods = [...config.periods];
    newPeriods[index] = value;
    onChange({ periods: newPeriods });
  };

  const handleColorChange = (index: number, color: string) => {
    if (!config?.colors) return;
    const newColors = [...config.colors];
    newColors[index] = color;
    onChange({ colors: newColors });
  };

  const addPeriod = () => {
    const newPeriods = [...(config?.periods || []), 30];
    const newColors = [...(config?.colors || []), '#6366f1'];
    onChange({ periods: newPeriods, colors: newColors });
  };

  const removePeriod = (index: number) => {
    if (!config?.periods || config.periods.length <= 1) return;
    const newPeriods = config.periods.filter((_, i) => i !== index);
    const newColors = config.colors?.filter((_, i) => i !== index);
    onChange({ periods: newPeriods, colors: newColors });
  };

  return (
    <div className="space-y-4">
      {/* 启用开关 */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">启用移动平均线</label>
        <input
          type="checkbox"
          checked={config?.enabled || false}
          onChange={(e) => handleEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
      </div>

      {config?.enabled && (
        <>
          {/* 周期设置 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">周期设置</label>
            <div className="space-y-2">
              {config?.periods?.map((period, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="number"
                    min="2"
                    max="200"
                    value={period}
                    onChange={(e) => handlePeriodChange(index, parseInt(e.target.value) || 5)}
                    className="w-20 px-2 py-1 border rounded text-sm"
                  />
                  <input
                    type="color"
                    value={config?.colors?.[index] || '#6366f1'}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    className="w-8 h-8 border rounded cursor-pointer"
                  />
                  {config.periods.length > 1 && (
                    <button
                      onClick={() => removePeriod(index)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addPeriod}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + 添加周期
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// MACD配置面板
interface MACDConfigPanelProps {
  config: IndicatorConfig['macd'];
  onChange: (config: Partial<IndicatorConfig['macd']>) => void;
}

const MACDConfigPanel: React.FC<MACDConfigPanelProps> = ({ config, onChange }) => {
  const handleEnabledChange = (enabled: boolean) => {
    onChange({ enabled });
  };

  return (
    <div className="space-y-4">
      {/* 启用开关 */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">启用MACD</label>
        <input
          type="checkbox"
          checked={config?.enabled || false}
          onChange={(e) => handleEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
      </div>

      {config?.enabled && (
        <>
          {/* 周期设置 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">快线周期</label>
              <input
                type="number"
                min="2"
                max="50"
                value={config?.fastPeriod || 12}
                onChange={(e) => onChange({ fastPeriod: parseInt(e.target.value) || 12 })}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">慢线周期</label>
              <input
                type="number"
                min="2"
                max="100"
                value={config?.slowPeriod || 26}
                onChange={(e) => onChange({ slowPeriod: parseInt(e.target.value) || 26 })}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">信号线周期</label>
              <input
                type="number"
                min="2"
                max="50"
                value={config?.signalPeriod || 9}
                onChange={(e) => onChange({ signalPeriod: parseInt(e.target.value) || 9 })}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>

          {/* 颜色设置 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">颜色设置</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs">MACD线</label>
                <input
                  type="color"
                  value={config?.colors?.macd || '#2196f3'}
                  onChange={(e) => onChange({ 
                    colors: { ...config?.colors, macd: e.target.value } 
                  })}
                  className="w-8 h-8 border rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs">信号线</label>
                <input
                  type="color"
                  value={config?.colors?.signal || '#ff9800'}
                  onChange={(e) => onChange({ 
                    colors: { ...config?.colors, signal: e.target.value } 
                  })}
                  className="w-8 h-8 border rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs">柱状图</label>
                <input
                  type="color"
                  value={config?.colors?.histogram || '#4caf50'}
                  onChange={(e) => onChange({ 
                    colors: { ...config?.colors, histogram: e.target.value } 
                  })}
                  className="w-8 h-8 border rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// RSI配置面板
interface RSIConfigPanelProps {
  config: IndicatorConfig['rsi'];
  onChange: (config: Partial<IndicatorConfig['rsi']>) => void;
}

const RSIConfigPanel: React.FC<RSIConfigPanelProps> = ({ config, onChange }) => {
  const handleEnabledChange = (enabled: boolean) => {
    onChange({ enabled });
  };

  const handlePeriodChange = (index: number, value: number) => {
    if (!config?.periods) return;
    const newPeriods = [...config.periods];
    newPeriods[index] = value;
    onChange({ periods: newPeriods });
  };

  const handleColorChange = (index: number, color: string) => {
    if (!config?.colors) return;
    const newColors = [...config.colors];
    newColors[index] = color;
    onChange({ colors: newColors });
  };

  const addPeriod = () => {
    const newPeriods = [...(config?.periods || []), 14];
    const newColors = [...(config?.colors || []), '#6366f1'];
    onChange({ periods: newPeriods, colors: newColors });
  };

  const removePeriod = (index: number) => {
    if (!config?.periods || config.periods.length <= 1) return;
    const newPeriods = config.periods.filter((_, i) => i !== index);
    const newColors = config.colors?.filter((_, i) => i !== index);
    onChange({ periods: newPeriods, colors: newColors });
  };

  return (
    <div className="space-y-4">
      {/* 启用开关 */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">启用RSI</label>
        <input
          type="checkbox"
          checked={config?.enabled || false}
          onChange={(e) => handleEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
      </div>

      {config?.enabled && (
        <>
          {/* 周期设置 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">周期设置</label>
            <div className="space-y-2">
              {config?.periods?.map((period, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="number"
                    min="2"
                    max="100"
                    value={period}
                    onChange={(e) => handlePeriodChange(index, parseInt(e.target.value) || 14)}
                    className="w-20 px-2 py-1 border rounded text-sm"
                  />
                  <input
                    type="color"
                    value={config?.colors?.[index] || '#6366f1'}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    className="w-8 h-8 border rounded cursor-pointer"
                  />
                  {config.periods.length > 1 && (
                    <button
                      onClick={() => removePeriod(index)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addPeriod}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + 添加周期
            </button>
          </div>

          {/* 超买超卖设置 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">超买线</label>
              <input
                type="number"
                min="50"
                max="100"
                value={config?.overbought || 70}
                onChange={(e) => onChange({ overbought: parseInt(e.target.value) || 70 })}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">超卖线</label>
              <input
                type="number"
                min="0"
                max="50"
                value={config?.oversold || 30}
                onChange={(e) => onChange({ oversold: parseInt(e.target.value) || 30 })}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};


TechnicalIndicatorConfig.displayName = 'TechnicalIndicatorConfig';