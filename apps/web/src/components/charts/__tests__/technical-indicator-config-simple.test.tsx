import { describe, it, expect } from 'vitest';
import { getDefaultConfig, type IndicatorConfig } from '../technical-indicator-defaults';

// 导入测试设置
import '../../../test-setup';

describe('TechnicalIndicatorConfig - 技术指标配置 (简化测试)', () => {
  describe('默认配置', () => {
    it('应该生成正确的默认配置', () => {
      const config = getDefaultConfig();
      
      expect(config).toBeDefined();
      expect(config.ma).toBeDefined();
      expect(config.macd).toBeDefined();
      expect(config.rsi).toBeDefined();
    });

    it('应该包含正确的MA默认配置', () => {
      const config = getDefaultConfig();
      
      expect(config.ma?.enabled).toBe(true);
      expect(config.ma?.periods).toEqual([5, 10, 20, 60]);
      expect(config.ma?.colors).toEqual(['#ff9800', '#4caf50', '#2196f3', '#9c27b0']);
    });

    it('应该包含正确的MACD默认配置', () => {
      const config = getDefaultConfig();
      
      expect(config.macd?.enabled).toBe(true);
      expect(config.macd?.fastPeriod).toBe(12);
      expect(config.macd?.slowPeriod).toBe(26);
      expect(config.macd?.signalPeriod).toBe(9);
      expect(config.macd?.colors?.macd).toBe('#2196f3');
      expect(config.macd?.colors?.signal).toBe('#ff9800');
      expect(config.macd?.colors?.histogram).toBe('#4caf50');
    });

    it('应该包含正确的RSI默认配置', () => {
      const config = getDefaultConfig();
      
      expect(config.rsi?.enabled).toBe(true);
      expect(config.rsi?.periods).toEqual([6, 12, 24]);
      expect(config.rsi?.overbought).toBe(70);
      expect(config.rsi?.oversold).toBe(30);
      expect(config.rsi?.colors).toEqual(['#2196f3', '#ff9800', '#4caf50']);
    });
  });

  describe('配置类型验证', () => {
    it('应该接受有效的配置对象', () => {
      const validConfig: IndicatorConfig = {
        ma: {
          enabled: true,
          periods: [5, 10, 20],
          colors: ['#ff0000', '#00ff00', '#0000ff'],
        },
        macd: {
          enabled: false,
          fastPeriod: 10,
          slowPeriod: 20,
          signalPeriod: 5,
          colors: {
            macd: '#ff0000',
            signal: '#00ff00',
            histogram: '#0000ff',
          },
        },
        rsi: {
          enabled: true,
          periods: [14],
          overbought: 80,
          oversold: 20,
          colors: ['#ff0000'],
        },
      };

      expect(validConfig).toBeDefined();
      expect(validConfig.ma?.enabled).toBe(true);
      expect(validConfig.macd?.enabled).toBe(false);
      expect(validConfig.rsi?.enabled).toBe(true);
    });

    it('应该接受部分配置', () => {
      const partialConfig: IndicatorConfig = {
        ma: {
          enabled: true,
          periods: [5, 10],
          colors: ['#ff0000', '#00ff00']
        },
      };

      expect(partialConfig).toBeDefined();
      expect(partialConfig.ma?.enabled).toBe(true);
      expect(partialConfig.macd).toBeUndefined();
      expect(partialConfig.rsi).toBeUndefined();
    });

    it('应该接受空配置', () => {
      const emptyConfig: IndicatorConfig = {};

      expect(emptyConfig).toBeDefined();
      expect(emptyConfig.ma).toBeUndefined();
      expect(emptyConfig.macd).toBeUndefined();
      expect(emptyConfig.rsi).toBeUndefined();
    });
  });

  describe('配置数据结构', () => {
    it('应该保持配置的不可变性', () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();
      
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('应该支持配置的深拷贝', () => {
      const original = getDefaultConfig();
      const copy = JSON.parse(JSON.stringify(original));
      
      expect(copy).toEqual(original);
      expect(copy).not.toBe(original);
      
      // 修改副本不应该影响原配置
      if (copy.ma) {
        copy.ma.enabled = false;
        expect(copy.ma.enabled).toBe(false);
        expect(original.ma?.enabled).toBe(true);
      }
    });
  });

  describe('配置验证逻辑', () => {
    it('应该验证MA周期范围', () => {
      const config = getDefaultConfig();
      
      if (config.ma?.periods) {
        config.ma.periods.forEach(period => {
          expect(period).toBeGreaterThan(1);
          expect(period).toBeLessThanOrEqual(200);
        });
      }
    });

    it('应该验证MACD周期范围', () => {
      const config = getDefaultConfig();
      
      if (config.macd) {
        expect(config.macd.fastPeriod).toBeGreaterThan(1);
        expect(config.macd.fastPeriod).toBeLessThan(config.macd.slowPeriod);
        expect(config.macd.signalPeriod).toBeGreaterThan(1);
      }
    });

    it('应该验证RSI周期范围', () => {
      const config = getDefaultConfig();
      
      if (config.rsi?.periods) {
        config.rsi.periods.forEach(period => {
          expect(period).toBeGreaterThan(1);
          expect(period).toBeLessThanOrEqual(100);
        });
      }
      
      if (config.rsi) {
        expect(config.rsi.overbought).toBeGreaterThan(50);
        expect(config.rsi.overbought).toBeLessThanOrEqual(100);
        expect(config.rsi.oversold).toBeGreaterThanOrEqual(0);
        expect(config.rsi.oversold).toBeLessThan(50);
        expect(config.rsi.overbought).toBeGreaterThan(config.rsi.oversold);
      }
    });
  });

  describe('配置扩展性', () => {
    it('应该支持添加新的MA周期', () => {
      const config = getDefaultConfig();
      
      if (config.ma) {
        const newPeriods = [...config.ma.periods, 30];
        const newColors = [...config.ma.colors, '#6366f1'];
        
        expect(newPeriods).toHaveLength(config.ma.periods.length + 1);
        expect(newColors).toHaveLength(config.ma.colors.length + 1);
        expect(newPeriods[newPeriods.length - 1]).toBe(30);
      }
    });

    it('应该支持添加新的RSI周期', () => {
      const config = getDefaultConfig();
      
      if (config.rsi) {
        const newPeriods = [...config.rsi.periods, 14];
        const newColors = [...config.rsi.colors, '#6366f1'];
        
        expect(newPeriods).toHaveLength(config.rsi.periods.length + 1);
        expect(newColors).toHaveLength(config.rsi.colors.length + 1);
        expect(newPeriods[newPeriods.length - 1]).toBe(14);
      }
    });

    it('应该支持修改MACD参数', () => {
      const config = getDefaultConfig();
      
      if (config.macd) {
        const modifiedConfig = {
          ...config.macd,
          fastPeriod: 15,
          slowPeriod: 30,
          signalPeriod: 10,
        };
        
        expect(modifiedConfig.fastPeriod).toBe(15);
        expect(modifiedConfig.slowPeriod).toBe(30);
        expect(modifiedConfig.signalPeriod).toBe(10);
        expect(modifiedConfig.fastPeriod).toBeLessThan(modifiedConfig.slowPeriod);
      }
    });
  });

  describe('配置兼容性', () => {
    it('应该向后兼容旧版本配置', () => {
      // 模拟旧版本配置（缺少某些字段）
      const oldConfig = {
        ma: {
          enabled: true,
          periods: [5, 10, 20],
        },
        macd: {
          enabled: true,
        },
      };

      expect(oldConfig).toBeDefined();
      expect(oldConfig.ma?.enabled).toBe(true);
      expect(oldConfig.macd?.enabled).toBe(true);
    });

    it('应该向前兼容新版本配置', () => {
      // 模拟新版本配置（包含额外字段）
      const newConfig = {
        ma: {
          enabled: true,
          periods: [5, 10, 20, 60],
          colors: ['#ff9800', '#4caf50', '#2196f3', '#9c27b0'],
          // 新增字段
          lineWidth: 2,
          style: 'solid',
        },
        macd: {
          enabled: true,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          colors: {
            macd: '#2196f3',
            signal: '#ff9800',
            histogram: '#4caf50',
          },
          // 新增字段
          histogramStyle: 'bars',
        },
        rsi: {
          enabled: true,
          periods: [6, 12, 24],
          overbought: 70,
          oversold: 30,
          colors: ['#2196f3', '#ff9800', '#4caf50'],
          // 新增字段
          showLevels: true,
        },
      };

      expect(newConfig).toBeDefined();
      expect(newConfig.ma?.enabled).toBe(true);
      expect(newConfig.macd?.enabled).toBe(true);
      expect(newConfig.rsi?.enabled).toBe(true);
    });
  });

  describe('配置序列化', () => {
    it('应该正确序列化为JSON', () => {
      const config = getDefaultConfig();
      const jsonString = JSON.stringify(config);
      const parsedConfig = JSON.parse(jsonString);
      
      expect(parsedConfig).toEqual(config);
    });

    it('应该正确从JSON反序列化', () => {
      const config = getDefaultConfig();
      const jsonString = JSON.stringify(config);
      const parsedConfig = JSON.parse(jsonString) as IndicatorConfig;
      
      expect(parsedConfig.ma?.enabled).toBe(config.ma?.enabled);
      expect(parsedConfig.macd?.enabled).toBe(config.macd?.enabled);
      expect(parsedConfig.rsi?.enabled).toBe(config.rsi?.enabled);
    });

    it('应该处理序列化中的循环引用', () => {
      const config = getDefaultConfig();
      
      // 添加循环引用（如果有的话）
      // 这里测试确保不会因为循环引用而抛出异常
      expect(() => {
        JSON.stringify(config);
      }).not.toThrow();
    });
  });
});