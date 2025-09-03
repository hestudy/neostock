import type { ChartDataPoint, TechnicalIndicatorData } from '../types/charts';

/**
 * 数据虚拟化配置
 */
export interface VirtualizationConfig {
  /** 可见区域数据点数量 */
  visibleDataPoints: number;
  /** 预加载数据点数量 */
  preloadDataPoints: number;
  /** 数据分块大小 */
  chunkSize: number;
  /** 是否启用虚拟化 */
  enabled: boolean;
  /** 滚动阈值（像素） */
  scrollThreshold: number;
  /** 渲染延迟（毫秒） */
  renderDelay: number;
}

/**
 * 虚拟化数据窗口
 */
export interface VirtualDataWindow {
  /** 起始索引 */
  startIndex: number;
  /** 结束索引 */
  endIndex: number;
  /** 可见数据 */
  visibleData: ChartDataPoint[];
  /** 预加载数据 */
  preloadData: ChartDataPoint[];
  /** 总数据量 */
  totalDataCount: number;
}

/**
 * 数据虚拟化管理器
 */
export class DataVirtualizationManager {
  private config: VirtualizationConfig;
  private allData: ChartDataPoint[] = [];
  private allIndicators: TechnicalIndicatorData[] = [];
  private currentWindow: VirtualDataWindow | null = null;
  private scrollPosition: number = 0;
  private lastUpdateTime: number = 0;
  private renderTimer: number | null = null;

  constructor(config: Partial<VirtualizationConfig> = {}) {
    this.config = {
      visibleDataPoints: 200,
      preloadDataPoints: 50,
      chunkSize: 100,
      enabled: true,
      scrollThreshold: 50,
      renderDelay: 16, // ~60fps
      ...config,
    };
  }

  /**
   * 设置完整数据集
   */
  setFullData(data: ChartDataPoint[], indicators: TechnicalIndicatorData[] = []): void {
    this.allData = data;
    this.allIndicators = indicators;
    this.currentWindow = null;
    // 立即创建初始窗口，不使用防抖
    this.updateWindowInternal(0);
  }

  /**
   * 更新虚拟化窗口
   */
  updateWindow(scrollPosition: number): void {
    if (!this.config.enabled || this.allData.length === 0) {
      return;
    }

    const now = Date.now();
    
    // 防抖处理
    if (now - this.lastUpdateTime < this.config.renderDelay) {
      if (this.renderTimer) {
        clearTimeout(this.renderTimer);
      }
      this.renderTimer = window.setTimeout(() => {
        this.updateWindowInternal(scrollPosition);
      }, this.config.renderDelay);
      return;
    }

    this.updateWindowInternal(scrollPosition);
  }

  /**
   * 内部窗口更新逻辑
   */
  private updateWindowInternal(scrollPosition: number): void {
    // 检查滚动位置变化是否超过阈值
    if (Math.abs(scrollPosition - this.scrollPosition) < this.config.scrollThreshold) {
      return;
    }

    this.scrollPosition = scrollPosition;
    this.lastUpdateTime = Date.now();

    // 计算数据索引
    const totalDataPoints = this.allData.length;
    const maxVisibleIndex = Math.min(
      this.config.visibleDataPoints + this.config.preloadDataPoints,
      totalDataPoints
    );

    // 根据滚动位置计算起始索引
    const scrollRatio = Math.max(0, Math.min(1, scrollPosition / 1000));
    const startIndex = Math.floor(scrollRatio * (totalDataPoints - maxVisibleIndex));
    const endIndex = Math.min(startIndex + maxVisibleIndex, totalDataPoints);

    // 提取可见数据
    const visibleData = this.allData.slice(startIndex, startIndex + this.config.visibleDataPoints);
    const preloadData = this.allData.slice(
      startIndex + this.config.visibleDataPoints,
      endIndex
    );

    // 提取对应的指标数据
    // const visibleIndicators = this.allIndicators.slice(startIndex, startIndex + this.config.visibleDataPoints);
    // const preloadIndicators = this.allIndicators.slice(
    //   startIndex + this.config.visibleDataPoints,
    //   endIndex
    // );

    this.currentWindow = {
      startIndex,
      endIndex,
      visibleData,
      preloadData,
      totalDataCount: totalDataPoints,
    };
  }

  /**
   * 获取当前可见数据
   */
  getVisibleData(): ChartDataPoint[] {
    return this.currentWindow?.visibleData || this.allData.slice(0, this.config.visibleDataPoints);
  }

  /**
   * 获取当前可见指标数据
   */
  getVisibleIndicators(): TechnicalIndicatorData[] {
    if (!this.currentWindow || this.allIndicators.length === 0) {
      return [];
    }

    const { startIndex, endIndex } = this.currentWindow;
    return this.allIndicators.slice(startIndex, endIndex);
  }

  /**
   * 获取当前窗口信息
   */
  getCurrentWindow(): VirtualDataWindow | null {
    return this.currentWindow;
  }

  /**
   * 获取数据加载进度
   */
  getLoadProgress(): number {
    if (!this.currentWindow || this.allData.length === 0) {
      return 0;
    }

    return Math.min(100, (this.currentWindow.endIndex / this.allData.length) * 100);
  }

  /**
   * 检查是否需要加载更多数据
   */
  needsMoreData(): boolean {
    if (!this.currentWindow) {
      return false;
    }

    const { endIndex } = this.currentWindow;
    return endIndex >= this.allData.length - this.config.preloadDataPoints;
  }

  /**
   * 预加载数据块
   */
  preloadDataChunks(startIndex: number, count: number): void {
    if (!this.config.enabled) {
      return;
    }

    Math.min(startIndex + count, this.allData.length);
    
    // 模拟异步数据加载
    setTimeout(() => {
      // 这里可以添加实际的数据加载逻辑
      // 目前只是更新窗口以反映新数据
      this.updateWindowInternal(this.scrollPosition);
    }, 0);
  }

  /**
   * 重置虚拟化状态
   */
  reset(): void {
    this.currentWindow = null;
    this.scrollPosition = 0;
    this.lastUpdateTime = 0;
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<VirtualizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.reset();
    this.allData = [];
    this.allIndicators = [];
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private thresholds: Map<string, number> = new Map();

  constructor() {
    // 设置默认性能阈值
    this.thresholds.set('renderTime', 16); // 60fps
    this.thresholds.set('memoryUsage', 50 * 1024 * 1024); // 50MB
    this.thresholds.set('dataProcessingTime', 100); // 100ms
  }

  /**
   * 记录性能指标
   */
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // 保持最近100个记录
    if (values.length > 100) {
      values.shift();
    }
  }

  /**
   * 获取性能统计
   */
  getStats(name: string): {
    average: number;
    min: number;
    max: number;
    count: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    return {
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  /**
   * 检查性能是否达标
   */
  isPerformanceHealthy(name: string): boolean {
    const stats = this.getStats(name);
    if (!stats) {
      return true;
    }

    const threshold = this.thresholds.get(name);
    if (!threshold) {
      return true;
    }

    return stats.average <= threshold;
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    overall: boolean;
    metrics: Record<string, {
      healthy: boolean;
      stats: any;
      threshold: number;
    }>;
  } {
    const report: {
      overall: boolean;
      metrics: Record<string, {
        healthy: boolean;
        stats: any;
        threshold: number;
      }>;
    } = {
      overall: true,
      metrics: {},
    };

    for (const [name, threshold] of this.thresholds) {
      const stats = this.getStats(name);
      const healthy = this.isPerformanceHealthy(name);
      
      report.metrics[name] = {
        healthy,
        stats,
        threshold,
      };

      if (!healthy) {
        report.overall = false;
      }
    }

    return report;
  }

  /**
   * 生成详细性能报告
   */
  generateReport(): {
    timestamp: number;
    metrics: Record<string, {
      average: number;
      min: number;
      max: number;
      count: number;
      threshold: number;
      healthy: boolean;
    }>;
    summary: {
      healthy: boolean;
      totalTests: number;
      passedTests: number;
      failedTests: number;
    };
    recommendations: string[];
  } {
    const allMetrics: Record<string, {
      average: number;
      min: number;
      max: number;
      count: number;
      threshold: number;
      healthy: boolean;
    }> = {};
    const report = this.getPerformanceReport();
    
    // 收集所有指标
    for (const [name] of this.metrics) {
      const stats = this.getStats(name);
      if (stats) {
        allMetrics[name] = {
          ...stats,
          threshold: this.thresholds.get(name) || 0,
          healthy: this.isPerformanceHealthy(name),
        };
      }
    }
    
    // 计算总体健康状况
    const totalTests = Object.keys(allMetrics).length;
    const passedTests = Object.values(allMetrics).filter((m) => m.healthy).length;
    const failedTests = totalTests - passedTests;
    
    // 生成建议
    const recommendations: string[] = [];
    if (failedTests > 0) {
      recommendations.push('检测到性能问题，建议优化相关组件');
    }
    
    if (allMetrics['renderTime'] && allMetrics['renderTime'].average > 16) {
      recommendations.push('渲染时间超过16ms阈值，建议启用虚拟化渲染');
    }
    
    if (allMetrics['memoryUsage'] && allMetrics['memoryUsage'].average > 50 * 1024 * 1024) {
      recommendations.push('内存使用超过50MB阈值，建议优化数据缓存策略');
    }
    
    return {
      timestamp: Date.now(),
      metrics: allMetrics,
      summary: {
        healthy: report.overall,
        totalTests,
        passedTests,
        failedTests,
      },
      recommendations,
    };
  }

  /**
   * 销毁性能监控器
   */
  destroy(): void {
    this.reset();
    this.thresholds.clear();
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics.clear();
  }
}

/**
 * 智能缓存管理器
 */
export class SmartCacheManager {
  private cache: Map<string, {
    data: unknown;
    timestamp: number;
    accessCount: number;
    size: number;
  }> = new Map();
  private maxSize: number;
  private ttl: number;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * 生成缓存键
   */
  private generateKey(type: string, params: unknown): string {
    return `${type}_${JSON.stringify(params)}`;
  }

  /**
   * 获取缓存数据
   */
  get<T>(type: string, params: unknown): T | null {
    const key = this.generateKey(type, params);
    const item = this.cache.get(key);

    if (!item) {
      this.missCount++;
      return null;
    }

    // 检查TTL
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // 更新访问信息
    item.accessCount++;
    item.timestamp = Date.now();
    this.hitCount++;

    return item.data as T;
  }

  /**
   * 设置缓存数据
   */
  set<T>(type: string, params: unknown, data: T, size: number = 1): void {
    const key = this.generateKey(type, params);
    
    // 清理过期缓存
    this.cleanup();
    
    // 如果缓存已满，清理最久未使用的项目
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      size,
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 清理最久未使用的缓存项
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, item] of this.cache) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 获取缓存命中率
   */
  getHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    hitRate: number;
    hitCount: number;
    missCount: number;
  } {
    return {
      size: this.cache.size,
      hitRate: this.getHitRate(),
      hitCount: this.hitCount,
      missCount: this.missCount,
    };
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }
}

// 导出默认配置
export const defaultVirtualizationConfig: VirtualizationConfig = {
  visibleDataPoints: 200,
  preloadDataPoints: 50,
  chunkSize: 100,
  enabled: true,
  scrollThreshold: 50,
  renderDelay: 16,
};