import type { DataSourceConfig } from "../../types/data-sources";
import { DataSourceErrorType } from "../../types/data-sources";

// 预定义的数据源配置
export const DATA_SOURCE_CONFIGS: Record<string, DataSourceConfig> = {
  tushare: {
    name: "Tushare Pro",
    priority: 1, // 最高优先级
    apiUrl: process.env.TUSHARE_API_BASE_URL || "https://api.tushare.pro",
    apiKey: process.env.TUSHARE_API_TOKEN,
    rateLimit: {
      requestsPerSecond: 1, // Tushare Pro 限制
      requestsPerMinute: 60,
      requestsPerDay: 10000, // 根据套餐而定
    },
    timeout: 10000, // 10秒
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000, // 1秒
      exponentialFactor: 2,
      jitter: 0.1,
      retryableErrors: [
        DataSourceErrorType.NETWORK_ERROR,
        DataSourceErrorType.TIMEOUT_ERROR,
        DataSourceErrorType.SERVER_ERROR_5XX,
        DataSourceErrorType.RATE_LIMIT_ERROR,
      ],
      nonRetryableErrors: [
        DataSourceErrorType.AUTH_ERROR,
        DataSourceErrorType.INVALID_PARAMS,
        DataSourceErrorType.CLIENT_ERROR_4XX,
        DataSourceErrorType.API_QUOTA_EXCEEDED,
      ],
    },
    healthCheck: {
      endpoint: "/",
      interval: 300000, // 5分钟
      timeout: 5000, // 5秒
    },
  },
  sina: {
    name: "新浪财经",
    priority: 2, // 备用数据源
    apiUrl: process.env.SINA_API_BASE_URL || "https://hq.sinajs.cn",
    rateLimit: {
      requestsPerSecond: 10, // 相对宽松
      requestsPerMinute: 600,
      requestsPerDay: 100000,
    },
    timeout: 8000, // 8秒
    retryConfig: {
      maxRetries: 2, // 备用数据源重试次数较少
      baseDelay: 500,
      exponentialFactor: 2,
      jitter: 0.1,
      retryableErrors: [
        DataSourceErrorType.NETWORK_ERROR,
        DataSourceErrorType.TIMEOUT_ERROR,
        DataSourceErrorType.SERVER_ERROR_5XX,
      ],
      nonRetryableErrors: [
        DataSourceErrorType.AUTH_ERROR,
        DataSourceErrorType.INVALID_PARAMS,
        DataSourceErrorType.CLIENT_ERROR_4XX,
        DataSourceErrorType.RATE_LIMIT_ERROR,
      ],
    },
    healthCheck: {
      endpoint: "/list=sh000001", // 测试上证指数
      interval: 600000, // 10分钟
      timeout: 5000,
    },
  },
  netease: {
    name: "网易财经",
    priority: 3, // 第三优先级
    apiUrl: process.env.NETEASE_API_BASE_URL || "https://api.money.163.com",
    rateLimit: {
      requestsPerSecond: 5,
      requestsPerMinute: 300,
      requestsPerDay: 50000,
    },
    timeout: 8000,
    retryConfig: {
      maxRetries: 2,
      baseDelay: 800,
      exponentialFactor: 2,
      jitter: 0.15,
      retryableErrors: [
        DataSourceErrorType.NETWORK_ERROR,
        DataSourceErrorType.TIMEOUT_ERROR,
        DataSourceErrorType.SERVER_ERROR_5XX,
      ],
      nonRetryableErrors: [
        DataSourceErrorType.AUTH_ERROR,
        DataSourceErrorType.INVALID_PARAMS,
        DataSourceErrorType.CLIENT_ERROR_4XX,
        DataSourceErrorType.RATE_LIMIT_ERROR,
      ],
    },
    healthCheck: {
      endpoint: "/hs/service/diyrank.php",
      interval: 600000, // 10分钟
      timeout: 5000,
    },
  },
};

// 数据源配置管理器
export class DataSourceConfigManager {
  private configs: Map<string, DataSourceConfig> = new Map();
  
  constructor() {
    // 加载默认配置
    this.loadDefaultConfigs();
  }

  // 加载默认配置
  private loadDefaultConfigs(): void {
    Object.entries(DATA_SOURCE_CONFIGS).forEach(([name, config]) => {
      this.configs.set(name, config);
    });
  }

  // 获取配置
  getConfig(name: string): DataSourceConfig | undefined {
    return this.configs.get(name);
  }

  // 获取所有配置
  getAllConfigs(): Map<string, DataSourceConfig> {
    return new Map(this.configs);
  }

  // 按优先级排序的数据源名称列表
  getDataSourcesByPriority(): string[] {
    return Array.from(this.configs.entries())
      .sort(([, a], [, b]) => a.priority - b.priority)
      .map(([name]) => name);
  }

  // 获取主数据源
  getPrimaryDataSource(): string | null {
    const sources = this.getDataSourcesByPriority();
    return sources.length > 0 ? sources[0] : null;
  }

  // 获取备用数据源列表
  getBackupDataSources(): string[] {
    const sources = this.getDataSourcesByPriority();
    return sources.slice(1); // 除了第一个(主数据源)之外的所有源
  }

  // 设置配置
  setConfig(name: string, config: DataSourceConfig): void {
    this.configs.set(name, config);
  }

  // 更新配置
  updateConfig(name: string, updates: Partial<DataSourceConfig>): boolean {
    const existing = this.configs.get(name);
    if (!existing) {
      return false;
    }

    const updated: DataSourceConfig = {
      ...existing,
      ...updates,
      // 深度合并嵌套对象
      rateLimit: { ...existing.rateLimit, ...updates.rateLimit },
      retryConfig: { ...existing.retryConfig, ...updates.retryConfig },
      healthCheck: { ...existing.healthCheck, ...updates.healthCheck },
    };

    this.configs.set(name, updated);
    return true;
  }

  // 移除配置
  removeConfig(name: string): boolean {
    return this.configs.delete(name);
  }

  // 验证配置完整性
  validateConfig(config: DataSourceConfig): string[] {
    const errors: string[] = [];

    if (!config.name || config.name.trim() === "") {
      errors.push("数据源名称不能为空");
    }

    if (typeof config.priority !== "number" || config.priority < 1) {
      errors.push("优先级必须是大于0的数字");
    }

    if (!config.apiUrl || !this.isValidUrl(config.apiUrl)) {
      errors.push("API地址无效");
    }

    if (typeof config.timeout !== "number" || config.timeout < 1000) {
      errors.push("超时时间必须至少为1000毫秒");
    }

    // 验证速率限制
    if (!config.rateLimit) {
      errors.push("缺少速率限制配置");
    } else {
      const { requestsPerSecond, requestsPerMinute, requestsPerDay } = config.rateLimit;
      
      if (typeof requestsPerSecond !== "number" || requestsPerSecond < 1) {
        errors.push("每秒请求限制必须是大于0的数字");
      }

      if (typeof requestsPerMinute !== "number" || requestsPerMinute < requestsPerSecond) {
        errors.push("每分钟请求限制必须大于等于每秒请求限制");
      }

      if (typeof requestsPerDay !== "number" || requestsPerDay < requestsPerMinute) {
        errors.push("每日请求限制必须大于等于每分钟请求限制");
      }
    }

    // 验证重试配置
    if (!config.retryConfig) {
      errors.push("缺少重试配置");
    } else {
      const { maxRetries, baseDelay, exponentialFactor, jitter } = config.retryConfig;
      
      if (typeof maxRetries !== "number" || maxRetries < 0 || maxRetries > 10) {
        errors.push("最大重试次数必须是0-10之间的数字");
      }

      if (typeof baseDelay !== "number" || baseDelay < 100) {
        errors.push("基础延迟必须至少为100毫秒");
      }

      if (typeof exponentialFactor !== "number" || exponentialFactor < 1) {
        errors.push("指数退避因子必须大于等于1");
      }

      if (typeof jitter !== "number" || jitter < 0 || jitter > 1) {
        errors.push("随机抖动比例必须是0-1之间的数字");
      }

      if (!Array.isArray(config.retryConfig.retryableErrors)) {
        errors.push("可重试错误列表格式无效");
      }

      if (!Array.isArray(config.retryConfig.nonRetryableErrors)) {
        errors.push("不可重试错误列表格式无效");
      }
    }

    // 验证健康检查配置
    if (!config.healthCheck) {
      errors.push("缺少健康检查配置");
    } else {
      const { endpoint, interval, timeout } = config.healthCheck;
      
      if (!endpoint || endpoint.trim() === "") {
        errors.push("健康检查端点不能为空");
      }

      if (typeof interval !== "number" || interval < 60000) {
        errors.push("健康检查间隔必须至少为60秒");
      }

      if (typeof timeout !== "number" || timeout < 1000 || timeout > interval) {
        errors.push("健康检查超时时间必须在1秒到检查间隔之间");
      }
    }

    return errors;
  }

  // 验证URL格式
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // 导出配置为JSON
  exportConfigs(): string {
    const configObject = Object.fromEntries(this.configs);
    return JSON.stringify(configObject, null, 2);
  }

  // 从JSON导入配置
  importConfigs(json: string): { success: boolean; errors: string[] } {
    try {
      const configObject = JSON.parse(json);
      const errors: string[] = [];

      for (const [name, config] of Object.entries(configObject)) {
        const configErrors = this.validateConfig(config as DataSourceConfig);
        if (configErrors.length > 0) {
          errors.push(`${name}: ${configErrors.join(", ")}`);
        } else {
          this.configs.set(name, config as DataSourceConfig);
        }
      }

      return { success: errors.length === 0, errors };
    } catch (error) {
      return { 
        success: false, 
        errors: [`JSON格式错误: ${error instanceof Error ? error.message : String(error)}`] 
      };
    }
  }

  // 获取配置摘要信息
  getConfigSummary(): Array<{
    name: string;
    priority: number;
    status: "configured" | "missing_api_key" | "invalid";
    apiUrl: string;
    maxDailyRequests: number;
  }> {
    return Array.from(this.configs.entries()).map(([name, config]) => {
      let status: "configured" | "missing_api_key" | "invalid" = "configured";
      
      // 检查Tushare是否缺少API密钥
      if (name === "tushare" && !config.apiKey) {
        status = "missing_api_key";
      }
      
      // 检查配置是否有效
      const errors = this.validateConfig(config);
      if (errors.length > 0) {
        status = "invalid";
      }

      return {
        name: config.name,
        priority: config.priority,
        status,
        apiUrl: config.apiUrl,
        maxDailyRequests: config.rateLimit.requestsPerDay,
      };
    }).sort((a, b) => a.priority - b.priority);
  }
}

// 全局配置管理器实例
export const dataSourceConfigManager = new DataSourceConfigManager();