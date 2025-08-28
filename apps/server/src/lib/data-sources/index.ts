// 数据源模块统一导出

// 类型定义
export * from "../../types/data-sources";

// 抽象基类
export { AbstractDataSource } from "./abstract-data-source";

// 具体数据源实现
export { TushareDataSource } from "./tushare-data-source";
export { SinaDataSource } from "./sina-data-source";
export { NeteaseDataSource } from "./netease-data-source";

// 配置管理
export { 
  DataSourceConfigManager, 
  dataSourceConfigManager, 
  DATA_SOURCE_CONFIGS 
} from "./data-source-config";

// 健康监控
export { 
  DataSourceHealthMonitor, 
  dataSourceHealthMonitor 
} from "./data-source-health";

// 数据源管理
export { 
  DataSourceManager, 
  dataSourceManager 
} from "./data-source-manager";

// 工厂和初始化
export { 
  DataSourceFactory, 
  dataSourceFactory, 
  initializeDataSourceSystem 
} from "./data-source-factory";

// 导入所有实例以确保它们被正确初始化
import { dataSourceFactory } from "./data-source-factory";
import { dataSourceManager } from "./data-source-manager";  
import { dataSourceHealthMonitor } from "./data-source-health";
import { dataSourceConfigManager } from "./data-source-config";

// 便捷函数和工具
export const DataSourceUtils = {
  // 获取系统状态摘要
  getSystemStatus() {
    return dataSourceFactory.getSystemStatus();
  },

  // 获取当前主数据源
  getCurrentPrimarySource() {
    return dataSourceManager.getCurrentPrimarySource();
  },

  // 获取所有健康状态
  getAllHealthStatus() {
    return dataSourceHealthMonitor.getAllHealthStatus();
  },

  // 手动触发健康检查
  async performHealthCheck() {
    return dataSourceFactory.performSystemHealthCheck();
  },

  // 手动切换数据源
  async switchToDataSource(sourceName: string, reason: string = "手动切换") {
    return dataSourceManager.switchToDataSource(sourceName, reason);
  },

  // 获取切换历史
  getSwitchHistory(limit?: number) {
    return dataSourceManager.getSwitchHistory(limit);
  },

  // 获取数据源配置摘要
  getConfigSummary() {
    return dataSourceConfigManager.getConfigSummary();
  },

  // 检查数据源是否已初始化
  isDataSourceInitialized(sourceName: string) {
    return dataSourceFactory.isInitialized(sourceName);
  },

  // 重新初始化数据源
  async reinitializeDataSource(sourceName: string) {
    return dataSourceFactory.reinitializeDataSource(sourceName);
  },

  // 获取可用性统计
  getAvailabilityStats(sourceName: string, hours: number = 24) {
    return dataSourceHealthMonitor.getAvailabilityStats(sourceName, hours);
  },
};