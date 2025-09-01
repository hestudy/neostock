import { DataSourceManager } from '../data-sources/data-source-manager.js';
import type { StockBasicInfo } from '../../types/data-sources.js';

export interface SchedulerConfig {
  cronExpression: string;
  batchSize: number;
  retryAttempts: number;
  enabled: boolean;
}

export interface SyncResult {
  success: boolean;
  processedStocks: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

export class DataSyncScheduler {
  private intervalId: Timer | null = null;
  private isRunning = false;

  constructor(
    private dataSourceManager: DataSourceManager,
    private config: SchedulerConfig = {
      cronExpression: '0 17 * * *', // 每日下午5点
      batchSize: 100,
      retryAttempts: 3,
      enabled: true
    }
  ) {}

  public start(): void {
    if (!this.config.enabled || this.intervalId) {
      return;
    }

    // 简化实现: 每小时检查一次是否需要执行
    this.intervalId = setInterval(() => {
      const now = new Date();
      // 检查是否为下午5点（17:00）
      if (now.getHours() === 17 && now.getMinutes() < 5) {
        this.executeDailySync();
      }
    }, 5 * 60 * 1000); // 每5分钟检查一次
  }

  public async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // 无论如何都等待一下，确保所有异步操作完成
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  public async executeDailySync(): Promise<SyncResult> {
    if (this.isRunning) {
      throw new Error('数据同步正在进行中');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let processedStocks = 0;

    try {
      // 获取股票基础信息
      const stocksResponse = await this.dataSourceManager.fetchStockBasicInfo();
      const stocksData = stocksResponse.data;
      
      // 批量处理股票数据
      for (let i = 0; i < stocksData.length; i += this.config.batchSize) {
        const batch = stocksData.slice(i, i + this.config.batchSize);
        
        await Promise.allSettled(
          batch.map(async (stock: StockBasicInfo) => {
            try {
              // 获取日线数据
              await this.dataSourceManager.fetchDailyData({
                symbol: stock.ts_code,
                startDate: this.getTodayDateString(),
                endDate: this.getTodayDateString()
              });
              processedStocks++;
            } catch (error) {
              errors.push(`股票 ${stock.ts_code} 处理失败: ${error}`);
            }
          })
        );

        // 批次间短暂延迟，避免API限制
        await this.delay(1000);
      }

      return {
        success: errors.length === 0,
        processedStocks,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

    } catch (error) {
      errors.push(`同步失败: ${error}`);
      return {
        success: false,
        processedStocks,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    } finally {
      this.isRunning = false;
    }
  }

  public async triggerManualSync(): Promise<SyncResult> {
    return this.executeDailySync();
  }

  public isSchedulerRunning(): boolean {
    return this.intervalId !== null;
  }

  public isSyncRunning(): boolean {
    return this.isRunning;
  }

  private getTodayDateString(): string {
    const today = new Date();
    return today.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}