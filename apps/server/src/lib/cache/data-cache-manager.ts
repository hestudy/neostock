import type { StockBasicInfo, StockDailyData, DataFetchResponse } from "../../types/data-sources";

// 缓存配置接口
export interface CacheConfig {
  ttlSeconds: number; // 缓存生存时间 (秒)
  maxEntries: number; // 最大缓存条目数
  enableStats: boolean; // 是否启用统计
  keyPrefix: string; // 缓存键前缀
}

// 缓存统计接口
export interface CacheStats {
  hits: number; // 命中次数
  misses: number; // 未命中次数
  evictions: number; // 驱逐次数
  hitRate: number; // 命中率 (0-1)
  totalOperations: number; // 总操作数
  size: number; // 当前缓存大小
}

// 缓存条目接口
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

// 数据缓存管理器
export class DataCacheManager {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    hitRate: 0,
    totalOperations: 0,
    size: 0,
  };

  constructor(config: CacheConfig) {
    this.config = config;
    this.startCleanupTimer();
  }

  // 获取缓存的股票基础信息
  getStockBasicInfo(key: string): DataFetchResponse<StockBasicInfo> | null {
    return this.get<DataFetchResponse<StockBasicInfo>>(`stock_basic_${key}`);
  }

  // 设置股票基础信息缓存
  setStockBasicInfo(
    key: string, 
    data: DataFetchResponse<StockBasicInfo>, 
    customTtl?: number
  ): void {
    this.set(`stock_basic_${key}`, data, customTtl);
  }

  // 获取缓存的股票日线数据
  getStockDailyData(key: string): DataFetchResponse<StockDailyData> | null {
    return this.get<DataFetchResponse<StockDailyData>>(`stock_daily_${key}`);
  }

  // 设置股票日线数据缓存
  setStockDailyData(
    key: string, 
    data: DataFetchResponse<StockDailyData>, 
    customTtl?: number
  ): void {
    this.set(`stock_daily_${key}`, data, customTtl);
  }

  // 通用获取方法
  private get<T>(key: string): T | null {
    const cacheKey = this.buildKey(key);
    const entry = this.cache.get(cacheKey);
    
    this.updateStats('operation');

    if (!entry) {
      this.updateStats('miss');
      return null;
    }

    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(cacheKey);
      this.updateStats('miss');
      this.updateStats('eviction');
      return null;
    }

    // 更新命中统计
    entry.hits++;
    this.updateStats('hit');
    
    return entry.data as T;
  }

  // 通用设置方法
  private set<T>(key: string, data: T, customTtl?: number): void {
    const cacheKey = this.buildKey(key);
    const ttl = customTtl || this.config.ttlSeconds;
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + (ttl * 1000),
      hits: 0,
    };

    // 检查是否需要清理空间
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(cacheKey)) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(cacheKey, entry);
    this.updateStats('size', this.cache.size);
  }

  // 删除缓存条目
  delete(key: string): boolean {
    // 尝试所有可能的前缀，因为key可能是基础形式
    const possibleKeys = [
      this.buildKey(key),
      this.buildKey(`stock_basic_${key}`),
      this.buildKey(`stock_daily_${key}`)
    ];
    
    let deleted = false;
    for (const cacheKey of possibleKeys) {
      if (this.cache.delete(cacheKey)) {
        deleted = true;
        break;
      }
    }
    
    if (deleted) {
      this.updateStats('size', this.cache.size);
    }
    return deleted;
  }

  // 清空缓存
  clear(): void {
    this.cache.clear();
    this.resetStats();
  }

  // 获取缓存统计
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // 获取缓存大小
  getSize(): number {
    return this.cache.size;
  }

  // 检查缓存是否包含某个键
  has(key: string): boolean {
    // 尝试所有可能的前缀，因为key可能是基础形式
    const possibleKeys = [
      this.buildKey(key),
      this.buildKey(`stock_basic_${key}`),
      this.buildKey(`stock_daily_${key}`)
    ];
    
    for (const cacheKey of possibleKeys) {
      const entry = this.cache.get(cacheKey);
      
      if (entry) {
        if (this.isExpired(entry)) {
          this.cache.delete(cacheKey);
          continue;
        }
        return true;
      }
    }

    return false;
  }

  // 获取所有缓存键
  getKeys(): string[] {
    return Array.from(this.cache.keys())
      .map(key => key.replace(`${this.config.keyPrefix}:`, ''));
  }

  // 手动触发过期清理
  cleanupExpired(): number {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
        this.updateStats('eviction');
      }
    }

    this.updateStats('size', this.cache.size);
    return cleanedCount;
  }

  // 构建缓存键
  private buildKey(key: string): string {
    return `${this.config.keyPrefix}:${key}`;
  }

  // 检查条目是否过期
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() > entry.expiresAt;
  }

  // 驱逐最少使用的条目
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();
    let leastHits = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // 优先驱逐命中次数最少的
      if (entry.hits < leastHits) {
        leastHits = entry.hits;
        oldestKey = key;
        oldestTimestamp = entry.timestamp;
      } else if (entry.hits === leastHits && entry.timestamp < oldestTimestamp) {
        // 命中次数相同时，驱逐最旧的
        oldestKey = key;
        oldestTimestamp = entry.timestamp;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.updateStats('eviction');
    }
  }

  // 更新统计信息
  private updateStats(type: 'hit' | 'miss' | 'eviction' | 'operation' | 'size', value?: number): void {
    if (!this.config.enableStats) return;

    switch (type) {
      case 'hit':
        this.stats.hits++;
        break;
      case 'miss':
        this.stats.misses++;
        break;
      case 'eviction':
        this.stats.evictions++;
        break;
      case 'operation':
        this.stats.totalOperations++;
        break;
      case 'size':
        this.stats.size = value || this.cache.size;
        break;
    }

    // 更新命中率
    if (this.stats.totalOperations > 0) {
      this.stats.hitRate = this.stats.hits / this.stats.totalOperations;
    }
  }

  // 重置统计信息
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
      totalOperations: 0,
      size: 0,
    };
  }

  // 启动定时清理任务
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpired();
    }, 60000); // 每分钟清理一次过期条目
  }

  // 获取缓存配置
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  // 更新配置
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 销毁缓存管理器
  destroy(): void {
    this.cache.clear();
    this.resetStats();
  }
}

// 默认缓存配置
const defaultCacheConfig: CacheConfig = {
  ttlSeconds: 24 * 60 * 60, // 24小时
  maxEntries: 10000, // 最多10000个条目
  enableStats: true,
  keyPrefix: "neostock_data",
};

// 全局缓存管理器实例
export const dataCacheManager = new DataCacheManager(defaultCacheConfig);