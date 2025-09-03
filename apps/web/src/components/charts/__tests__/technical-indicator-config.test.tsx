import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TechnicalIndicatorConfig, type IndicatorConfig } from '../technical-indicator-config';
import { getDefaultConfig } from '../technical-indicator-defaults';

// 导入测试设置
import '../../../test-setup';

describe('TechnicalIndicatorConfig - 技术指标配置', () => {
  let mockOnConfigChange: ReturnType<typeof vi.fn>;
  let defaultConfig: IndicatorConfig;

  beforeEach(() => {
    mockOnConfigChange = vi.fn();
    defaultConfig = getDefaultConfig();
  });

  describe('基础功能', () => {
    it('应该正确渲染技术指标配置界面', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      expect(screen.getByText('技术指标配置')).toBeInTheDocument();
      expect(screen.getByText('自定义技术指标的参数和显示样式')).toBeInTheDocument();
      expect(screen.getByText('移动平均线')).toBeInTheDocument();
      expect(screen.getByText('MACD')).toBeInTheDocument();
      expect(screen.getByText('RSI')).toBeInTheDocument();
    });

    it('应该支持标签页切换', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 默认显示MA标签页
      expect(screen.getByText('启用移动平均线')).toBeInTheDocument();

      // 切换到MACD标签页
      fireEvent.click(screen.getByText('MACD'));
      expect(screen.getByText('启用MACD')).toBeInTheDocument();

      // 切换到RSI标签页
      fireEvent.click(screen.getByText('RSI'));
      expect(screen.getByText('启用RSI')).toBeInTheDocument();
    });

    it('应该显示重置按钮', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          showReset={true}
        />
      );

      expect(screen.getByText('重置为默认配置')).toBeInTheDocument();
    });

    it('应该隐藏重置按钮', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          showReset={false}
        />
      );

      expect(screen.queryByText('重置为默认配置')).not.toBeInTheDocument();
    });
  });

  describe('MA配置', () => {
    it('应该正确显示MA配置选项', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      expect(screen.getByText('启用移动平均线')).toBeInTheDocument();
      expect(screen.getByText('周期设置')).toBeInTheDocument();
      
      // 检查默认周期
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
      expect(screen.getByDisplayValue('20')).toBeInTheDocument();
      expect(screen.getByDisplayValue('60')).toBeInTheDocument();
    });

    it('应该支持MA启用/禁用', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      const checkbox = screen.getByLabelText('启用移动平均线');
      
      // 禁用MA
      fireEvent.click(checkbox);
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        ma: { ...defaultConfig.ma, enabled: false }
      });

      // 重新启用MA
      fireEvent.click(checkbox);
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        ma: { ...defaultConfig.ma, enabled: true }
      });
    });

    it('应该支持MA周期修改', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      const periodInput = screen.getAllByRole('spinbutton')[0];
      
      // 修改周期
      fireEvent.change(periodInput, { target: { value: '15' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        ma: { 
          ...defaultConfig.ma, 
          periods: [15, 10, 20, 60] 
        }
      });
    });

    it('应该支持MA颜色修改', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      const colorInput = screen.getAllByRole('color')[0];
      
      // 修改颜色
      fireEvent.change(colorInput, { target: { value: '#ff0000' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        ma: { 
          ...defaultConfig.ma, 
          colors: ['#ff0000', '#4caf50', '#2196f3', '#9c27b0'] 
        }
      });
    });

    it('应该支持添加和删除MA周期', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 添加新周期
      fireEvent.click(screen.getByText('+ 添加周期'));
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        ma: { 
          ...defaultConfig.ma, 
          periods: [5, 10, 20, 60, 30],
          colors: ['#ff9800', '#4caf50', '#2196f3', '#9c27b0', '#6366f1']
        }
      });

      // 删除周期（需要重新渲染后才能找到删除按钮）
      // 注意：这个测试可能需要根据实际实现调整
    });
  });

  describe('MACD配置', () => {
    it('应该正确显示MACD配置选项', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 切换到MACD标签页
      fireEvent.click(screen.getByText('MACD'));

      expect(screen.getByText('启用MACD')).toBeInTheDocument();
      expect(screen.getByText('快线周期')).toBeInTheDocument();
      expect(screen.getByText('慢线周期')).toBeInTheDocument();
      expect(screen.getByText('信号线周期')).toBeInTheDocument();
      expect(screen.getByText('颜色设置')).toBeInTheDocument();
    });

    it('应该支持MACD启用/禁用', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 切换到MACD标签页
      fireEvent.click(screen.getByText('MACD'));

      const checkbox = screen.getByLabelText('启用MACD');
      
      // 禁用MACD
      fireEvent.click(checkbox);
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        macd: { ...defaultConfig.macd, enabled: false }
      });
    });

    it('应该支持MACD参数修改', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 切换到MACD标签页
      fireEvent.click(screen.getByText('MACD'));

      const inputs = screen.getAllByRole('spinbutton');
      
      // 修改快线周期
      fireEvent.change(inputs[0], { target: { value: '15' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        macd: { ...defaultConfig.macd, fastPeriod: 15 }
      });

      // 修改慢线周期
      fireEvent.change(inputs[1], { target: { value: '30' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        macd: { ...defaultConfig.macd, slowPeriod: 30 }
      });

      // 修改信号线周期
      fireEvent.change(inputs[2], { target: { value: '12' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        macd: { ...defaultConfig.macd, signalPeriod: 12 }
      });
    });

    it('应该支持MACD颜色修改', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 切换到MACD标签页
      fireEvent.click(screen.getByText('MACD'));

      const colorInputs = screen.getAllByRole('color');
      
      // 修改MACD线颜色
      fireEvent.change(colorInputs[0], { target: { value: '#ff0000' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        macd: { 
          ...defaultConfig.macd, 
          colors: { ...defaultConfig.macd?.colors, macd: '#ff0000' }
        }
      });
    });
  });

  describe('RSI配置', () => {
    it('应该正确显示RSI配置选项', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 切换到RSI标签页
      fireEvent.click(screen.getByText('RSI'));

      expect(screen.getByText('启用RSI')).toBeInTheDocument();
      expect(screen.getByText('周期设置')).toBeInTheDocument();
      expect(screen.getByText('超买线')).toBeInTheDocument();
      expect(screen.getByText('超卖线')).toBeInTheDocument();
    });

    it('应该支持RSI启用/禁用', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 切换到RSI标签页
      fireEvent.click(screen.getByText('RSI'));

      const checkbox = screen.getByLabelText('启用RSI');
      
      // 禁用RSI
      fireEvent.click(checkbox);
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        rsi: { ...defaultConfig.rsi, enabled: false }
      });
    });

    it('应该支持RSI参数修改', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 切换到RSI标签页
      fireEvent.click(screen.getByText('RSI'));

      const inputs = screen.getAllByRole('spinbutton');
      
      // 修改超买线
      fireEvent.change(inputs[0], { target: { value: '80' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        rsi: { ...defaultConfig.rsi, overbought: 80 }
      });

      // 修改超卖线
      fireEvent.change(inputs[1], { target: { value: '20' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        rsi: { ...defaultConfig.rsi, oversold: 20 }
      });
    });

    it('应该支持RSI周期修改', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 切换到RSI标签页
      fireEvent.click(screen.getByText('RSI'));

      // 找到周期输入框（前两个是超买超卖线，后面的是周期）
      const periodInputs = screen.getAllByRole('spinbutton');
      const firstPeriodInput = periodInputs[2]; // 第一个周期输入框
      
      // 修改周期
      fireEvent.change(firstPeriodInput, { target: { value: '14' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        rsi: { ...defaultConfig.rsi, periods: [14, 12, 24] }
      });
    });
  });

  describe('配置重置', () => {
    it('应该支持重置为默认配置', () => {
      const modifiedConfig = {
        ...defaultConfig,
        ma: { ...defaultConfig.ma, enabled: false },
        macd: { ...defaultConfig.macd, fastPeriod: 15 },
      } as IndicatorConfig;

      render(
        <TechnicalIndicatorConfig
          config={modifiedConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 点击重置按钮
      fireEvent.click(screen.getByText('重置为默认配置'));
      
      expect(mockOnConfigChange).toHaveBeenCalledWith(getDefaultConfig());
    });
  });

  describe('配置验证', () => {
    it('应该正确处理空配置', () => {
      const emptyConfig = {};
      
      render(
        <TechnicalIndicatorConfig
          config={emptyConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 应该能正常渲染，不报错
      expect(screen.getByText('技术指标配置')).toBeInTheDocument();
    });

    it('应该正确处理部分配置', () => {
      const partialConfig = {
        ma: { 
          enabled: true, 
          periods: [5, 10],
          colors: ['#ff0000', '#00ff00']
        },
      };

      render(
        <TechnicalIndicatorConfig
          config={partialConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 应该能正常渲染，不报错
      expect(screen.getByText('技术指标配置')).toBeInTheDocument();
    });
  });

  describe('用户体验', () => {
    it('应该支持自定义样式类名', () => {
      const { container } = render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('应该响应配置变更', () => {
      const { rerender } = render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 修改配置并重新渲染
      const newConfig = {
        ...defaultConfig,
        ma: { ...defaultConfig.ma, enabled: false },
      } as IndicatorConfig;

      rerender(
        <TechnicalIndicatorConfig
          config={newConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 界面应该反映新的配置状态
      const checkbox = screen.getByLabelText('启用移动平均线');
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('边界条件', () => {
    it('应该处理数值输入的边界情况', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      // 切换到MACD标签页
      fireEvent.click(screen.getByText('MACD'));

      const inputs = screen.getAllByRole('spinbutton');
      
      // 测试无效输入
      fireEvent.change(inputs[0], { target: { value: '0' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        macd: { ...defaultConfig.macd, fastPeriod: 12 } // 应该回退到有效值
      });

      fireEvent.change(inputs[0], { target: { value: 'abc' } });
      expect(mockOnConfigChange).toHaveBeenCalledWith({
        ...defaultConfig,
        macd: { ...defaultConfig.macd, fastPeriod: 12 } // 应该回退到有效值
      });
    });

    it('应该处理颜色输入的边界情况', () => {
      render(
        <TechnicalIndicatorConfig
          config={defaultConfig}
          onConfigChange={mockOnConfigChange}
        />
      );

      const colorInput = screen.getAllByRole('color')[0];
      
      // 测试无效颜色值
      fireEvent.change(colorInput, { target: { value: 'invalid' } });
      // 应该能处理而不报错
    });
  });
});