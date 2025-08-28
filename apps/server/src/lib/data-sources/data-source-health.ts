import type { 
  DataSourceHealth 
} from "../../types/data-sources";
import { AbstractDataSource } from "./abstract-data-source";

// 健康检查结果历史记录
export interface HealthCheckHistory {
  timestamp: Date;
  isHealthy: boolean;
  responseTime?: number;
  errorMessage?: string;
}

// 数据源健康监控服务
export class DataSourceHealthMonitor {
  private healthHistory: Map<string, HealthCheckHistory[]> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private maxHistorySize = 100; // 保留最近100次检查记录
  private listeners: Map<string, Array<(health: DataSourceHealth) => void>> = new Map();

  constructor() {
    // 定期清理过期历史记录 (每小时)
    setInterval(() => {
      this.cleanupHistory();
    }, 3600000);
  }

  // 启动数据源监控
  startMonitoring(dataSource: AbstractDataSource): void {
    const name = dataSource.getName();
    const config = dataSource.getConfig();

    // 清除现有监控
    this.stopMonitoring(name);

    console.log(`🔍 开始监控数据源: ${name}，检查间隔: ${config.healthCheck?.interval || 30000}ms`);

    // 立即执行一次健康检查
    this.performHealthCheck(dataSource);

    // 设置定期健康检查
    const intervalId = setInterval(async () => {
      await this.performHealthCheck(dataSource);
    }, config.healthCheck?.interval || 30000);

    this.monitoringIntervals.set(name, intervalId);
  }

  // 停止监控
  stopMonitoring(dataSourceName: string): void {
    const intervalId = this.monitoringIntervals.get(dataSourceName);
    if (intervalId) {
      clearInterval(intervalId);
      this.monitoringIntervals.delete(dataSourceName);
      console.log(`⏸️  停止监控数据源: ${dataSourceName}`);
    }
  }

  // 停止所有监控
  stopAllMonitoring(): void {
    for (const [name, intervalId] of this.monitoringIntervals.entries()) {
      clearInterval(intervalId);
      console.log(`⏸️  停止监控数据源: ${name}`);
    }
    this.monitoringIntervals.clear();
  }

  // 执行健康检查
  private async performHealthCheck(dataSource: AbstractDataSource): Promise<void> {
    const name = dataSource.getName();
    
    try {
      const health = await dataSource.healthCheck();
      
      // 记录检查历史
      this.recordHealthCheck(name, {
        timestamp: health.lastChecked || new Date(),
        isHealthy: health.isHealthy,
        responseTime: health.responseTime,
        errorMessage: health.errorMessage,
      });

      // 通知监听器
      this.notifyListeners(name, health);

      // 记录日志
      if (health.isHealthy) {
        console.log(`✅ ${name} 健康检查通过，响应时间: ${health.responseTime}ms`);
      } else {
        console.warn(`❌ ${name} 健康检查失败: ${health.errorMessage}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`💥 ${name} 健康检查异常: ${errorMessage}`);
      
      // 记录异常
      this.recordHealthCheck(name, {
        timestamp: new Date(),
        isHealthy: false,
        errorMessage,
      });
    }
  }

  // 记录健康检查结果
  private recordHealthCheck(dataSourceName: string, record: HealthCheckHistory): void {
    let history = this.healthHistory.get(dataSourceName);
    if (!history) {
      history = [];
      this.healthHistory.set(dataSourceName, history);
    }

    history.push(record);

    // 限制历史记录大小
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  // 获取健康状态
  getHealthStatus(dataSourceName: string): DataSourceHealth | null {
    const history = this.healthHistory.get(dataSourceName);
    if (!history || history.length === 0) {
      return null;
    }

    const latest = history[history.length - 1];
    const consecutiveFailures = this.calculateConsecutiveFailures(history);

    return {
      name: dataSourceName,
      isHealthy: latest.isHealthy,
      lastChecked: latest.timestamp,
      responseTime: latest.responseTime,
      errorMessage: latest.errorMessage,
      consecutiveFailures,
    };
  }

  // 获取所有数据源健康状态
  getAllHealthStatus(): Map<string, DataSourceHealth> {
    const statusMap = new Map<string, DataSourceHealth>();
    
    for (const dataSourceName of this.healthHistory.keys()) {
      const status = this.getHealthStatus(dataSourceName);
      if (status) {
        statusMap.set(dataSourceName, status);
      }
    }

    return statusMap;
  }

  // 获取健康历史
  getHealthHistory(
    dataSourceName: string, 
    limit: number = 50
  ): HealthCheckHistory[] {
    const history = this.healthHistory.get(dataSourceName);
    if (!history) {
      return [];
    }

    return history.slice(-limit).reverse(); // 最新的在前
  }

  // 计算连续失败次数
  private calculateConsecutiveFailures(history: HealthCheckHistory[]): number {
    let failures = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].isHealthy) {
        break;
      }
      failures++;
    }
    return failures;
  }

  // 获取可用性统计
  getAvailabilityStats(
    dataSourceName: string, 
    hours: number = 24
  ): {
    totalChecks: number;
    successfulChecks: number;
    availabilityPercentage: number;
    averageResponseTime: number;
    uptimeHours: number;
  } {
    const history = this.healthHistory.get(dataSourceName);
    if (!history) {
      return {
        totalChecks: 0,
        successfulChecks: 0,
        availabilityPercentage: 0,
        averageResponseTime: 0,
        uptimeHours: 0,
      };
    }

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentHistory = history.filter(h => h.timestamp > cutoffTime);

    const totalChecks = recentHistory.length;
    const successfulChecks = recentHistory.filter(h => h.isHealthy).length;
    const availabilityPercentage = totalChecks > 0 ? 
      Math.round((successfulChecks / totalChecks) * 100) : 0;

    // 计算平均响应时间 (只计算成功的请求)
    const responseTimes = recentHistory
      .filter(h => h.isHealthy && h.responseTime != null)
      .map(h => h.responseTime!);
    
    const averageResponseTime = responseTimes.length > 0 ? 
      Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length) : 0;

    // 计算uptime小时数 (简化计算：假设每次检查代表检查间隔时间的可用性)
    const uptimeHours = Math.round((successfulChecks / totalChecks) * hours * 100) / 100;

    return {
      totalChecks,
      successfulChecks,
      availabilityPercentage,
      averageResponseTime,
      uptimeHours,
    };
  }

  // 检测数据源是否处于故障状态
  isDataSourceFailed(dataSourceName: string, failureThreshold: number = 3): boolean {
    const status = this.getHealthStatus(dataSourceName);
    return status ? status.consecutiveFailures >= failureThreshold : false;
  }

  // 获取故障数据源列表
  getFailedDataSources(failureThreshold: number = 3): string[] {
    const failedSources: string[] = [];
    
    for (const dataSourceName of this.healthHistory.keys()) {
      if (this.isDataSourceFailed(dataSourceName, failureThreshold)) {
        failedSources.push(dataSourceName);
      }
    }

    return failedSources;
  }

  // 添加健康状态变更监听器
  addHealthListener(
    dataSourceName: string, 
    listener: (health: DataSourceHealth) => void
  ): void {
    let listeners = this.listeners.get(dataSourceName);
    if (!listeners) {
      listeners = [];
      this.listeners.set(dataSourceName, listeners);
    }
    listeners.push(listener);
  }

  // 移除监听器
  removeHealthListener(
    dataSourceName: string, 
    listener: (health: DataSourceHealth) => void
  ): void {
    const listeners = this.listeners.get(dataSourceName);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // 通知监听器
  private notifyListeners(dataSourceName: string, health: DataSourceHealth): void {
    const listeners = this.listeners.get(dataSourceName);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(health);
        } catch (error) {
          console.error(`健康监听器执行失败:`, error);
        }
      });
    }
  }

  // 清理过期历史记录
  private cleanupHistory(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [name, history] of this.healthHistory.entries()) {
      const originalLength = history.length;
      const filteredHistory = history.filter(h => h.timestamp > oneWeekAgo);
      
      if (filteredHistory.length < originalLength) {
        this.healthHistory.set(name, filteredHistory);
        cleanedCount += originalLength - filteredHistory.length;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 清理了 ${cleanedCount} 条过期健康检查记录`);
    }
  }

  // 导出健康数据
  exportHealthData(): {
    timestamp: string;
    dataSources: Array<{
      name: string;
      currentStatus: DataSourceHealth | null;
      availabilityStats: ReturnType<DataSourceHealthMonitor["getAvailabilityStats"]>;
      recentHistory: HealthCheckHistory[];
    }>;
  } {
    const dataSources: Array<{
      name: string;
      currentStatus: DataSourceHealth | null;
      availabilityStats: ReturnType<DataSourceHealthMonitor["getAvailabilityStats"]>;
      recentHistory: HealthCheckHistory[];
    }> = [];

    for (const dataSourceName of this.healthHistory.keys()) {
      dataSources.push({
        name: dataSourceName,
        currentStatus: this.getHealthStatus(dataSourceName),
        availabilityStats: this.getAvailabilityStats(dataSourceName),
        recentHistory: this.getHealthHistory(dataSourceName, 20),
      });
    }

    return {
      timestamp: new Date().toISOString(),
      dataSources,
    };
  }

  // 重置所有数据
  reset(): void {
    this.stopAllMonitoring();
    this.healthHistory.clear();
    this.listeners.clear();
    console.log("🔄 数据源健康监控器已重置");
  }
}

// 全局健康监控器实例
export const dataSourceHealthMonitor = new DataSourceHealthMonitor();