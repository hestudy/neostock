import { describe, it, expect, beforeEach } from 'vitest';
import { databaseHealthChecker, DatabaseHealthChecker } from '../../lib/database-health';

describe('数据库健康检查', () => {
  let healthChecker: DatabaseHealthChecker;

  beforeEach(() => {
    healthChecker = new DatabaseHealthChecker();
  });

  describe('完整健康检查', () => {
    it('应该返回完整的健康检查结果', async () => {
      const result = await healthChecker.performHealthCheck();
      
      expect(result).toMatchObject({
        status: expect.stringMatching(/^(pass|warn|fail)$/),
        responseTime: expect.any(Number),
        message: expect.any(String),
        details: {
          connectivity: {
            status: expect.stringMatching(/^(pass|fail)$/),
            responseTime: expect.any(Number),
          },
          pragmaConfig: {
            status: expect.stringMatching(/^(pass|warn|fail)$/),
            settings: expect.any(Object),
            issues: expect.any(Array),
          },
          connectionPool: {
            status: expect.stringMatching(/^(pass|warn|fail)$/),
            active: expect.any(Number),
            max: expect.any(Number),
            utilization: expect.any(Number),
          },
          performance: {
            status: expect.stringMatching(/^(pass|warn|fail)$/),
            averageQueryTime: expect.any(Number),
            slowQueries: expect.any(Number),
          },
          diskSpace: {
            status: expect.stringMatching(/^(pass|warn|fail)$/),
            info: expect.any(String),
          },
        },
      });
    });

    it('健康检查应该在合理时间内完成', async () => {
      const startTime = performance.now();
      const result = await healthChecker.performHealthCheck();
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      
      // 健康检查应该在2秒内完成
      expect(totalTime).toBeLessThan(2000);
      
      // 响应时间应该与实际测量时间相近
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.responseTime).toBeLessThan(totalTime + 100); // 允许100ms误差
    });

    it('应该正确处理测试环境的特殊情况', async () => {
      const result = await healthChecker.performHealthCheck();
      
      // 在测试环境中，数据库应该是可用的
      expect(result.details.connectivity.status).toBe('pass');
      
      // 连接池利用率应该合理
      expect(result.details.connectionPool.utilization).toBeGreaterThanOrEqual(0);
      expect(result.details.connectionPool.utilization).toBeLessThanOrEqual(1);
      
      // 外键约束应该启用
      expect(result.details.pragmaConfig.settings.foreign_keys).toBe(1);
    });
  });

  describe('连接性检查', () => {
    it('应该能检测到数据库连接可用', async () => {
      const result = await healthChecker.performHealthCheck();
      
      expect(result.details.connectivity.status).toBe('pass');
      expect(result.details.connectivity.responseTime).toBeGreaterThan(0);
      expect(result.details.connectivity.responseTime).toBeLessThan(1000); // 1秒内
    });
  });

  describe('PRAGMA配置检查', () => {
    it('应该验证关键PRAGMA设置', async () => {
      const result = await healthChecker.performHealthCheck();
      
      const pragmaConfig = result.details.pragmaConfig;
      
      // 应该有PRAGMA设置信息
      expect(pragmaConfig.settings).toBeDefined();
      expect(typeof pragmaConfig.settings).toBe('object');
      
      // 外键约束必须启用
      expect(pragmaConfig.settings.foreign_keys).toBe(1);
      
      // 如果有问题，应该在issues中列出
      expect(pragmaConfig.issues).toBeInstanceOf(Array);
      
      // 在测试环境中，外键问题不应该存在
      const foreignKeyIssue = pragmaConfig.issues.find(issue => 
        issue.includes('外键约束')
      );
      expect(foreignKeyIssue).toBeUndefined();
    });

    it('应该检测PRAGMA配置问题', async () => {
      const result = await healthChecker.performHealthCheck();
      
      const pragmaConfig = result.details.pragmaConfig;
      
      // 状态应该是有效的
      expect(['pass', 'warn', 'fail']).toContain(pragmaConfig.status);
      
      // 如果状态不是pass，应该有相应的问题描述
      if (pragmaConfig.status !== 'pass') {
        expect(pragmaConfig.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('连接池检查', () => {
    it('应该正确报告连接池状态', async () => {
      const result = await healthChecker.performHealthCheck();
      
      const poolStatus = result.details.connectionPool;
      
      // 连接池参数应该合理
      expect(poolStatus.max).toBe(10); // 根据故事要求
      expect(poolStatus.active).toBeGreaterThanOrEqual(0);
      expect(poolStatus.active).toBeLessThanOrEqual(poolStatus.max);
      
      // 利用率应该在0-1之间
      expect(poolStatus.utilization).toBeGreaterThanOrEqual(0);
      expect(poolStatus.utilization).toBeLessThanOrEqual(1);
      
      // 在测试环境中，连接池状态应该良好
      expect(poolStatus.status).toMatch(/^(pass|warn)$/);
    });

    it('应该正确计算连接池利用率', async () => {
      const result = await healthChecker.performHealthCheck();
      
      const poolStatus = result.details.connectionPool;
      
      const expectedUtilization = poolStatus.active / poolStatus.max;
      expect(poolStatus.utilization).toBeCloseTo(expectedUtilization, 3);
    });
  });

  describe('性能检查', () => {
    it('应该测试基本查询性能', async () => {
      const result = await healthChecker.performHealthCheck();
      
      const performance = result.details.performance;
      
      // 平均查询时间应该合理
      expect(performance.averageQueryTime).toBeGreaterThan(0);
      expect(performance.averageQueryTime).toBeLessThan(1000); // 1秒内
      
      // 慢查询数量应该是数字
      expect(performance.slowQueries).toBeGreaterThanOrEqual(0);
      
      // 在测试环境中，性能应该良好
      expect(performance.status).toMatch(/^(pass|warn)$/);
    });

    it('应该在测试环境中表现良好', async () => {
      const result = await healthChecker.performHealthCheck();
      
      const performance = result.details.performance;
      
      // 内存数据库应该很快
      expect(performance.averageQueryTime).toBeLessThan(50); // 50ms
      
      // 不应该有太多慢查询
      expect(performance.slowQueries).toBeLessThanOrEqual(1);
    });
  });

  describe('磁盘空间检查', () => {
    it('应该提供磁盘空间信息', async () => {
      const result = await healthChecker.performHealthCheck();
      
      const diskSpace = result.details.diskSpace;
      
      expect(diskSpace.status).toMatch(/^(pass|warn|fail)$/);
      expect(diskSpace.info).toBeDefined();
      expect(typeof diskSpace.info).toBe('string');
      expect(diskSpace.info.length).toBeGreaterThan(0);
    });

    it('应该正确处理内存数据库的磁盘检查', async () => {
      const result = await healthChecker.performHealthCheck();
      
      const diskSpace = result.details.diskSpace;
      
      // 内存数据库的大小信息应该可用
      expect(diskSpace.info).toContain('数据库大小');
      
      // 状态应该是pass或warn（内存数据库不应该fail）
      expect(['pass', 'warn']).toContain(diskSpace.status);
    });
  });

  describe('状态消息生成', () => {
    it('应该根据检查结果生成有意义的消息', async () => {
      const result = await healthChecker.performHealthCheck();
      
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
      
      // 消息应该反映整体状态
      if (result.status === 'pass') {
        expect(result.message).toContain('健康');
      } else if (result.status === 'warn') {
        expect(result.message).toContain('警告');
      } else if (result.status === 'fail') {
        expect(result.message).toContain('问题');
      }
    });
  });

  describe('错误处理', () => {
    it('应该优雅地处理部分检查失败', async () => {
      // 这个测试验证即使某些检查失败，健康检查仍能完成
      const result = await healthChecker.performHealthCheck();
      
      // 无论状态如何，都应该有完整的结果结构
      expect(result).toMatchObject({
        status: expect.any(String),
        responseTime: expect.any(Number),
        message: expect.any(String),
        details: expect.any(Object),
      });
    });
  });

  describe('单例实例', () => {
    it('应该提供可用的单例实例', () => {
      expect(databaseHealthChecker).toBeDefined();
      expect(databaseHealthChecker).toBeInstanceOf(DatabaseHealthChecker);
    });

    it('单例实例应该能执行健康检查', async () => {
      const result = await databaseHealthChecker.performHealthCheck();
      
      expect(result).toBeDefined();
      expect(result.status).toMatch(/^(pass|warn|fail)$/);
    });
  });
});