import type { ChartInstance } from '../types/charts';

/**
 * 内存使用统计
 */
export interface MemoryStats {
  /** 总内存使用（字节） */
  totalUsage: number;
  /** 图表数据内存使用（字节） */
  chartDataUsage: number;
  /** 技术指标内存使用（字节） */
  indicatorDataUsage: number;
  /** 缓存内存使用（字节） */
  cacheUsage: number;
  /** DOM元素数量 */
  domElementCount: number;
  /** 活跃图表实例数量 */
  activeChartCount: number;
  /** 内存碎片率（百分比） */
  fragmentationRate: number;
}

/**
 * 内存配置
 */
export interface MemoryConfig {
  /** 最大内存使用（字节） */
  maxMemoryUsage: number;
  /** 警告阈值（百分比） */
  warningThreshold: number;
  /** 清理阈值（百分比） */
  cleanupThreshold: number;
  /** 数据保留时间（毫秒） */
  dataRetentionTime: number;
  /** 启用自动垃圾回收 */
  enableAutoGC: boolean;
  /** 启用内存监控 */
  enableMemoryMonitoring: boolean;
  /** 启用内存泄漏检测 */
  enableLeakDetection: boolean;
}

/**
 * 资源清理策略
 */
export interface CleanupStrategy {
  /** 清理类型 */
  type: 'data' | 'cache' | 'dom' | 'charts' | 'all';
  /** 清理优先级 */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** 清理条件 */
  condition: () => boolean;
  /** 清理操作 */
  cleanup: () => void;
}

/**
 * 可跟踪对象接口
 */
interface TrackableObject {
  id?: string;
  [key: string]: unknown;
}

/**
 * 图表实例扩展接口
 */
interface ExtendedChartInstance extends ChartInstance {
  lastUsed?: number;
  dataLength?: number;
  indicatorLength?: number;
}

/**
 * 缓存数据项接口
 */
interface CacheItem {
  data: unknown;
  timestamp: number;
  size: number;
  lastUsed?: number;
}

/**
 * 内存泄漏检测器
 */
export class MemoryLeakDetector {
  private snapshots: Map<string, TrackableObject[]> = new Map();
  private thresholds: Map<string, number> = new Map();
  private lastCheckTime: number = Date.now();

  constructor() {
    // 设置默认阈值
    this.thresholds.set('chartInstances', 10);
    this.thresholds.set('domElements', 100);
    this.thresholds.set('eventListeners', 50);
    this.thresholds.set('cacheSize', 1000);
  }

  /**
   * 创建快照
   */
  createSnapshot(category: string, objects: TrackableObject[]): void {
    this.snapshots.set(category, [...objects]);
  }

  /**
   * 检测内存泄漏
   */
  detectLeaks(): string[] {
    const leaks: string[] = [];
    const now = Date.now();

    for (const [category, objects] of this.snapshots.entries()) {
      const threshold = this.thresholds.get(category) || 100;
      
      if (objects.length > threshold) {
        leaks.push(`${category}: ${objects.length} objects (threshold: ${threshold})`);
      }
    }

    this.lastCheckTime = now;
    return leaks;
  }

  /**
   * 设置检测阈值
   */
  setThreshold(category: string, threshold: number): void {
    this.thresholds.set(category, threshold);
  }
}

/**
 * 内存管理器
 */
export class MemoryManager {
  private config: MemoryConfig;
  private stats: MemoryStats;
  private leakDetector: MemoryLeakDetector;
  private cleanupStrategies: CleanupStrategy[] = [];
  private monitoringInterval: number | null = null;
  private cleanupInterval: number | null = null;
  private chartInstances: Set<ChartInstance> = new Set();
  private dataCache: Map<string, CacheItem> = new Map();

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = {
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      warningThreshold: 0.8, // 80%
      cleanupThreshold: 0.9, // 90%
      dataRetentionTime: 5 * 60 * 1000, // 5分钟
      enableAutoGC: true,
      enableMemoryMonitoring: true,
      enableLeakDetection: true,
      ...config,
    };

    this.stats = {
      totalUsage: 0,
      chartDataUsage: 0,
      indicatorDataUsage: 0,
      cacheUsage: 0,
      domElementCount: 0,
      activeChartCount: 0,
      fragmentationRate: 0,
    };

    this.leakDetector = new MemoryLeakDetector();
    this.initializeCleanupStrategies();
    this.startMonitoring();
  }

  /**
   * 初始化清理策略
   */
  private initializeCleanupStrategies(): void {
    // 数据清理策略
    this.cleanupStrategies.push({
      type: 'data',
      priority: 'medium',
      condition: () => this.isMemoryUsageHigh(),
      cleanup: () => this.cleanupOldData(),
    });

    // 缓存清理策略
    this.cleanupStrategies.push({
      type: 'cache',
      priority: 'high',
      condition: () => this.isCacheUsageHigh(),
      cleanup: () => this.cleanupCache(),
    });

    // DOM清理策略
    this.cleanupStrategies.push({
      type: 'dom',
      priority: 'medium',
      condition: () => this.isDomUsageHigh(),
      cleanup: () => this.cleanupDomElements(),
    });

    // 图表清理策略
    this.cleanupStrategies.push({
      type: 'charts',
      priority: 'critical',
      condition: () => this.isChartUsageHigh(),
      cleanup: () => this.cleanupInactiveCharts(),
    });
  }

  /**
   * 开始内存监控
   */
  private startMonitoring(): void {
    if (this.config.enableMemoryMonitoring) {
      this.monitoringInterval = window.setInterval(() => {
        this.updateMemoryStats();
        this.checkMemoryWarnings();
        
        if (this.config.enableLeakDetection) {
          this.detectMemoryLeaks();
        }
      }, 5000); // 每5秒检查一次
    }

    // 自动清理
    this.cleanupInterval = window.setInterval(() => {
      this.performCleanup();
    }, 30000); // 每30秒清理一次
  }

  /**
   * 更新内存统计
   */
  private updateMemoryStats(): void {
    try {
      // 更新基础统计
      this.stats.activeChartCount = this.chartInstances.size;
      
      // 安全地获取DOM元素数量
      try {
        this.stats.domElementCount = document.querySelectorAll('*').length;
      } catch {
        this.stats.domElementCount = 0;
      }

      // 计算缓存使用
      this.stats.cacheUsage = Array.from(this.dataCache.values())
        .reduce((total, item) => total + (item.size || 0), 0);

      // 估算数据使用
      this.stats.chartDataUsage = this.estimateChartDataUsage();
      this.stats.indicatorDataUsage = this.estimateIndicatorDataUsage();

      // 计算总使用量
      this.stats.totalUsage = 
        this.stats.chartDataUsage + 
        this.stats.indicatorDataUsage + 
        this.stats.cacheUsage;

      // 计算碎片率（简化计算）
      this.stats.fragmentationRate = this.calculateFragmentationRate();

    } catch (error) {
      console.error('Failed to update memory stats:', error);
    }
  }

  /**
   * 检查内存警告
   */
  private checkMemoryWarnings(): void {
    const usageRatio = this.stats.totalUsage / this.config.maxMemoryUsage;
    
    if (usageRatio > this.config.warningThreshold) {
      console.warn(`Memory usage warning: ${(usageRatio * 100).toFixed(1)}% used`);
      
      if (usageRatio > this.config.cleanupThreshold) {
        console.warn('Memory usage critical, triggering cleanup...');
        this.performCleanup();
      }
    }
  }

  /**
   * 检测内存泄漏
   */
  private detectMemoryLeaks(): void {
    const leaks = this.leakDetector.detectLeaks();
    
    if (leaks.length > 0) {
      console.warn('Potential memory leaks detected:', leaks);
      
      // 触发紧急清理
      if (leaks.some(leak => leak.includes('critical'))) {
        this.performEmergencyCleanup();
      }
    }
  }

  /**
   * 执行清理
   */
  public performCleanup(): void {
    // 按优先级排序
    const sortedStrategies = this.cleanupStrategies.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const strategy of sortedStrategies) {
      if (strategy.condition()) {
        try {
          strategy.cleanup();
          console.log(`Executed ${strategy.type} cleanup strategy`);
        } catch (error) {
          console.error(`Failed to execute ${strategy.type} cleanup:`, error);
        }
      }
    }

    // 强制垃圾回收（如果可用）
    if (this.config.enableAutoGC && typeof gc !== 'undefined') {
      try {
        gc();
      } catch {
        // 忽略GC错误
      }
    }
  }

  /**
   * 执行紧急清理
   */
  private performEmergencyCleanup(): void {
    console.log('Performing emergency cleanup...');
    
    // 清理所有缓存
    this.dataCache.clear();
    
    // 清理旧数据
    this.cleanupOldData();
    
    // 清理不活跃的图表
    this.cleanupInactiveCharts();
    
    // 强制垃圾回收
    if (typeof gc !== 'undefined') {
      try {
        gc();
      } catch {
        // 忽略GC错误
      }
    }
  }

  /**
   * 清理旧数据
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.dataRetentionTime;
    
    for (const [key, item] of this.dataCache.entries()) {
      if (item.timestamp < cutoffTime) {
        this.dataCache.delete(key);
      }
    }
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    // 保留最近使用的50%的缓存项
    const entries = Array.from(this.dataCache.entries());
    const keepCount = Math.floor(entries.length * 0.5);
    
    // 按时间戳排序，保留最新的
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    this.dataCache.clear();
    entries.slice(0, keepCount).forEach(([key, item]) => {
      this.dataCache.set(key, item);
    });
  }

  /**
   * 清理DOM元素
   */
  private cleanupDomElements(): void {
    // 清理空的容器元素
    const emptyContainers = document.querySelectorAll('.chart-container:empty');
    emptyContainers.forEach(container => {
      container.remove();
    });
  }

  /**
   * 清理不活跃的图表
   */
  private cleanupInactiveCharts(): void {
    // 移除超过1小时未使用的图表
    const now = Date.now();
    const inactiveCharts = Array.from(this.chartInstances).filter(chart => {
      // 假设图表有lastUsed属性
      const lastUsed = (chart as ExtendedChartInstance).lastUsed || 0;
      return now - lastUsed > 60 * 60 * 1000; // 1小时
    });

    inactiveCharts.forEach(chart => {
      this.unregisterChartInstance(chart);
    });
  }

  /**
   * 检查内存使用是否过高
   */
  private isMemoryUsageHigh(): boolean {
    return this.stats.totalUsage > this.config.maxMemoryUsage * this.config.warningThreshold;
  }

  /**
   * 检查缓存使用是否过高
   */
  private isCacheUsageHigh(): boolean {
    return this.stats.cacheUsage > this.config.maxMemoryUsage * 0.3; // 30%
  }

  /**
   * 检查DOM使用是否过高
   */
  private isDomUsageHigh(): boolean {
    return this.stats.domElementCount > 500;
  }

  /**
   * 检查图表使用是否过高
   */
  private isChartUsageHigh(): boolean {
    return this.stats.activeChartCount > 5;
  }

  /**
   * 估算图表数据使用量
   */
  private estimateChartDataUsage(): number {
    // 简化估算：每个数据点约100字节
    let totalDataPoints = 0;
    this.chartInstances.forEach(chart => {
      totalDataPoints += (chart as ExtendedChartInstance).dataLength || 0;
    });
    return totalDataPoints * 100;
  }

  /**
   * 估算指标数据使用量
   */
  private estimateIndicatorDataUsage(): number {
    // 简化估算：每个指标数据点约50字节
    let totalIndicatorPoints = 0;
    this.chartInstances.forEach(chart => {
      totalIndicatorPoints += (chart as ExtendedChartInstance).indicatorLength || 0;
    });
    return totalIndicatorPoints * 50;
  }

  /**
   * 计算内存碎片率
   */
  private calculateFragmentationRate(): number {
    // 简化计算：基于缓存项数量和大小
    const cacheEntries = this.dataCache.size;
    if (cacheEntries === 0) return 0;
    
    const avgSize = this.stats.cacheUsage / cacheEntries;
    const sizeVariance = Array.from(this.dataCache.values())
      .reduce((sum, item) => sum + Math.pow(item.size - avgSize, 2), 0) / cacheEntries;
    
    return Math.min(100, (sizeVariance / (avgSize * avgSize)) * 100);
  }

  /**
   * 注册图表实例
   */
  registerChartInstance(chart: ChartInstance): void {
    this.chartInstances.add(chart);
    try {
      (chart as ExtendedChartInstance).lastUsed = Date.now();
    } catch {
      // 忽略属性设置错误
    }
  }

  /**
   * 注销图表实例
   */
  unregisterChartInstance(chart: ChartInstance): void {
    this.chartInstances.delete(chart);
  }

  /**
   * 添加数据到缓存
   */
  addToCache(key: string, data: unknown, size: number = 0): void {
    let estimatedSize = size;
    if (estimatedSize === 0 && data != null) {
      try {
        estimatedSize = JSON.stringify(data).length * 2; // 估算大小
      } catch {
        estimatedSize = 100; // 默认大小
      }
    }
    
    this.dataCache.set(key, {
      data,
      timestamp: Date.now(),
      size: estimatedSize,
    });
  }

  /**
   * 从缓存获取数据
   */
  getFromCache(key: string): unknown | null {
    const item = this.dataCache.get(key);
    if (item) {
      item.lastUsed = Date.now();
      return item.data;
    }
    return null;
  }

  /**
   * 获取内存统计
   */
  getMemoryStats(): MemoryStats {
    this.updateMemoryStats(); // 确保统计是最新的
    return { ...this.stats };
  }

  /**
   * 获取内存报告
   */
  getMemoryReport(): {
    healthy: boolean;
    stats: MemoryStats;
    warnings: string[];
    recommendations: string[];
  } {
    const usageRatio = this.stats.totalUsage / this.config.maxMemoryUsage;
    const healthy = usageRatio < this.config.warningThreshold;
    
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (usageRatio > this.config.warningThreshold) {
      warnings.push(`内存使用率过高: ${(usageRatio * 100).toFixed(1)}%`);
    }

    if (this.stats.fragmentationRate > 50) {
      warnings.push(`内存碎片率过高: ${this.stats.fragmentationRate.toFixed(1)}%`);
      recommendations.push('建议重启应用以减少内存碎片');
    }

    if (this.stats.activeChartCount > 3) {
      recommendations.push('建议关闭不使用的图表以减少内存使用');
    }

    return {
      healthy,
      stats: this.stats,
      warnings,
      recommendations,
    };
  }

  /**
   * 销毁内存管理器
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // 清理所有资源
    this.dataCache.clear();
    this.chartInstances.clear();
    this.cleanupStrategies = [];
  }
}

// 导出默认配置
export const defaultMemoryConfig: MemoryConfig = {
  maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  warningThreshold: 0.8,
  cleanupThreshold: 0.9,
  dataRetentionTime: 5 * 60 * 1000, // 5分钟
  enableAutoGC: true,
  enableMemoryMonitoring: true,
  enableLeakDetection: true,
};