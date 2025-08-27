import type {
  StockBasicInfo,
  StockDailyData,
  DataFetchRequest,
  DataFetchResponse,
  DataSourceSwitchStrategy,
} from "../../types/data-sources";
import {
  SwitchTrigger,
  DataSourceError,
  DataSourceErrorType,
} from "../../types/data-sources";
import { AbstractDataSource } from "./abstract-data-source";
import { dataSourceConfigManager } from "./data-source-config";
import { dataSourceHealthMonitor } from "./data-source-health";

// 切换事件接口
export interface DataSourceSwitchEvent {
  timestamp: Date;
  fromSource: string;
  toSource: string;
  trigger: SwitchTrigger;
  reason: string;
}

// 数据源管理器
export class DataSourceManager {
  private dataSources: Map<string, AbstractDataSource> = new Map();
  private currentPrimarySource: string | null = null;
  private switchStrategy: DataSourceSwitchStrategy;
  private switchHistory: DataSourceSwitchEvent[] = [];
  private maxSwitchHistory = 100;
  private switchInProgress = false;
  private lastSwitchTime = 0;
  private switchCooldown = 60000; // 1分钟切换冷却时间

  // 事件监听器
  private switchListeners: Array<(event: DataSourceSwitchEvent) => void> = [];

  constructor() {
    // 默认切换策略
    this.switchStrategy = {
      trigger: SwitchTrigger.HEALTH_CHECK_FAILED,
      fallbackOrder: dataSourceConfigManager.getBackupDataSources(),
      switchDelay: 5000, // 5秒延迟
      recoverDelay: 300000, // 5分钟恢复检查
    };

    // 监听健康状态变化
    this.setupHealthListeners();
  }

  // 注册数据源
  registerDataSource(dataSource: AbstractDataSource): void {
    const name = dataSource.getName();
    this.dataSources.set(name, dataSource);
    
    console.log(`📋 注册数据源: ${name}`);

    // 如果这是第一个数据源或优先级更高，设为主数据源
    if (!this.currentPrimarySource || this.shouldSetAsPrimary(dataSource)) {
      this.currentPrimarySource = name;
      console.log(`🎯 设置主数据源: ${name}`);
    }

    // 启动健康监控
    dataSourceHealthMonitor.startMonitoring(dataSource);
  }

  // 注销数据源
  unregisterDataSource(name: string): void {
    const dataSource = this.dataSources.get(name);
    if (!dataSource) {
      return;
    }

    this.dataSources.delete(name);
    dataSourceHealthMonitor.stopMonitoring(name);

    console.log(`📤 注销数据源: ${name}`);

    // 如果注销的是当前主数据源，需要切换
    if (this.currentPrimarySource === name) {
      this.switchToPrimaryDataSource("数据源被注销");
    }
  }

  // 获取股票基础信息
  async getStockBasicInfo(request?: DataFetchRequest): Promise<DataFetchResponse<StockBasicInfo>> {
    return this.executeWithFallback(
      (dataSource) => dataSource.getStockBasicInfo(request),
      "获取股票基础信息"
    );
  }

  // 获取股票日线数据
  async getStockDailyData(request?: DataFetchRequest): Promise<DataFetchResponse<StockDailyData>> {
    return this.executeWithFallback(
      (dataSource) => dataSource.getStockDailyData(request),
      "获取股票日线数据"
    );
  }

  // 带故障转移的操作执行
  private async executeWithFallback<T>(
    operation: (dataSource: AbstractDataSource) => Promise<DataFetchResponse<T>>,
    operationName: string
  ): Promise<DataFetchResponse<T>> {
    const sources = this.getOrderedDataSources();
    const errors: Array<{ source: string; error: Error }> = [];

    for (const sourceName of sources) {
      const dataSource = this.dataSources.get(sourceName);
      if (!dataSource) {
        continue;
      }

      try {
        console.log(`🔄 尝试使用数据源 ${sourceName} ${operationName}`);
        const result = await operation(dataSource);
        
        // 如果这不是主数据源但操作成功，记录成功使用备用数据源
        if (sourceName !== this.currentPrimarySource) {
          console.log(`✅ 备用数据源 ${sourceName} 操作成功`);
        }

        return result;

      } catch (error) {
        const err = error as Error;
        errors.push({ source: sourceName, error: err });
        
        console.warn(`⚠️  数据源 ${sourceName} ${operationName}失败: ${err.message}`);

        // 如果是主数据源失败，触发切换检查
        if (sourceName === this.currentPrimarySource) {
          await this.handlePrimarySourceFailure(err, operationName);
        }
      }
    }

    // 所有数据源都失败
    const errorMessages = errors.map(e => `${e.source}: ${e.error.message}`).join("; ");
    throw new DataSourceError(
      DataSourceErrorType.NETWORK_ERROR,
      `所有数据源${operationName}都失败: ${errorMessages}`
    );
  }

  // 处理主数据源失败
  private async handlePrimarySourceFailure(error: Error, context: string): Promise<void> {
    if (this.switchInProgress) {
      return; // 避免重复切换
    }

    // 检查是否在冷却期内
    const now = Date.now();
    if (now - this.lastSwitchTime < this.switchCooldown) {
      console.log(`⏰ 数据源切换在冷却期内，跳过切换`);
      return;
    }

    const errorType = this.classifyErrorForSwitch(error);
    
    // 判断是否需要切换
    if (this.shouldTriggerSwitch(errorType)) {
      console.log(`🚨 主数据源失败，准备切换: ${error.message}`);
      await this.performDataSourceSwitch(
        SwitchTrigger.REQUEST_FAILED,
        `${context}请求失败: ${error.message}`
      );
    }
  }

  // 执行数据源切换
  private async performDataSourceSwitch(
    trigger: SwitchTrigger,
    reason: string
  ): Promise<void> {
    if (this.switchInProgress) {
      return;
    }

    this.switchInProgress = true;
    this.lastSwitchTime = Date.now();

    try {
      const oldSource = this.currentPrimarySource;
      const newSource = await this.findBestAlternativeSource();

      if (!newSource || newSource === oldSource) {
        console.warn(`⚠️  没有可用的替代数据源`);
        return;
      }

      // 延迟切换
      if (this.switchStrategy.switchDelay > 0) {
        console.log(`⏳ 延迟 ${this.switchStrategy.switchDelay}ms 后切换数据源`);
        await this.sleep(this.switchStrategy.switchDelay);
      }

      // 执行切换
      const previousSource = this.currentPrimarySource;
      this.currentPrimarySource = newSource;

      // 记录切换事件
      const switchEvent: DataSourceSwitchEvent = {
        timestamp: new Date(),
        fromSource: previousSource || "none",
        toSource: newSource,
        trigger,
        reason,
      };

      this.recordSwitchEvent(switchEvent);

      console.log(`🔄 数据源已切换: ${previousSource} → ${newSource} (原因: ${reason})`);

      // 通知监听器
      this.notifySwitchListeners(switchEvent);

      // 安排恢复检查
      this.scheduleRecoveryCheck(previousSource || "");

    } finally {
      this.switchInProgress = false;
    }
  }

  // 查找最佳替代数据源
  private async findBestAlternativeSource(): Promise<string | null> {
    const fallbackSources = this.switchStrategy.fallbackOrder;
    const healthStatuses = dataSourceHealthMonitor.getAllHealthStatus();

    for (const sourceName of fallbackSources) {
      // 检查数据源是否已注册
      if (!this.dataSources.has(sourceName)) {
        continue;
      }

      // 检查健康状态
      const health = healthStatuses.get(sourceName);
      if (health && health.isHealthy) {
        return sourceName;
      }

      // 如果没有健康数据，尝试立即检查
      const dataSource = this.dataSources.get(sourceName);
      if (dataSource) {
        try {
          const health = await dataSource.healthCheck();
          if (health.isHealthy) {
            return sourceName;
          }
        } catch (error) {
          console.warn(`数据源 ${sourceName} 健康检查失败:`, error);
        }
      }
    }

    return null;
  }

  // 安排恢复检查
  private scheduleRecoveryCheck(failedSource: string): void {
    setTimeout(async () => {
      await this.checkSourceRecovery(failedSource);
    }, this.switchStrategy.recoverDelay);
  }

  // 检查数据源恢复
  private async checkSourceRecovery(sourceName: string): Promise<void> {
    const dataSource = this.dataSources.get(sourceName);
    if (!dataSource) {
      return;
    }

    try {
      const health = await dataSource.healthCheck();
      if (health.isHealthy) {
        // 如果原来是优先级更高的数据源，考虑切换回去
        if (this.shouldSwitchBackTo(sourceName)) {
          console.log(`🔄 数据源 ${sourceName} 已恢复，准备切换回去`);
          await this.performDataSourceSwitch(
            SwitchTrigger.MANUAL,
            `数据源 ${sourceName} 恢复健康`
          );
        }
      }
    } catch (error) {
      console.log(`数据源 ${sourceName} 尚未恢复:`, error);
      
      // 继续安排下一次恢复检查
      this.scheduleRecoveryCheck(sourceName);
    }
  }

  // 判断是否应该切换回特定数据源
  private shouldSwitchBackTo(sourceName: string): boolean {
    const sourceConfig = dataSourceConfigManager.getConfig(sourceName);
    const currentConfig = this.currentPrimarySource ? 
      dataSourceConfigManager.getConfig(this.currentPrimarySource) : null;

    if (!sourceConfig || !currentConfig) {
      return false;
    }

    // 优先级更高（数字更小）才考虑切换回去
    return sourceConfig.priority < currentConfig.priority;
  }

  // 手动切换主数据源
  async switchToPrimaryDataSource(reason: string = "手动切换"): Promise<boolean> {
    const primarySource = dataSourceConfigManager.getPrimaryDataSource();
    
    if (!primarySource || primarySource === this.currentPrimarySource) {
      return false;
    }

    if (!this.dataSources.has(primarySource)) {
      console.warn(`主数据源 ${primarySource} 未注册`);
      return false;
    }

    await this.performDataSourceSwitch(SwitchTrigger.MANUAL, reason);
    return true;
  }

  // 手动切换到指定数据源
  async switchToDataSource(sourceName: string, reason: string = "手动指定"): Promise<boolean> {
    if (!this.dataSources.has(sourceName)) {
      console.warn(`数据源 ${sourceName} 未注册`);
      return false;
    }

    if (sourceName === this.currentPrimarySource) {
      return true; // 已经是当前数据源
    }

    // 检查目标数据源健康状态
    const dataSource = this.dataSources.get(sourceName)!;
    try {
      const health = await dataSource.healthCheck();
      if (!health.isHealthy) {
        console.warn(`目标数据源 ${sourceName} 不健康: ${health.errorMessage}`);
        return false;
      }
    } catch (error) {
      console.warn(`无法检查目标数据源 ${sourceName} 健康状态:`, error);
      return false;
    }

    this.currentPrimarySource = sourceName;
    
    const switchEvent: DataSourceSwitchEvent = {
      timestamp: new Date(),
      fromSource: this.currentPrimarySource || "none",
      toSource: sourceName,
      trigger: SwitchTrigger.MANUAL,
      reason,
    };

    this.recordSwitchEvent(switchEvent);
    this.notifySwitchListeners(switchEvent);

    console.log(`✅ 手动切换到数据源: ${sourceName}`);
    return true;
  }

  // 获取当前主数据源
  getCurrentPrimarySource(): string | null {
    return this.currentPrimarySource;
  }

  // 获取所有注册的数据源
  getRegisteredDataSources(): string[] {
    return Array.from(this.dataSources.keys());
  }

  // 获取按优先级排序的数据源
  private getOrderedDataSources(): string[] {
    const current = this.currentPrimarySource;
    const others = dataSourceConfigManager
      .getDataSourcesByPriority()
      .filter(name => name !== current && this.dataSources.has(name));

    return current ? [current, ...others] : others;
  }

  // 判断是否应该设为主数据源
  private shouldSetAsPrimary(dataSource: AbstractDataSource): boolean {
    if (!this.currentPrimarySource) {
      return true;
    }

    const currentConfig = dataSourceConfigManager.getConfig(this.currentPrimarySource);
    const newConfig = dataSource.getConfig();

    return newConfig.priority < (currentConfig?.priority ?? Infinity);
  }

  // 设置健康监听器
  private setupHealthListeners(): void {
    // 这里可以为所有数据源设置通用的健康监听器
    // 实际实现会在数据源注册时为每个源单独设置
  }

  // 错误分类用于切换决策
  private classifyErrorForSwitch(error: Error): DataSourceErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return DataSourceErrorType.TIMEOUT_ERROR;
    if (message.includes('network') || message.includes('enotfound')) 
      return DataSourceErrorType.NETWORK_ERROR;
    if (message.includes('rate limit')) return DataSourceErrorType.RATE_LIMIT_ERROR;
    if (message.includes('unauthorized')) return DataSourceErrorType.AUTH_ERROR;
    if (message.includes('quota')) return DataSourceErrorType.API_QUOTA_EXCEEDED;
    
    return DataSourceErrorType.NETWORK_ERROR;
  }

  // 判断错误是否应该触发切换
  private shouldTriggerSwitch(errorType: DataSourceErrorType): boolean {
    const nonSwitchableErrors = [
      DataSourceErrorType.INVALID_PARAMS,
      DataSourceErrorType.DATA_FORMAT_ERROR,
    ];

    return !nonSwitchableErrors.includes(errorType);
  }

  // 记录切换事件
  private recordSwitchEvent(event: DataSourceSwitchEvent): void {
    this.switchHistory.push(event);

    // 限制历史记录大小
    if (this.switchHistory.length > this.maxSwitchHistory) {
      this.switchHistory.splice(0, this.switchHistory.length - this.maxSwitchHistory);
    }
  }

  // 获取切换历史
  getSwitchHistory(limit: number = 50): DataSourceSwitchEvent[] {
    return this.switchHistory.slice(-limit).reverse();
  }

  // 添加切换监听器
  addSwitchListener(listener: (event: DataSourceSwitchEvent) => void): void {
    this.switchListeners.push(listener);
  }

  // 移除切换监听器
  removeSwitchListener(listener: (event: DataSourceSwitchEvent) => void): void {
    const index = this.switchListeners.indexOf(listener);
    if (index !== -1) {
      this.switchListeners.splice(index, 1);
    }
  }

  // 通知切换监听器
  private notifySwitchListeners(event: DataSourceSwitchEvent): void {
    for (const listener of this.switchListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('切换监听器执行失败:', error);
      }
    }
  }

  // 获取数据源状态摘要
  getDataSourceSummary(): {
    currentPrimary: string | null;
    registeredSources: string[];
    healthySources: string[];
    failedSources: string[];
    recentSwitches: number;
  } {
    const healthStatuses = dataSourceHealthMonitor.getAllHealthStatus();
    const healthySources: string[] = [];
    const failedSources: string[] = [];

    for (const [name, health] of healthStatuses.entries()) {
      if (health.isHealthy) {
        healthySources.push(name);
      } else {
        failedSources.push(name);
      }
    }

    const recentSwitches = this.switchHistory.filter(
      event => Date.now() - event.timestamp.getTime() < 24 * 60 * 60 * 1000
    ).length;

    return {
      currentPrimary: this.currentPrimarySource,
      registeredSources: this.getRegisteredDataSources(),
      healthySources,
      failedSources,
      recentSwitches,
    };
  }

  // 更新切换策略
  updateSwitchStrategy(strategy: Partial<DataSourceSwitchStrategy>): void {
    this.switchStrategy = {
      ...this.switchStrategy,
      ...strategy,
    };

    console.log('📋 数据源切换策略已更新:', this.switchStrategy);
  }

  // 工具方法：延迟
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 清理资源
  destroy(): void {
    dataSourceHealthMonitor.stopAllMonitoring();
    this.dataSources.clear();
    this.switchListeners.length = 0;
    this.switchHistory.length = 0;
    console.log('🧹 数据源管理器已清理');
  }
}

// 全局数据源管理器实例
export const dataSourceManager = new DataSourceManager();