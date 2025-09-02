import type { Stock } from '@/hooks/use-stocks';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
}

export class SearchCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      ...config,
    };

    this.startCleanupTimer();
  }

  private getKey(type: string, params: Record<string, unknown>): string {
    return `${type}:${JSON.stringify(params)}`;
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() > entry.expiresAt;
  }

  private cleanup(): void {
    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }

    // If still over max size, remove least recently used
    if (this.cache.size > this.config.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      const toRemove = entries.slice(0, this.cache.size - this.config.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const fullKey = this.getKey('search', { key });
    const currentTime = Date.now();
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: currentTime,
      expiresAt: currentTime + (ttl || this.config.defaultTTL),
      accessCount: 1,
      lastAccessed: currentTime,
    };

    this.cache.set(fullKey, entry);
  }

  get<T>(key: string): T | null {
    const fullKey = this.getKey('search', { key });
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(fullKey);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data as T;
  }

  has(key: string): boolean {
    const fullKey = this.getKey('search', { key });
    const entry = this.cache.get(fullKey);
    
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(fullKey);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    const fullKey = this.getKey('search', { key });
    this.cache.delete(fullKey);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): {
    size: number;
    hitRate: number;
    totalAccesses: number;
    expiredEntries: number;
  } {
    let totalAccesses = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      totalAccesses += entry.accessCount;
      if (this.isExpired(entry)) {
        expiredEntries++;
      }
    }

    return {
      size: this.cache.size,
      hitRate: totalAccesses > 0 ? (this.cache.size - expiredEntries) / totalAccesses : 0,
      totalAccesses,
      expiredEntries,
    };
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// Global search cache instance
export const searchCache = new SearchCache({
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000, // 1 minute
});

// Specialized cache for search results with intelligent prefetching
export class SearchResultsCache {
  private cache = new SearchCache();
  private prefetchQueue = new Set<string>();
  private prefetchTimer?: NodeJS.Timeout;

  async getSearchResults(query: string, fetchFn: () => Promise<Stock[]>): Promise<Stock[]> {
    // Check cache first
    const cached = this.cache.get<Stock[]>(query);
    if (cached) {
      return cached;
    }

    // Fetch fresh data
    const results = await fetchFn();
    
    // Cache with different TTL based on query length
    const ttl = query.length <= 2 ? 2 * 60 * 1000 : 5 * 60 * 1000;
    this.cache.set(query, results, ttl);

    // Prefetch related queries
    this.schedulePrefetch(query, results);

    return results;
  }

  private schedulePrefetch(query: string, results: Stock[]): void {
    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
    }

    this.prefetchTimer = setTimeout(() => {
      this.prefetchRelatedQueries(query, results);
    }, 1000); // Prefetch after 1 second
  }

  private async prefetchRelatedQueries(query: string, results: Stock[]): Promise<void> {
    const relatedQueries = this.generateRelatedQueries(query, results);
    
    for (const relatedQuery of relatedQueries) {
      if (this.prefetchQueue.has(relatedQuery)) {
        continue;
      }

      this.prefetchQueue.add(relatedQuery);
      
      // Simulate prefetch - in real implementation, this would call the API
      setTimeout(() => {
        this.prefetchQueue.delete(relatedQuery);
      }, 100);
    }
  }

  private generateRelatedQueries(query: string, results: Stock[]): string[] {
    const queries = new Set<string>();
    
    // Add partial queries
    for (let i = 1; i < query.length; i++) {
      queries.add(query.substring(0, i));
    }

    // Add industry-based queries
    const industries = new Set(results.map(stock => stock.industry));
    industries.forEach(industry => {
      queries.add(industry.substring(0, 2));
    });

    // Add stock code variations
    results.forEach(stock => {
      if (stock.code.length > 2) {
        queries.add(stock.code.substring(0, 2));
      }
    });

    return Array.from(queries).slice(0, 5); // Limit prefetching
  }

  getStats() {
    return {
      cache: this.cache.getStats(),
      prefetchQueueSize: this.prefetchQueue.size,
    };
  }

  clear(): void {
    this.cache.clear();
    this.prefetchQueue.clear();
  }
}

export const searchResultsCache = new SearchResultsCache();