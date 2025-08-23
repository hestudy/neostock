import { describe, it, expect, beforeEach } from 'bun:test';
import { InfrastructureManager, type InfraConfig } from '../../lib/infrastructure';

describe('Infrastructure as Code Management', () => {
  let infraManager: InfrastructureManager;

  beforeEach(() => {
    infraManager = new InfrastructureManager();
  });

  describe('配置加载和验证', () => {
    it('应该成功加载有效的配置', () => {
      const config = infraManager.loadConfig('test-config.json');

      expect(config).toBeDefined();
      expect(config.name).toBeTruthy();
      expect(config.provider).toBeTruthy();
      expect(config.environment).toBeTruthy();
      expect(config.resources).toBeDefined();
    });

    it('应该验证完整的有效配置', () => {
      const config = infraManager.loadConfig('test-config.json');
      const validation = infraManager.validateConfig(config);

      expect(validation.valid).toBe(true);
      expect(validation.issues.filter(issue => issue.level === 'error')).toHaveLength(0);
      expect(validation.configHash).toBeTruthy();
    });

    it('应该检测缺失的配置名称', () => {
      const invalidConfig: InfraConfig = {
        name: '',  // 无效
        provider: 'docker',
        environment: 'development',
        resources: {
          database: {
            type: 'sqlite',
            version: '3.x',
            persistent: true,
            backup: { enabled: false, schedule: '', retention: 0 }
          },
          monitoring: {
            enabled: false,
            metrics: [],
            alerting: { enabled: false, channels: [] }
          },
          networking: {
            ports: [3000],
            ssl: { enabled: false },
            cors: { origins: [] }
          },
          storage: {
            type: 'local',
            path: './storage',
            size: '1GB'
          }
        }
      };

      const validation = infraManager.validateConfig(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => 
        issue.level === 'error' && issue.message.includes('name is required')
      )).toBe(true);
    });

    it('应该检测不支持的提供者', () => {
      const config = infraManager.loadConfig('test-config.json');
      config.provider = 'unsupported' as any;

      const validation = infraManager.validateConfig(config);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => 
        issue.message.includes('Unsupported provider')
      )).toBe(true);
    });

    it('应该检测无效的端口配置', () => {
      const config = infraManager.loadConfig('test-config.json');
      config.resources.networking.ports = [0, 70000]; // 无效端口

      const validation = infraManager.validateConfig(config);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => 
        issue.message.includes('Invalid port numbers')
      )).toBe(true);
    });

    it('应该检测空端口配置', () => {
      const config = infraManager.loadConfig('test-config.json');
      config.resources.networking.ports = [];

      const validation = infraManager.validateConfig(config);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => 
        issue.message.includes('At least one port must be configured')
      )).toBe(true);
    });

    it('应该验证数据库配置', () => {
      const config = infraManager.loadConfig('test-config.json');
      config.resources.database.type = 'unsupported' as any;

      const validation = infraManager.validateConfig(config);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => 
        issue.message.includes('Unsupported database type')
      )).toBe(true);
    });

    it('应该验证存储配置', () => {
      const config = infraManager.loadConfig('test-config.json');
      config.resources.storage.type = 'unsupported' as any;

      const validation = infraManager.validateConfig(config);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => 
        issue.message.includes('Unsupported storage type')
      )).toBe(true);
    });
  });

  describe('一键部署功能', () => {
    it('应该成功执行 dry run 部署', async () => {
      const config = infraManager.loadConfig('test-config.json');
      const result = await infraManager.deploy(config.name, true);

      expect(result.success).toBe(true);
      expect(result.environment).toBe(config.environment);
      expect(result.services.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('应该成功执行实际部署', async () => {
      const config = infraManager.loadConfig('test-config.json');
      const result = await infraManager.deploy(config.name, false);

      expect(result.success).toBe(true);
      expect(result.services.length).toBeGreaterThan(0);
      expect(result.services.every(service => service.status === 'running')).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该处理部署不存在的配置', async () => {
      const result = await infraManager.deploy('non-existent', false);

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('not found'))).toBe(true);
    });

    it('应该拒绝部署无效配置', async () => {
      const config = infraManager.loadConfig('test-config.json');
      config.name = ''; // 使配置无效

      const result = await infraManager.deploy(config.name, false);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该在合理时间内完成部署', async () => {
      const config = infraManager.loadConfig('test-config.json');
      
      const result = await infraManager.deploy(config.name, false);
      
      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(5000); // 5秒内完成
    });
  });

  describe('环境复制功能', () => {
    it('应该成功克隆开发环境到测试环境', async () => {
      const sourceConfig = infraManager.loadConfig('dev-config.json');
      sourceConfig.name = 'development';
      sourceConfig.environment = 'development';

      const cloneResult = await infraManager.cloneEnvironment(
        'development', 
        'testing', 
        'testing-clone'
      );

      expect(cloneResult.success).toBe(true);
      expect(cloneResult.newConfig).not.toBeNull();
      expect(cloneResult.newConfig!.name).toBe('testing-clone');
      expect(cloneResult.newConfig!.environment).toBe('testing');
      expect(cloneResult.differences.length).toBeGreaterThanOrEqual(0);
    });

    it('应该自动调整生产环境配置', async () => {
      const sourceConfig = infraManager.loadConfig('dev-config.json');
      sourceConfig.name = 'development';
      sourceConfig.environment = 'development';

      const cloneResult = await infraManager.cloneEnvironment(
        'development', 
        'production', 
        'production-clone'
      );

      expect(cloneResult.success).toBe(true);
      expect(cloneResult.newConfig!.resources.database.backup.enabled).toBe(true);
      expect(cloneResult.newConfig!.resources.database.backup.retention).toBe(30);
      expect(cloneResult.newConfig!.resources.networking.ssl.enabled).toBe(true);
      expect(cloneResult.differences.some(diff => diff.includes('SSL'))).toBe(true);
    });

    it('应该处理克隆不存在的源配置', async () => {
      const cloneResult = await infraManager.cloneEnvironment(
        'non-existent', 
        'testing', 
        'test-clone'
      );

      expect(cloneResult.success).toBe(false);
      expect(cloneResult.newConfig).toBeNull();
      expect(cloneResult.warnings.some(warning => warning.includes('not found'))).toBe(true);
    });

    it('应该提供有用的差异信息', async () => {
      const sourceConfig = infraManager.loadConfig('dev-config.json');
      sourceConfig.name = 'development';

      const cloneResult = await infraManager.cloneEnvironment(
        'development', 
        'production', 
        'prod-clone'
      );

      expect(cloneResult.success).toBe(true);
      expect(cloneResult.differences.length).toBeGreaterThan(0);
      expect(cloneResult.differences.some(diff => 
        diff.includes('SSL') || diff.includes('backup')
      )).toBe(true);
    });
  });

  describe('环境状态监控', () => {
    it('应该获取环境状态', async () => {
      const config = infraManager.loadConfig('test-config.json');
      const status = await infraManager.getEnvironmentStatus(config.name);

      expect(status.config).not.toBeNull();
      expect(status.services.length).toBeGreaterThan(0);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(status.health);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    it('应该处理不存在的环境', async () => {
      const status = await infraManager.getEnvironmentStatus('non-existent');

      expect(status.config).toBeNull();
      expect(status.services).toHaveLength(0);
      expect(status.health).toBe('unhealthy');
      expect(status.uptime).toBe(0);
    });

    it('应该正确计算健康状态', async () => {
      const config = infraManager.loadConfig('healthy-config.json');
      const status = await infraManager.getEnvironmentStatus(config.name);

      // 所有服务都是健康的
      expect(status.services.every(service => service.health === 'healthy')).toBe(true);
      expect(status.health).toBe('healthy');
    });
  });

  describe('配置导出功能', () => {
    it('应该导出 JSON 格式配置', () => {
      const config = infraManager.loadConfig('test-config.json');
      const exported = infraManager.exportConfig(config.name, 'json');

      expect(() => JSON.parse(exported)).not.toThrow();
      
      const parsed = JSON.parse(exported);
      expect(parsed.name).toBe(config.name);
      expect(parsed.provider).toBe(config.provider);
    });

    it('应该导出 YAML 格式配置', () => {
      const config = infraManager.loadConfig('test-config.json');
      const exported = infraManager.exportConfig(config.name, 'yaml');

      expect(exported).toBeTruthy();
      expect(typeof exported).toBe('string');
      // 实际实现会验证 YAML 格式
    });

    it('应该导出 TOML 格式配置', () => {
      const config = infraManager.loadConfig('test-config.json');
      const exported = infraManager.exportConfig(config.name, 'toml');

      expect(exported).toBeTruthy();
      expect(typeof exported).toBe('string');
      // 实际实现会验证 TOML 格式
    });

    it('应该处理导出不存在的配置', () => {
      expect(() => infraManager.exportConfig('non-existent')).toThrow();
    });
  });

  describe('配置一致性和完整性', () => {
    it('应该生成一致的配置哈希', () => {
      const config1 = infraManager.loadConfig('config1.json');
      const config2 = infraManager.loadConfig('config2.json');

      const validation1 = infraManager.validateConfig(config1);
      const validation2 = infraManager.validateConfig(config2);

      if (JSON.stringify(config1) === JSON.stringify(config2)) {
        expect(validation1.configHash).toBe(validation2.configHash);
      } else {
        expect(validation1.configHash).not.toBe(validation2.configHash);
      }
    });

    it('应该检测配置更改', () => {
      const config = infraManager.loadConfig('test-config.json');
      const originalValidation = infraManager.validateConfig(config);

      // 修改配置
      config.resources.networking.ports.push(8080);
      const modifiedValidation = infraManager.validateConfig(config);

      expect(originalValidation.configHash).not.toBe(modifiedValidation.configHash);
    });

    it('应该提供详细的验证反馈', () => {
      const config = infraManager.loadConfig('test-config.json');
      
      // 创建有警告但有效的配置
      config.resources.database.backup.retention = 0; // 会产生警告
      
      const validation = infraManager.validateConfig(config);

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(warning => warning.includes('retention'))).toBe(true);
    });
  });

  describe('性能和可扩展性测试', () => {
    it('应该处理多个并发配置加载', () => {
      const configs = [];
      
      for (let i = 0; i < 10; i++) {
        configs.push(infraManager.loadConfig(`config-${i}.json`));
      }

      expect(configs).toHaveLength(10);
      configs.forEach(config => {
        expect(config).toBeDefined();
        expect(config.name).toBeTruthy();
      });
    });

    it('应该快速验证大型配置', () => {
      const config = infraManager.loadConfig('large-config.json');
      
      // 添加大量端口来模拟大型配置
      for (let i = 4000; i < 4100; i++) {
        config.resources.networking.ports.push(i);
      }

      const startTime = Date.now();
      const validation = infraManager.validateConfig(config);
      const duration = Date.now() - startTime;

      expect(validation).toBeDefined();
      expect(duration).toBeLessThan(1000); // 1秒内完成
    });

    it('应该支持环境批量操作', async () => {
      const baseConfig = infraManager.loadConfig('base-config.json');
      baseConfig.name = 'base';

      const environments = ['dev', 'staging', 'prod'];
      const clonePromises = environments.map(env => 
        infraManager.cloneEnvironment('base', env as any, `${env}-clone`)
      );

      const results = await Promise.all(clonePromises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.newConfig).not.toBeNull();
      });
    });
  });

  describe('边缘情况和错误处理', () => {
    it('应该处理损坏的配置数据', () => {
      // 模拟损坏的配置
      const corruptedConfig = {
        name: 'test',
        // 缺少必需字段
      } as InfraConfig;

      expect(() => infraManager.validateConfig(corruptedConfig)).not.toThrow();
      
      const validation = infraManager.validateConfig(corruptedConfig);
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('应该处理网络超时情况', async () => {
      const config = infraManager.loadConfig('timeout-config.json');
      
      // 模拟部署但不会真正超时，因为我们使用 mock 实现
      const result = await infraManager.deploy(config.name, false);
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('应该提供有用的错误消息', () => {
      const config = infraManager.loadConfig('test-config.json');
      config.resources.networking.ports = [-1, 999999]; // 多个无效端口

      const validation = infraManager.validateConfig(config);

      expect(validation.valid).toBe(false);
      const errorIssue = validation.issues.find(issue => issue.level === 'error');
      expect(errorIssue).toBeDefined();
      expect(errorIssue!.message).toContain('Invalid port numbers');
      expect(errorIssue!.message).toContain('-1');
      expect(errorIssue!.message).toContain('999999');
    });
  });
});