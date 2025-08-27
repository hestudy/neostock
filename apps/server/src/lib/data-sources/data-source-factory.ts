import { AbstractDataSource } from "./abstract-data-source";
import { TushareDataSource } from "./tushare-data-source";
import { SinaDataSource } from "./sina-data-source";
import { dataSourceConfigManager } from "./data-source-config";
import { dataSourceManager } from "./data-source-manager";
import { dataSourceHealthMonitor } from "./data-source-health";

// 数据源工厂类
export class DataSourceFactory {
  private static instance: DataSourceFactory | null = null;
  private initializedSources: Set<string> = new Set();
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  // 单例模式
  static getInstance(): DataSourceFactory {
    if (!DataSourceFactory.instance) {
      DataSourceFactory.instance = new DataSourceFactory();
    }
    return DataSourceFactory.instance;
  }

  // 创建数据源实例
  createDataSource(sourceName: string): AbstractDataSource {
    const config = dataSourceConfigManager.getConfig(sourceName);
    if (!config) {
      throw new Error(`数据源配置未找到: ${sourceName}`);
    }

    console.log(`🏭 创建数据源实例: ${sourceName}`);

    switch (sourceName.toLowerCase()) {
      case 'tushare':
        return new TushareDataSource();
      
      case 'sina':
        return new SinaDataSource();
      
      default:
        throw new Error(`不支持的数据源类型: ${sourceName}`);
    }
  }

  // 初始化数据源
  async initializeDataSource(sourceName: string): Promise<void> {
    if (this.initializedSources.has(sourceName)) {
      console.log(`📋 数据源 ${sourceName} 已初始化，跳过`);
      return;
    }

    try {
      console.log(`🚀 初始化数据源: ${sourceName}`);
      
      // 创建数据源实例
      const dataSource = this.createDataSource(sourceName);
      
      // 注册到管理器
      dataSourceManager.registerDataSource(dataSource);
      
      // 标记为已初始化
      this.initializedSources.add(sourceName);
      
      console.log(`✅ 数据源 ${sourceName} 初始化成功`);
      
    } catch (error) {
      console.error(`❌ 数据源 ${sourceName} 初始化失败:`, error);
      throw error;
    }
  }

  // 初始化所有配置的数据源
  async initializeAllDataSources(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeAllDataSources();
    return this.initializationPromise;
  }

  private async _initializeAllDataSources(): Promise<void> {
    console.log("🌟 开始初始化所有数据源");
    
    const configSummary = dataSourceConfigManager.getConfigSummary();
    const initResults: Array<{ name: string; success: boolean; error?: string }> = [];
    
    // 按优先级排序初始化
    const sortedConfigs = configSummary.sort((a, b) => a.priority - b.priority);
    
    for (const config of sortedConfigs) {
      try {
        // 检查配置状态
        if (config.status === 'missing_api_key') {
          console.warn(`⚠️  跳过数据源 ${config.name}: 缺少API密钥`);
          initResults.push({ 
            name: config.name, 
            success: false, 
            error: '缺少API密钥' 
          });
          continue;
        }
        
        if (config.status === 'invalid') {
          console.warn(`⚠️  跳过数据源 ${config.name}: 配置无效`);
          initResults.push({ 
            name: config.name, 
            success: false, 
            error: '配置无效' 
          });
          continue;
        }
        
        // 初始化数据源
        await this.initializeDataSource(config.name);
        initResults.push({ name: config.name, success: true });
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ 数据源 ${config.name} 初始化失败: ${errorMsg}`);
        initResults.push({ 
          name: config.name, 
          success: false, 
          error: errorMsg 
        });
      }
    }
    
    // 输出初始化结果汇总
    const successful = initResults.filter(r => r.success);
    const failed = initResults.filter(r => !r.success);
    
    console.log(`📊 数据源初始化完成:`);
    console.log(`  ✅ 成功: ${successful.length} 个 (${successful.map(r => r.name).join(', ')})`);
    
    if (failed.length > 0) {
      console.log(`  ❌ 失败: ${failed.length} 个`);
      failed.forEach(f => {
        console.log(`    - ${f.name}: ${f.error}`);
      });
    }
    
    // 如果没有任何数据源初始化成功，抛出错误
    if (successful.length === 0) {
      throw new Error("所有数据源初始化都失败，系统无法正常运行");
    }
    
    console.log("🎉 数据源系统初始化完成");
  }

  // 获取已初始化的数据源列表
  getInitializedDataSources(): string[] {
    return Array.from(this.initializedSources);
  }

  // 检查数据源是否已初始化
  isInitialized(sourceName: string): boolean {
    return this.initializedSources.has(sourceName);
  }

  // 重新初始化数据源
  async reinitializeDataSource(sourceName: string): Promise<void> {
    console.log(`🔄 重新初始化数据源: ${sourceName}`);
    
    // 先注销现有的数据源
    dataSourceManager.unregisterDataSource(sourceName);
    this.initializedSources.delete(sourceName);
    
    // 重新初始化
    await this.initializeDataSource(sourceName);
  }

  // 动态添加新的数据源类型 (扩展点)
  registerDataSourceType(
    typeName: string, 
    factoryFn: () => AbstractDataSource
  ): void {
    // 这里可以扩展支持更多数据源类型
    console.log(`📝 注册新数据源类型: ${typeName}`);
    // 实现存储factory函数的逻辑
    // 暂时不实现，预留扩展点
    void factoryFn;
  }

  // 获取系统状态
  getSystemStatus(): {
    totalConfigured: number;
    totalInitialized: number;
    healthy: number;
    failed: number;
    currentPrimary: string | null;
    details: Array<{
      name: string;
      initialized: boolean;
      healthy: boolean;
      isPrimary: boolean;
      priority: number;
    }>;
  } {
    const configs = dataSourceConfigManager.getConfigSummary();
    const healthStatuses = dataSourceHealthMonitor.getAllHealthStatus();
    const currentPrimary = dataSourceManager.getCurrentPrimarySource();
    
    const details = configs.map(config => {
      const isInitialized = this.isInitialized(config.name);
      const health = healthStatuses.get(config.name);
      
      return {
        name: config.name,
        initialized: isInitialized,
        healthy: health ? health.isHealthy : false,
        isPrimary: config.name === currentPrimary,
        priority: config.priority,
      };
    });
    
    return {
      totalConfigured: configs.length,
      totalInitialized: this.initializedSources.size,
      healthy: details.filter(d => d.healthy).length,
      failed: details.filter(d => d.initialized && !d.healthy).length,
      currentPrimary,
      details,
    };
  }

  // 执行系统健康检查
  async performSystemHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'critical';
    timestamp: Date;
    details: Array<{
      name: string;
      status: 'healthy' | 'unhealthy' | 'not_initialized';
      responseTime?: number;
      error?: string;
    }>;
    recommendations: string[];
  }> {
    console.log("🔍 执行系统健康检查");
    
    const configs = dataSourceConfigManager.getConfigSummary();
    const details: Array<{
      name: string;
      status: "healthy" | "unhealthy" | "not_initialized";
      responseTime?: number;
      error?: string;
    }> = [];
    const recommendations: string[] = [];
    
    for (const config of configs) {
      if (!this.isInitialized(config.name)) {
        details.push({
          name: config.name,
          status: 'not_initialized',
        });
        continue;
      }
      
      try {
        const dataSource = dataSourceManager['dataSources']?.get(config.name);
        if (dataSource) {
          const startTime = Date.now();
          const health = await dataSource.healthCheck();
          const responseTime = Date.now() - startTime;
          
          details.push({
            name: config.name,
            status: health.isHealthy ? 'healthy' : 'unhealthy',
            responseTime,
            error: health.errorMessage,
          });
        } else {
          details.push({
            name: config.name,
            status: 'not_initialized',
          });
        }
      } catch (error) {
        details.push({
          name: config.name,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    // 评估整体状态
    const healthyCount = details.filter(d => d.status === 'healthy').length;
    const totalInitialized = details.filter(d => d.status !== 'not_initialized').length;
    
    let overall: 'healthy' | 'degraded' | 'critical';
    
    if (healthyCount === 0) {
      overall = 'critical';
      recommendations.push("所有数据源都不健康，请检查网络连接和API配置");
    } else if (healthyCount === totalInitialized) {
      overall = 'healthy';
    } else {
      overall = 'degraded';
      recommendations.push("部分数据源不健康，系统运行在降级模式");
    }
    
    // 添加具体建议
    const currentPrimary = dataSourceManager.getCurrentPrimarySource();
    const primaryDetail = details.find(d => d.name === currentPrimary);
    
    if (primaryDetail && primaryDetail.status !== 'healthy') {
      recommendations.push("主数据源不健康，建议手动切换到健康的备用数据源");
    }
    
    const notInitialized = details.filter(d => d.status === 'not_initialized');
    if (notInitialized.length > 0) {
      recommendations.push(`未初始化的数据源: ${notInitialized.map(d => d.name).join(', ')}`);
    }
    
    return {
      overall,
      timestamp: new Date(),
      details,
      recommendations,
    };
  }

  // 清理和重置
  reset(): void {
    this.initializedSources.clear();
    this.initializationPromise = null;
    dataSourceManager.destroy();
    console.log("🧹 数据源工厂已重置");
  }
}

// 数据源系统启动函数
export async function initializeDataSourceSystem(): Promise<void> {
  const factory = DataSourceFactory.getInstance();
  await factory.initializeAllDataSources();
  
  // 添加系统切换监听器
  dataSourceManager.addSwitchListener((event) => {
    console.log(`🔄 数据源切换: ${event.fromSource} → ${event.toSource} (${event.reason})`);
  });
  
  console.log("🌟 数据源系统启动完成");
}

// 全局工厂实例
export const dataSourceFactory = DataSourceFactory.getInstance();