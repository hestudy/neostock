import type { ChartDataPoint } from '../types/charts';

/**
 * 计算移动平均线 (Moving Average)
 * @param data K线数据
 * @param period 周期
 * @returns MA值数组
 */
export function calculateMA(data: ChartDataPoint[], period: number): (number | undefined)[] {
  if (!data || data.length === 0 || period <= 0) {
    return Array(data?.length || 0).fill(undefined);
  }

  const result: (number | undefined)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
      continue;
    }

    const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => {
      const close = Number(item.close);
      return acc + (isNaN(close) ? 0 : close);
    }, 0);

    const validCount = data.slice(i - period + 1, i + 1).reduce((acc, item) => {
      return acc + (isNaN(Number(item.close)) ? 0 : 1);
    }, 0);

    result.push(validCount > 0 ? sum / validCount : undefined);
  }

  return result;
}

/**
 * 计算指数移动平均线 (Exponential Moving Average)
 * @param data 数据数组
 * @param period 周期
 * @returns EMA值数组
 */
function calculateEMA(data: number[], period: number): (number | undefined)[] {
  if (!data || data.length === 0 || period <= 0) {
    return Array(data?.length || 0).fill(undefined);
  }

  const result: (number | undefined)[] = [];
  const multiplier = 2 / (period + 1);
  
  // 第一个EMA使用简单移动平均
  let ema: number | undefined;
  
  for (let i = 0; i < data.length; i++) {
    if (isNaN(data[i]) || data[i] === undefined) {
      result.push(undefined);
      continue;
    }

    if (i === 0) {
      ema = data[i];
    } else if (ema !== undefined) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    
    result.push(ema);
  }

  return result;
}

/**
 * 计算MACD指标
 * @param data K线数据
 * @param fastPeriod 快线周期 (默认12)
 * @param slowPeriod 慢线周期 (默认26)
 * @param signalPeriod 信号线周期 (默认9)
 * @returns MACD指标数组
 */
export function calculateMACD(
  data: ChartDataPoint[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): Array<{
  macd_dif?: number;
  macd_dea?: number;
  macd_hist?: number;
}> {
  if (!data || data.length === 0) {
    return Array(data?.length || 0).fill({
      macd_dif: undefined,
      macd_dea: undefined,
      macd_hist: undefined
    });
  }

  // 提取收盘价
  const closePrices = data.map(item => Number(item.close));

  // 计算快线和慢线的EMA
  const fastEMA = calculateEMA(closePrices, fastPeriod);
  const slowEMA = calculateEMA(closePrices, slowPeriod);

  // 计算DIF线
  const dif = fastEMA.map((fast, i) => {
    if (fast === undefined || slowEMA[i] === undefined) {
      return undefined;
    }
    return fast - slowEMA[i];
  });

  // 计算DEA线 (信号线)
  const dea = calculateEMA(
    dif.filter((value): value is number => value !== undefined),
    signalPeriod
  );

  // 重新对齐DEA数组的长度
  const alignedDEA: (number | undefined)[] = [];
  let deaIndex = 0;
  
  for (let i = 0; i < dif.length; i++) {
    if (dif[i] === undefined) {
      alignedDEA.push(undefined);
    } else if (deaIndex < dea.length) {
      alignedDEA.push(dea[deaIndex]);
      deaIndex++;
    } else {
      alignedDEA.push(undefined);
    }
  }

  // 计算MACD柱状图
  const result = dif.map((difValue, i) => ({
    macd_dif: difValue,
    macd_dea: alignedDEA[i],
    macd_hist: difValue !== undefined && alignedDEA[i] !== undefined 
      ? difValue - alignedDEA[i] 
      : undefined
  }));

  return result;
}

/**
 * 计算RSI指标
 * @param data K线数据
 * @param period 周期 (默认14)
 * @returns RSI值数组
 */
export function calculateRSI(data: ChartDataPoint[], period: number = 14): (number | undefined)[] {
  if (!data || data.length === 0 || period <= 0) {
    return Array(data?.length || 0).fill(undefined);
  }

  const result: (number | undefined)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(undefined);
      continue;
    }

    // 计算最近period个价格变化
    const changes: number[] = [];
    for (let j = i - period + 1; j < i; j++) {
      const prevClose = Number(data[j].close);
      const currClose = Number(data[j + 1].close);
      
      if (!isNaN(prevClose) && !isNaN(currClose)) {
        changes.push(currClose - prevClose);
      }
    }

    if (changes.length === 0) {
      result.push(undefined);
      continue;
    }

    // 计算平均涨幅和平均跌幅
    let avgGain = 0;
    let avgLoss = 0;
    
    for (const change of changes) {
      if (change > 0) {
        avgGain += change;
      } else {
        avgLoss += Math.abs(change);
      }
    }
    
    avgGain /= changes.length;
    avgLoss /= changes.length;

    // 计算RS和RSI
    const rs = avgLoss !== 0 ? avgGain / avgLoss : Infinity;
    const rsi = 100 - (100 / (1 + rs));

    result.push(rsi);
  }

  return result;
}

/**
 * 计算布林带指标
 * @param data K线数据
 * @param period 周期 (默认20)
 * @param stdDev 标准差倍数 (默认2)
 * @returns 布林带数据
 */
export function calculateBollingerBands(
  data: ChartDataPoint[],
  period: number = 20,
  stdDev: number = 2
): Array<{
  middle?: number;
  upper?: number;
  lower?: number;
}> {
  if (!data || data.length === 0 || period <= 0) {
    return Array(data?.length || 0).fill({
      middle: undefined,
      upper: undefined,
      lower: undefined
    });
  }

  const result: Array<{ middle?: number; upper?: number; lower?: number }> = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ middle: undefined, upper: undefined, lower: undefined });
      continue;
    }

    // 计算中轨（简单移动平均）
    const slice = data.slice(i - period + 1, i + 1);
    const validPrices = slice.map(item => Number(item.close)).filter(price => !isNaN(price));
    
    if (validPrices.length === 0) {
      result.push({ middle: undefined, upper: undefined, lower: undefined });
      continue;
    }

    const middle = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
    
    // 计算标准差
    const variance = validPrices.reduce((sum, price) => {
      return sum + Math.pow(price - middle, 2);
    }, 0) / validPrices.length;
    
    const standardDeviation = Math.sqrt(variance);
    
    result.push({
      middle,
      upper: middle + (standardDeviation * stdDev),
      lower: middle - (standardDeviation * stdDev)
    });
  }

  return result;
}

/**
 * 计算KDJ指标
 * @param data K线数据
 * @param period 周期 (默认9)
 * @returns KDJ指标数据
 */
export function calculateKDJ(
  data: ChartDataPoint[],
  period: number = 9
): Array<{
  k?: number;
  d?: number;
  j?: number;
}> {
  if (!data || data.length === 0 || period <= 0) {
    return Array(data?.length || 0).fill({
      k: undefined,
      d: undefined,
      j: undefined
    });
  }

  const result: Array<{ k?: number; d?: number; j?: number }> = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ k: undefined, d: undefined, j: undefined });
      continue;
    }

    const slice = data.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(item => Number(item.high)));
    const low = Math.min(...slice.map(item => Number(item.low)));
    const close = Number(data[i].close);

    if (isNaN(high) || isNaN(low) || isNaN(close) || high === low) {
      result.push({ k: undefined, d: undefined, j: undefined });
      continue;
    }

    const rsv = ((close - low) / (high - low)) * 100;
    
    // 计算K值（当日K值 = 2/3 × 前一日K值 + 1/3 × 当日RSV）
    const k = i === 0 ? 50 : (result[i - 1].k !== undefined 
      ? (2/3) * result[i - 1].k! + (1/3) * rsv
      : 50);
    
    // 计算D值（当日D值 = 2/3 × 前一日D值 + 1/3 × 当日K值）
    const d = i === 0 ? 50 : (result[i - 1].d !== undefined 
      ? (2/3) * result[i - 1].d! + (1/3) * k
      : 50);
    
    // 计算J值（J = 3K - 2D）
    const j = 3 * k - 2 * d;

    result.push({
      k: Math.max(0, Math.min(100, k)),
      d: Math.max(0, Math.min(100, d)),
      j: Math.max(0, Math.min(100, j))
    });
  }

  return result;
}