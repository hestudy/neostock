// 移动端性能优化工具
import type { PerformanceConfig } from '../types/charts';

/**
 * 移动端性能配置
 */
export const mobilePerformanceConfig: PerformanceConfig = {
  maxDataPoints: 300, // 移动端减少数据点数量
  updateInterval: 500, // 降低更新频率
  enableCache: true,
  enableLazyLoading: true,
  chunkSize: 30, // 更小的数据块
};

/**
 * 低端设备性能配置
 */
export const lowEndDeviceConfig: PerformanceConfig = {
  maxDataPoints: 150,
  updateInterval: 1000,
  enableCache: true,
  enableLazyLoading: true,
  chunkSize: 20,
};

/**
 * 网络条件性能配置
 */
export function getNetworkBasedConfig(): PerformanceConfig {
  // 检测网络条件
  const connection = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
  if (!connection) {
    return mobilePerformanceConfig;
  }

  const effectiveType = connection.effectiveType;
  
  switch (effectiveType) {
    case 'slow-2g':
    case '2g':
      return {
        ...mobilePerformanceConfig,
        maxDataPoints: 100,
        updateInterval: 2000,
        chunkSize: 10,
      };
    case '3g':
      return {
        ...mobilePerformanceConfig,
        maxDataPoints: 200,
        updateInterval: 1000,
        chunkSize: 20,
      };
    case '4g':
    default:
      return mobilePerformanceConfig;
  }
}

/**
 * 内存优化工具
 */
export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private cache = new Map<string, unknown>();
  private maxCacheSize = 50;

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  /**
   * 添加缓存项
   */
  set(key: string, value: unknown, ttl: number = 60000): void {
    this.cleanup();
    
    if (this.cache.size >= this.maxCacheSize) {
      // 删除最旧的项
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * 获取缓存项
   */
  get(key: string): unknown | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - (item as any).timestamp > (item as any).ttl) {
      this.cache.delete(key);
      return null;
    }

    return (item as any).value;
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - (item as any).timestamp > (item as any).ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      usage: `${((this.cache.size / this.maxCacheSize) * 100).toFixed(1)}%`,
    };
  }
}

/**
 * 图表渲染性能优化器
 */
export class ChartPerformanceOptimizer {
  private static instance: ChartPerformanceOptimizer;
  private frameCallbacks = new Set<() => void>();
  private lastFrameTime = 0;
  private targetFPS = 60;
  private frameInterval = 1000 / this.targetFPS;

  static getInstance(): ChartPerformanceOptimizer {
    if (!ChartPerformanceOptimizer.instance) {
      ChartPerformanceOptimizer.instance = new ChartPerformanceOptimizer();
    }
    return ChartPerformanceOptimizer.instance;
  }

  /**
   * 注册渲染回调
   */
  registerCallback(callback: () => void): void {
    this.frameCallbacks.add(callback);
    this.startAnimationLoop();
  }

  /**
   * 注销渲染回调
   */
  unregisterCallback(callback: () => void): void {
    this.frameCallbacks.delete(callback);
    if (this.frameCallbacks.size === 0) {
      this.stopAnimationLoop();
    }
  }

  /**
   * 开始动画循环
   */
  private startAnimationLoop(): void {
    if (this.frameCallbacks.size === 0) return;

    const animate = (currentTime: number) => {
      if (currentTime - this.lastFrameTime >= this.frameInterval) {
        this.frameCallbacks.forEach(callback => callback());
        this.lastFrameTime = currentTime;
      }

      if (this.frameCallbacks.size > 0) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * 停止动画循环
   */
  private stopAnimationLoop(): void {
    this.frameCallbacks.clear();
  }

  /**
   * 节流函数
   */
  throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  }

  /**
   * 防抖函数
   */
  debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * 数据分块处理
   */
  chunkData<T>(data: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 数据采样优化
   */
  sampleData<T extends { time: string | number }>(
    data: T[],
    maxPoints: number
  ): T[] {
    if (data.length <= maxPoints) return data;

    const step = Math.floor(data.length / maxPoints);
    const sampled: T[] = [];

    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }

    // 确保包含最后一个数据点
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1]);
    }

    return sampled;
  }

  /**
   * 检测设备性能
   */
  detectDevicePerformance(): {
    isLowEnd: boolean;
    hardwareConcurrency: number;
    memoryInfo?: unknown;
  } {
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const isLowEnd = hardwareConcurrency <= 2;
    
    let memoryInfo;
    if ((globalThis as any)?.device?.memory) {
      memoryInfo = (globalThis as any).device.memory;
    }

    return {
      isLowEnd,
      hardwareConcurrency,
      memoryInfo,
    };
  }
}

/**
 * 移动端触摸事件优化
 */
export class TouchEventOptimizer {
  private touchStartY = 0;
  private touchStartX = 0;
  private lastTouchTime = 0;
  private isScrolling = false;

  /**
   * 处理触摸开始事件
   */
  handleTouchStart(e: TouchEvent): boolean {
    if (e.touches.length === 1) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.lastTouchTime = Date.now();
      this.isScrolling = false;
      return true;
    }
    return false;
  }

  /**
   * 处理触摸移动事件
   */
  handleTouchMove(e: TouchEvent): {
    isScroll: boolean;
    isZoom: boolean;
    preventDefault: boolean;
  } {
    const isZoom = e.touches.length >= 2;
    
    if (e.touches.length === 1) {
      const deltaX = Math.abs(e.touches[0].clientX - this.touchStartX);
      const deltaY = Math.abs(e.touches[0].clientY - this.touchStartY);
      
      // 判断是滚动还是缩放
      const isScroll = deltaY > deltaX && deltaY > 10;
      
      // 防止页面滚动
      const preventDefault = isScroll || isZoom;
      
      return { isScroll, isZoom, preventDefault };
    }
    
    // 多点触摸的情况
    const preventDefault = isZoom;
    return { isScroll: false, isZoom, preventDefault };
  }

  /**
   * 处理触摸结束事件
   */
  handleTouchEnd(): {
    isTap: boolean;
    isDoubleTap: boolean;
  } {
    const now = Date.now();
    const isTap = now - this.lastTouchTime < 300;
    // 简化双击检测逻辑，这里主要检测单击
    const isDoubleTap = false; // 暂时禁用双击检测，因为需要更复杂的逻辑
    
    return { isTap, isDoubleTap };
  }
}

/**
 * 导出性能优化工具实例
 */
export const memoryOptimizer = MemoryOptimizer.getInstance();
export const chartPerformanceOptimizer = ChartPerformanceOptimizer.getInstance();
export const touchEventOptimizer = new TouchEventOptimizer();