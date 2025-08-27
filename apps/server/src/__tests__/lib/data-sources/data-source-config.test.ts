import { describe, it, expect, beforeEach } from "bun:test";
import { DataSourceConfigManager, DATA_SOURCE_CONFIGS } from "../../../lib/data-sources/data-source-config";
import type { DataSourceConfig } from "../../../types/data-sources";

describe("DataSourceConfigManager", () => {
  let configManager: DataSourceConfigManager;

  beforeEach(() => {
    configManager = new DataSourceConfigManager();
  });

  describe("配置加载和获取", () => {
    it("应该正确加载默认配置", () => {
      const tushareConfig = configManager.getConfig("tushare");
      expect(tushareConfig).toBeDefined();
      expect(tushareConfig?.name).toBe("Tushare Pro");
      expect(tushareConfig?.priority).toBe(1);

      const sinaConfig = configManager.getConfig("sina");
      expect(sinaConfig).toBeDefined();
      expect(sinaConfig?.name).toBe("新浪财经");
      expect(sinaConfig?.priority).toBe(2);
    });

    it("应该按优先级返回数据源列表", () => {
      const sources = configManager.getDataSourcesByPriority();
      expect(sources).toBeInstanceOf(Array);
      expect(sources.length).toBeGreaterThan(0);
      
      // 验证排序正确 (优先级数字越小越靠前)
      for (let i = 1; i < sources.length; i++) {
        const current = configManager.getConfig(sources[i]);
        const previous = configManager.getConfig(sources[i-1]);
        expect(current!.priority).toBeGreaterThanOrEqual(previous!.priority);
      }
    });

    it("应该正确获取主数据源", () => {
      const primary = configManager.getPrimaryDataSource();
      expect(primary).toBe("tushare"); // 优先级最高
    });

    it("应该正确获取备用数据源列表", () => {
      const backups = configManager.getBackupDataSources();
      expect(backups).toBeInstanceOf(Array);
      expect(backups).not.toContain("tushare"); // 不应包含主数据源
    });
  });

  describe("配置验证", () => {
    it("应该验证有效配置", () => {
      const validConfig: DataSourceConfig = {
        name: "测试数据源",
        priority: 10,
        apiUrl: "https://api.test.com",
        rateLimit: {
          requestsPerSecond: 5,
          requestsPerMinute: 300,
          requestsPerDay: 10000,
        },
        timeout: 5000,
        retryConfig: {
          maxRetries: 3,
          baseDelay: 1000,
          exponentialFactor: 2,
          jitter: 0.1,
          retryableErrors: ["NETWORK_ERROR"],
          nonRetryableErrors: ["AUTH_ERROR"],
        },
        healthCheck: {
          endpoint: "/health",
          interval: 300000,
          timeout: 5000,
        },
      };

      const errors = configManager.validateConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it("应该检测配置错误", () => {
      const invalidConfig: DataSourceConfig = {
        name: "", // 空名称
        priority: 0, // 无效优先级
        apiUrl: "invalid-url", // 无效URL
        rateLimit: {
          requestsPerSecond: -1, // 无效数值
          requestsPerMinute: 0,
          requestsPerDay: 0,
        },
        timeout: 500, // 太短
        retryConfig: {
          maxRetries: 15, // 太多
          baseDelay: 50, // 太短
          exponentialFactor: 0, // 无效
          jitter: 2, // 超出范围
          retryableErrors: [],
          nonRetryableErrors: [],
        },
        healthCheck: {
          endpoint: "", // 空端点
          interval: 30000, // 太短
          timeout: 10000, // 比间隔长
        },
      };

      const errors = configManager.validateConfig(invalidConfig);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("配置操作", () => {
    it("应该能够设置和更新配置", () => {
      const testConfig: DataSourceConfig = {
        name: "测试数据源",
        priority: 99,
        apiUrl: "https://test.com",
        rateLimit: {
          requestsPerSecond: 1,
          requestsPerMinute: 60,
          requestsPerDay: 1000,
        },
        timeout: 5000,
        retryConfig: {
          maxRetries: 2,
          baseDelay: 1000,
          exponentialFactor: 2,
          jitter: 0.1,
          retryableErrors: ["NETWORK_ERROR"],
          nonRetryableErrors: ["AUTH_ERROR"],
        },
        healthCheck: {
          endpoint: "/health",
          interval: 300000,
          timeout: 5000,
        },
      };

      // 设置配置
      configManager.setConfig("test", testConfig);
      const retrieved = configManager.getConfig("test");
      expect(retrieved).toEqual(testConfig);

      // 更新配置
      const success = configManager.updateConfig("test", { priority: 50 });
      expect(success).toBe(true);
      
      const updated = configManager.getConfig("test");
      expect(updated?.priority).toBe(50);
      expect(updated?.name).toBe("测试数据源"); // 其他字段保持不变
    });

    it("应该能够删除配置", () => {
      const testConfig: DataSourceConfig = DATA_SOURCE_CONFIGS.tushare;
      configManager.setConfig("temp", testConfig);
      
      expect(configManager.getConfig("temp")).toBeDefined();
      
      const removed = configManager.removeConfig("temp");
      expect(removed).toBe(true);
      expect(configManager.getConfig("temp")).toBeUndefined();
    });
  });

  describe("配置摘要", () => {
    it("应该正确生成配置摘要", () => {
      const summary = configManager.getConfigSummary();
      expect(summary).toBeInstanceOf(Array);
      expect(summary.length).toBeGreaterThan(0);
      
      for (const item of summary) {
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("priority");
        expect(item).toHaveProperty("status");
        expect(item).toHaveProperty("apiUrl");
        expect(item).toHaveProperty("maxDailyRequests");
        
        expect(["configured", "missing_api_key", "invalid"]).toContain(item.status);
      }
      
      // 验证按优先级排序
      for (let i = 1; i < summary.length; i++) {
        expect(summary[i].priority).toBeGreaterThanOrEqual(summary[i-1].priority);
      }
    });
  });

  describe("导入导出", () => {
    it("应该能够导出和导入配置", () => {
      const originalConfigs = configManager.getAllConfigs();
      const exported = configManager.exportConfigs();
      
      expect(exported).toBeTruthy();
      expect(() => JSON.parse(exported)).not.toThrow();
      
      // 创建新的管理器并导入
      const newManager = new DataSourceConfigManager();
      const result = newManager.importConfigs(exported);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // 验证导入的配置
      const importedConfigs = newManager.getAllConfigs();
      expect(importedConfigs.size).toBe(originalConfigs.size);
    });

    it("应该处理无效的JSON导入", () => {
      const result = configManager.importConfigs("invalid json");
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});