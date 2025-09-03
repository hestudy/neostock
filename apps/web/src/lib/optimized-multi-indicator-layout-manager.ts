import type { ChartInstance, TechnicalIndicatorConfig, TechnicalIndicatorData, PerformanceMetrics as ChartPerformanceMetrics } from '../types/charts';
import { MultiIndicatorLayoutManager, type MultiIndicatorLayoutConfig } from './multi-indicator-layout-manager';
import { DataVirtualizationManager, PerformanceMonitor, SmartCacheManager, type VirtualizationConfig } from './chart-performance-optimization';
import { MemoryManager, type MemoryConfig } from './memory-management';

/**
 * 性能优化的多指标布局配置
 */
export interface OptimizedLayoutConfig extends MultiIndicatorLayoutConfig {
  /** 虚拟化配置 */
  virtualization?: VirtualizationConfig;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  /** 是否启用智能缓存 */
  enableSmartCaching?: boolean;
  /** 渲染优化配置 */
  rendering?: {
    /** 是否启用防抖渲染 */
    enableDebouncing?: boolean;
    /** 防抖延迟（毫秒） */
    debounceDelay?: number;
    /** 是否启用批量更新 */
    enableBatchUpdates?: boolean;
    /** 批量更新延迟（毫秒） */
    batchDelay?: number;
    /** 是否启用惰性渲染 */
    enableLazyRendering?: boolean;
    /** 惰性渲染阈值（像素） */
    lazyRenderThreshold?: number;
  };
  /** 内存管理配置 */
  memory?: MemoryConfig;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 渲染时间（毫秒） */
  renderTime: number;
  /** 内存使用（字节） */
  memoryUsage: number;
  /** 数据处理时间（毫秒） */
  dataProcessingTime: number;
  /** 布局计算时间（毫秒） */
  layoutCalculationTime: number;
  /** 缓存命中率 */
  cacheHitRate: number;
  /** 可见指标数量 */
  visibleIndicators: number;
  /** 总指标数量 */
  totalIndicators: number;
}

/**
 * 性能优化的多指标布局管理器
 */
export class OptimizedMultiIndicatorLayoutManager extends MultiIndicatorLayoutManager {
  private virtualizationManager: DataVirtualizationManager;
  private performanceMonitor: PerformanceMonitor;
  private cacheManager: SmartCacheManager;
  private memoryManager: MemoryManager;
  private optimizedConfig: OptimizedLayoutConfig;
  private renderTimer: number | null = null;
  private batchTimer: number | null = null;
  private pendingUpdates: Set<() => void> = new Set();
  private isRendering: boolean = false;
  private lastRenderTime: number = 0;
  private renderQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue: boolean = false;
  private memoryUsageInterval: number | null = null;

  constructor(config: Partial<OptimizedLayoutConfig> = {}) {
    // 初始化基础配置
    const baseConfig: MultiIndicatorLayoutConfig = {
      layoutMode: config.layoutMode || 'overlay',
      heightDistribution: config.heightDistribution || { mainChart: 0.7, indicators: 0.3 },
      indicatorSpacing: config.indicatorSpacing || 2,
      showSeparators: config.showSeparators !== false,
      indicatorOrder: config.indicatorOrder || ['ma', 'macd', 'rsi'],
      maxVisibleIndicators: config.maxVisibleIndicators || 3,
    };

    super(baseConfig);

    this.optimizedConfig = {
      ...baseConfig,
      virtualization: config.virtualization || {
        visibleDataPoints: 200,
        preloadDataPoints: 50,
        chunkSize: 100,
        enabled: true,
        scrollThreshold: 50,
        renderDelay: 16,
      },
      enablePerformanceMonitoring: config.enablePerformanceMonitoring !== false,
      enableSmartCaching: config.enableSmartCaching !== false,
      rendering: {
        enableDebouncing: true,
        debounceDelay: 16,
        enableBatchUpdates: true,
        batchDelay: 32,
        enableLazyRendering: true,
        lazyRenderThreshold: 100,
        ...config.rendering,
      },
    };

    // 初始化性能优化组件
    this.virtualizationManager = new DataVirtualizationManager(this.optimizedConfig.virtualization);
    this.performanceMonitor = new PerformanceMonitor();
    this.cacheManager = new SmartCacheManager(100, 5 * 60 * 1000); // 100 items, 5 minutes TTL
    this.memoryManager = new MemoryManager(this.optimizedConfig.memory);
    
    // 启动内存监控
    this.startMemoryMonitoring();
  }

  /**
   * 优化的布局更新方法
   */
  updateLayout(indicators: ('ma' | 'macd' | 'rsi')[], containerHeight: number): void {
    if (!this.optimizedConfig.rendering?.enableDebouncing) {
      this.updateLayoutImmediate(indicators, containerHeight);
      return;
    }

    // 防抖处理
    const delay = this.optimizedConfig.rendering?.debounceDelay || 16;
    
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }

    this.renderTimer = window.setTimeout(() => {
      this.updateLayoutImmediate(indicators, containerHeight);
    }, delay);
  }

  /**
   * 立即更新布局（内部方法）
   */
  private updateLayoutImmediate(indicators: ('ma' | 'macd' | 'rsi')[], containerHeight: number): void {
    const startTime = performance.now();
    
    // 检查是否需要批量更新
    if (this.optimizedConfig.rendering?.enableBatchUpdates) {
      this.scheduleBatchUpdate(() => {
        this.performLayoutUpdate(indicators, containerHeight);
      });
    } else {
      this.performLayoutUpdate(indicators, containerHeight);
    }

    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // 记录性能指标
    if (this.optimizedConfig.enablePerformanceMonitoring) {
      this.performanceMonitor.recordMetric('renderTime', renderTime);
    }
  }

  /**
   * 执行实际的布局更新
   */
  private performLayoutUpdate(indicators: ('ma' | 'macd' | 'rsi')[], containerHeight: number): void {
    if (this.isRendering) {
      return;
    }

    this.isRendering = true;
    this.lastRenderTime = performance.now();

    try {
      // 调用父类的布局更新
      super.updateLayout(indicators, containerHeight);
      
      // 更新虚拟化窗口
      this.virtualizationManager.updateWindow(this.scrollPosition);
      
    } catch (error) {
      console.error('Layout update failed:', error);
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * 调度批量更新
   */
  private scheduleBatchUpdate(update: () => void): void {
    this.pendingUpdates.add(update);

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    const delay = this.optimizedConfig.rendering?.batchDelay || 32;
    
    this.batchTimer = window.setTimeout(() => {
      this.processBatchUpdates();
    }, delay);
  }

  /**
   * 处理批量更新
   */
  private processBatchUpdates(): void {
    const updates = Array.from(this.pendingUpdates);
    this.pendingUpdates.clear();
    this.batchTimer = null;

    // 批量执行更新
    updates.forEach(update => {
      try {
        update();
      } catch (error) {
        console.error('Batch update failed:', error);
      }
    });
  }

  /**
   * 优化的指标添加方法
   */
  addIndicatorToLayout(
    instance: ChartInstance,
    type: 'ma' | 'macd' | 'rsi',
    data: TechnicalIndicatorData[],
    config: TechnicalIndicatorConfig
  ): void {
    const startTime = performance.now();

    // 检查缓存
    if (this.optimizedConfig.enableSmartCaching) {
      const cacheKey = `indicator_${type}_${data.length}`;
      const cached = this.cacheManager.get<TechnicalIndicatorData[]>(cacheKey, { type, dataLength: data.length });
      
      if (cached) {
        // 使用缓存的数据
        this.addCachedIndicatorToLayout(instance, type, cached, config);
        return;
      }
    }

    // 获取虚拟化数据
    const visibleData = this.virtualizationManager.getVisibleIndicators();
    const effectiveData = visibleData.length > 0 ? visibleData : data;

    // 执行实际的指标添加
    super.addIndicatorToLayout(instance, type, effectiveData, config);

    // 缓存结果
    if (this.optimizedConfig.enableSmartCaching) {
      const cacheKey = `indicator_${type}_${data.length}`;
      this.cacheManager.set(cacheKey, { type, dataLength: data.length }, effectiveData);
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    if (this.optimizedConfig.enablePerformanceMonitoring) {
      this.performanceMonitor.recordMetric('dataProcessingTime', processingTime);
    }
  }

  /**
   * 添加缓存的指标到布局
   */
  private addCachedIndicatorToLayout(
    instance: ChartInstance,
    type: 'ma' | 'macd' | 'rsi',
    cachedData: TechnicalIndicatorData[],
    config: TechnicalIndicatorConfig
  ): void {
    // 使用缓存的数据快速添加指标
    super.addIndicatorToLayout(instance, type, cachedData, config);
  }

  /**
   * 惰性渲染检查
   */
  private shouldLazyRender(element: HTMLElement): boolean {
    if (!this.optimizedConfig.rendering?.enableLazyRendering) {
      return false;
    }

    const threshold = this.optimizedConfig.rendering?.lazyRenderThreshold || 100;
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // 检查元素是否在视口附近
    return rect.top > viewportHeight + threshold || rect.bottom < -threshold;
  }

  /**
   * 设置完整数据集
   */
  setFullData(data: unknown[], indicators: TechnicalIndicatorData[] = []): void {
    if (this.optimizedConfig.virtualization?.enabled) {
      this.virtualizationManager.setFullData(data as any, indicators);
    }
  }

  /**
   * 处理滚动事件
   */
  handleScroll(scrollPosition: number): void {
    this.scrollPosition = scrollPosition;
    
    if (this.optimizedConfig.virtualization?.enabled) {
      this.virtualizationManager.updateWindow(scrollPosition);
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const renderStats = this.performanceMonitor.getStats('renderTime');
    const processingStats = this.performanceMonitor.getStats('dataProcessingTime');
    const cacheStats = this.cacheManager.getStats();

    return {
      renderTime: renderStats?.average || 0,
      memoryUsage: (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0,
      fps: 60, // 默认fps值
      cacheHitRate: cacheStats.hitRate,
      visibleIndicators: this.getLayoutInfo().length,
      totalIndicators: this.optimizedConfig.maxVisibleIndicators,
      dataProcessingTime: processingStats?.average || 0,
      layoutCalculationTime: 0, // 需要实际测量
    } as any;
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    healthy: boolean;
    metrics: PerformanceMetrics;
    recommendations: string[];
  } {
    const metrics = this.getPerformanceMetrics();
    const recommendations: string[] = [];
    let healthy = true;

    // 检查渲染性能
    if (metrics.renderTime > 16) {
      healthy = false;
      recommendations.push('渲染时间超过16ms，建议启用虚拟化或减少可见数据点');
    }

    // 检查内存使用
    if (metrics.memoryUsage > 50 * 1024 * 1024) {
      healthy = false;
      recommendations.push('内存使用超过50MB，建议清理缓存或减少数据保留');
    }

    // 检查缓存命中率
    if ((metrics.cacheHitRate || 0) < 0.8) {
      recommendations.push('缓存命中率较低，建议调整缓存策略');
    }

    // 检查可见指标数量
    if ((metrics.visibleIndicators || 0) > 3) {
      recommendations.push('可见指标数量较多，可能影响性能');
    }

    return {
      healthy,
      metrics,
      recommendations,
    };
  }

  /**
   * 优化性能配置
   */
  optimizePerformance(): void {
    const report = this.getPerformanceReport();
    
    if (!report.healthy) {
      // 根据建议自动优化配置
      report.recommendations.forEach(recommendation => {
        if (recommendation.includes('渲染时间')) {
          this.optimizedConfig.virtualization = {
            ...this.optimizedConfig.virtualization!,
            visibleDataPoints: Math.max(50, (this.optimizedConfig.virtualization?.visibleDataPoints || 200) - 50),
          };
        }
        
        if (recommendation.includes('内存使用')) {
          this.cacheManager.clear();
        }
        
        if (recommendation.includes('缓存命中率')) {
          this.optimizedConfig.enableSmartCaching = false;
        }
        
        if (recommendation.includes('可见指标数量')) {
          this.optimizedConfig.maxVisibleIndicators = Math.max(1, this.optimizedConfig.maxVisibleIndicators - 1);
        }
      });
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<OptimizedLayoutConfig>): void {
    this.optimizedConfig = { ...this.optimizedConfig, ...newConfig };
    
    // 更新子组件配置
    if (newConfig.virtualization) {
      this.virtualizationManager.updateConfig(newConfig.virtualization);
    }
    
    // 调用父类更新
    super.updateConfig(newConfig);
  }

  /**
   * 队列化渲染任务
   */
  private queueRenderTask(task: () => Promise<void>): void {
    this.renderQueue.push(task);
    
    if (!this.isProcessingQueue) {
      this.processRenderQueue();
    }
  }

  /**
   * 处理渲染队列
   */
  private async processRenderQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.renderQueue.length > 0) {
      const task = this.renderQueue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('Render task failed:', error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 启动内存监控
   */
  private startMemoryMonitoring(): void {
    this.memoryUsageInterval = window.setInterval(() => {
      this.optimizeMemoryUsage();
    }, 10000); // 每10秒检查一次内存使用
  }

  /**
   * 优化内存使用
   */
  private optimizeMemoryUsage(): void {
    try {
      const memoryReport = this.memoryManager.getMemoryReport();
      
      if (!memoryReport.healthy) {
        console.warn('Memory optimization needed:', memoryReport.warnings);
        
        // 根据内存使用情况调整配置
        if (memoryReport.stats.totalUsage > 80 * 1024 * 1024) { // 80MB
          this.optimizedConfig.virtualization = {
            ...this.optimizedConfig.virtualization!,
            visibleDataPoints: Math.max(50, this.optimizedConfig.virtualization!.visibleDataPoints - 25),
          };
          
          // 清理缓存
          this.cacheManager.clear();
          
          // 清理虚拟化数据
          this.virtualizationManager.reset();
        }
        
        // 执行内存清理
        (this.memoryManager as any).performCleanup();
      }
    } catch (error) {
      console.error('Memory optimization failed:', error);
    }
  }

  /**
   * 获取内存使用报告
   */
  getMemoryReport(): {
    healthy: boolean;
    stats: unknown;
    warnings: string[];
    recommendations: string[];
  } {
    return this.memoryManager.getMemoryReport();
  }

  /**
   * 注册图表实例到内存管理器
   */
  registerChartInstance(chart: ChartInstance): void {
    this.memoryManager.registerChartInstance(chart);
  }

  /**
   * 注销图表实例
   */
  unregisterChartInstance(chart: ChartInstance): void {
    this.memoryManager.unregisterChartInstance(chart);
  }

  /**
   * 销毁优化管理器
   */
  destroy(): void {
    // 清理定时器
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.memoryUsageInterval) {
      clearInterval(this.memoryUsageInterval);
      this.memoryUsageInterval = null;
    }

    // 清理待处理的更新
    this.pendingUpdates.clear();
    this.renderQueue = [];

    // 销毁子组件
    this.virtualizationManager.destroy();
    this.cacheManager.clear();
    this.memoryManager.destroy();

    // 调用父类销毁
    super.destroy();
  }

  private scrollPosition: number = 0;
}

// 导出默认配置
export const defaultOptimizedLayoutConfig: OptimizedLayoutConfig = {
  layoutMode: 'overlay',
  heightDistribution: { mainChart: 0.7, indicators: 0.3 },
  indicatorSpacing: 2,
  showSeparators: true,
  indicatorOrder: ['ma', 'macd', 'rsi'],
  maxVisibleIndicators: 3,
  virtualization: {
    visibleDataPoints: 200,
    preloadDataPoints: 50,
    chunkSize: 100,
    enabled: true,
    scrollThreshold: 50,
    renderDelay: 16,
  },
  enablePerformanceMonitoring: true,
  enableSmartCaching: true,
  rendering: {
    enableDebouncing: true,
    debounceDelay: 16,
    enableBatchUpdates: true,
    batchDelay: 32,
    enableLazyRendering: true,
    lazyRenderThreshold: 100,
  },
};