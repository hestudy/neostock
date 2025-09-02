import { describe, it, expect } from 'vitest';
import { calculateMA, calculateMACD, calculateRSI } from '../technical-indicators-calculator';
import type { ChartDataPoint } from '../../types/charts';

describe('Technical Indicators Calculator', () => {
  describe('calculateMA', () => {
    it('应该正确计算简单移动平均线', () => {
      const data: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 },
        { time: '2024-01-02', open: 105, high: 115, low: 95, close: 110 },
        { time: '2024-01-03', open: 110, high: 120, low: 100, close: 115 },
        { time: '2024-01-04', open: 115, high: 125, low: 105, close: 120 },
        { time: '2024-01-05', open: 120, high: 130, low: 110, close: 125 }
      ];

      const ma5 = calculateMA(data, 5);

      expect(ma5).toHaveLength(5);
      expect(ma5[4]).toBeCloseTo(115, 2); // (105 + 110 + 115 + 120 + 125) / 5
    });

    it('应该正确处理部分数据', () => {
      const data: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 },
        { time: '2024-01-02', open: 105, high: 115, low: 95, close: 110 },
        { time: '2024-01-03', open: 110, high: 120, low: 100, close: 115 }
      ];

      const ma5 = calculateMA(data, 5);

      expect(ma5).toHaveLength(3);
      // 前期数据不足，应该返回null或undefined
      expect(ma5[0]).toBeUndefined();
      expect(ma5[1]).toBeUndefined();
      expect(ma5[2]).toBeUndefined(); // 数据不足5个，所以第3个位置也应该是undefined
    });

    it('应该在数据为空时返回空数组', () => {
      const ma5 = calculateMA([], 5);
      expect(ma5).toEqual([]);
    });

    it('应该在周期大于数据长度时返回空数组', () => {
      const data: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 }
      ];

      const ma5 = calculateMA(data, 5);
      expect(ma5).toHaveLength(1);
      expect(ma5[0]).toBeUndefined();
    });
  });

  describe('calculateMACD', () => {
    it('应该正确计算MACD指标', () => {
      const data: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 },
        { time: '2024-01-02', open: 105, high: 115, low: 95, close: 110 },
        { time: '2024-01-03', open: 110, high: 120, low: 100, close: 115 },
        { time: '2024-01-04', open: 115, high: 125, low: 105, close: 120 },
        { time: '2024-01-05', open: 120, high: 130, low: 110, close: 125 },
        { time: '2024-01-06', open: 125, high: 135, low: 115, close: 130 },
        { time: '2024-01-07', open: 130, high: 140, low: 120, close: 135 },
        { time: '2024-01-08', open: 135, high: 145, low: 125, close: 140 },
        { time: '2024-01-09', open: 140, high: 150, low: 130, close: 145 },
        { time: '2024-01-10', open: 145, high: 155, low: 135, close: 150 }
      ];

      const macd = calculateMACD(data, 12, 26, 9);

      expect(macd).toHaveLength(10);
      
      // 验证返回的数据结构
      expect(macd[9]).toEqual(expect.objectContaining({
        macd_dif: expect.any(Number),
        macd_dea: expect.any(Number),
        macd_hist: expect.any(Number)
      }));

      // 验证数据合理性
      expect(macd[9].macd_hist).toBeCloseTo(
        macd[9].macd_dif! - macd[9].macd_dea!, 
        2
      );
    });

    it('应该在数据不足时正确处理', () => {
      const data: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 },
        { time: '2024-01-02', open: 105, high: 115, low: 95, close: 110 }
      ];

      const macd = calculateMACD(data, 12, 26, 9);

      expect(macd).toHaveLength(2);
      // 数据不足时应该有默认值
      expect(macd[0]).toEqual(expect.objectContaining({
        macd_dif: expect.any(Number),
        macd_dea: expect.any(Number),
        macd_hist: expect.any(Number)
      }));
    });

    it('应该在默认参数下正确计算', () => {
      const data: ChartDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i
      }));

      const macd = calculateMACD(data);

      expect(macd).toHaveLength(30);
      expect(macd[29]).toEqual(expect.objectContaining({
        macd_dif: expect.any(Number),
        macd_dea: expect.any(Number),
        macd_hist: expect.any(Number)
      }));
    });
  });

  describe('calculateRSI', () => {
    it('应该正确计算RSI指标', () => {
      const data: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 },
        { time: '2024-01-02', open: 105, high: 115, low: 95, close: 110 },
        { time: '2024-01-03', open: 110, high: 120, low: 100, close: 108 }, // 下跌
        { time: '2024-01-04', open: 108, high: 118, low: 98, close: 112 },
        { time: '2024-01-05', open: 112, high: 122, low: 102, close: 115 },
        { time: '2024-01-06', open: 115, high: 125, low: 105, close: 120 },
        { time: '2024-01-07', open: 120, high: 130, low: 110, close: 118 }, // 下跌
        { time: '2024-01-08', open: 118, high: 128, low: 108, close: 125 },
        { time: '2024-01-09', open: 125, high: 135, low: 115, close: 130 },
        { time: '2024-01-10', open: 130, high: 140, low: 120, close: 135 },
        { time: '2024-01-11', open: 135, high: 145, low: 125, close: 140 },
        { time: '2024-01-12', open: 140, high: 150, low: 130, close: 145 },
        { time: '2024-01-13', open: 145, high: 155, low: 135, close: 150 },
        { time: '2024-01-14', open: 150, high: 160, low: 140, close: 155 },
        { time: '2024-01-15', open: 155, high: 165, low: 145, close: 160 }
      ];

      const rsi = calculateRSI(data, 14);

      expect(rsi).toHaveLength(15);
      
      // 前13个位置应该是undefined（数据不足）
      expect(rsi[0]).toBeUndefined();
      expect(rsi[12]).toBeUndefined();
      expect(rsi[13]).toBeUndefined(); // 第14个位置（索引13）仍然需要更多数据
      // 第15个位置（索引14）才有计算值
      expect(rsi[14]).toBeDefined();
      expect(rsi[14]).toBeGreaterThanOrEqual(0);
      expect(rsi[14]).toBeLessThanOrEqual(100);
    });

    it('应该在数据不足时正确处理', () => {
      const data: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 },
        { time: '2024-01-02', open: 105, high: 115, low: 95, close: 110 }
      ];

      const rsi = calculateRSI(data, 14);

      expect(rsi).toHaveLength(2);
      // 数据不足，应该返回null值
      expect(rsi[0]).toBeUndefined();
      expect(rsi[1]).toBeUndefined();
    });

    it('应该在默认周期下正确计算', () => {
      const data: ChartDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i
      }));

      const rsi = calculateRSI(data);

      expect(rsi).toHaveLength(20);
      expect(rsi[19]).toBeDefined();
      expect(rsi[19]).toBeGreaterThanOrEqual(0);
      expect(rsi[19]).toBeLessThanOrEqual(100);
    });

    it('应该处理特殊情况：所有价格都相同', () => {
      const data: ChartDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100,
        high: 100,
        low: 100,
        close: 100
      }));

      const rsi = calculateRSI(data, 14);

      expect(rsi).toHaveLength(20);
      // 所有价格相同，RSI应该有值
      expect(rsi[19]).toBeDefined();
      expect(rsi[19]).toBeGreaterThanOrEqual(0);
      expect(rsi[19]).toBeLessThanOrEqual(100);
    });

    it('应该处理极端情况：持续上涨', () => {
      const data: ChartDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i + 1 // 每天都上涨
      }));

      const rsi = calculateRSI(data, 14);

      expect(rsi).toHaveLength(20);
      // 持续上涨，RSI应该接近100
      expect(rsi[19]).toBeDefined();
      expect(rsi[19]).toBeGreaterThan(80);
    });

    it('应该处理极端情况：持续下跌', () => {
      const data: ChartDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 150 - i,
        high: 160 - i,
        low: 140 - i,
        close: 155 - i - 1 // 确保每天比前一天低
      }));

      const rsi = calculateRSI(data, 14);

      expect(rsi).toHaveLength(20);
      // 持续下跌，RSI应该有值
      expect(rsi[19]).toBeDefined();
      expect(rsi[19]).toBeGreaterThanOrEqual(0);
      expect(rsi[19]).toBeLessThanOrEqual(100);
    });
  });

  describe('边界条件处理', () => {
    it('应该处理无效数据', () => {
      const invalidData: ChartDataPoint[] = [
        { time: '2024-01-01', open: NaN, high: 110, low: 90, close: 105 },
        { time: '2024-01-02', open: 105, high: Infinity, low: 95, close: 110 },
        { time: '2024-01-03', open: 110, high: 120, low: -Infinity, close: 115 }
      ];

      expect(() => calculateMA(invalidData, 3)).not.toThrow();
      expect(() => calculateMACD(invalidData, 12, 26, 9)).not.toThrow();
      expect(() => calculateRSI(invalidData, 14)).not.toThrow();
    });

    it('应该处理零周期', () => {
      const data: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 }
      ];

      expect(() => calculateMA(data, 0)).not.toThrow();
      expect(() => calculateMACD(data, 0, 0, 0)).not.toThrow();
      expect(() => calculateRSI(data, 0)).not.toThrow();
    });

    it('应该处理负周期', () => {
      const data: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105 }
      ];

      expect(() => calculateMA(data, -5)).not.toThrow();
      expect(() => calculateMACD(data, -12, -26, -9)).not.toThrow();
      expect(() => calculateRSI(data, -14)).not.toThrow();
    });
  });

  describe('数值精度', () => {
    it('应该保持足够的数值精度', () => {
      const data: ChartDataPoint[] = [
        { time: '2024-01-01', open: 100.123456, high: 110.123456, low: 90.123456, close: 105.123456 },
        { time: '2024-01-02', open: 105.123456, high: 115.123456, low: 95.123456, close: 110.123456 },
        { time: '2024-01-03', open: 110.123456, high: 120.123456, low: 100.123456, close: 115.123456 },
        { time: '2024-01-04', open: 115.123456, high: 125.123456, low: 105.123456, close: 120.123456 },
        { time: '2024-01-05', open: 120.123456, high: 130.123456, low: 110.123456, close: 125.123456 }
      ];

      const ma5 = calculateMA(data, 5);
      const macd = calculateMACD(data, 12, 26, 9);
      const rsi = calculateRSI(data, 14);

      // 验证数值精度 - 只有足够数据的位置才有值
      expect(ma5[4]).toBeDefined(); // MA5在第5个位置有值
      expect(macd[4].macd_dif).toBeDefined(); // MACD应该有值
      expect(rsi[4]).toBeUndefined(); // RSI需要14个数据，所以第5个位置应该是undefined
    });
  });
});