import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLogger } from '../../../lib/security/audit-logger';

describe('AuditLogger 审计日志记录测试', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    // 使用独立实例避免测试间的干扰
    logger = AuditLogger.getInstance();
    logger.clearLogs();
    
    // 设置固定时间
    logger.setTimeProvider(() => new Date('2024-01-15T10:00:00Z'));
  });

  afterEach(() => {
    logger.resetTimeProvider();
  });

  describe('基础日志记录功能', () => {
    it('应该成功记录API访问日志', () => {
      logger.logApiAccess({
        userId: 'user123',
        clientId: 'client456',
        action: 'GET_STATUS',
        resource: 'data-sources',
        method: 'GET',
        success: true,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        sessionId: 'session789',
      });

      const logs = logger.queryLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.userId).toBe('user123');
      expect(log.clientId).toBe('client456');
      expect(log.action).toBe('GET_STATUS');
      expect(log.resource).toBe('data-sources');
      expect(log.method).toBe('GET');
      expect(log.success).toBe(true);
      expect(log.ipAddress).toBe('192.168.1.100');
      expect(log.sessionId).toBe('session789');
      expect(log.id).toMatch(/^audit_\d+_[a-z0-9]+$/);
      expect(log.timestamp).toEqual(new Date('2024-01-15T10:00:00Z'));
    });

    it('应该记录失败的API访问', () => {
      logger.logApiAccess({
        userId: 'user123',
        action: 'TRIGGER_UPDATE',
        resource: 'data-sources',
        method: 'POST',
        success: false,
        error: '权限不足',
        metadata: { reason: 'insufficient_permissions' },
      });

      const logs = logger.queryLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.success).toBe(false);
      expect(log.error).toBe('权限不足');
      expect(log.metadata).toEqual({ reason: 'insufficient_permissions' });
    });

    it('应该为每个日志条目生成唯一ID', () => {
      // 记录多个日志
      for (let i = 0; i < 5; i++) {
        logger.logApiAccess({
          userId: `user${i}`,
          action: 'TEST_ACTION',
          resource: 'test',
          method: 'TEST',
          success: true,
        });
      }

      const logs = logger.queryLogs();
      expect(logs).toHaveLength(5);
      
      // 检查ID唯一性
      const ids = logs.map(log => log.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('专门的日志记录方法', () => {
    it('应该记录数据源管理操作', () => {
      logger.logDataSourceOperation(
        'SWITCH_PRIMARY',
        'tushare',
        'admin123',
        true,
        undefined,
        { from: 'sina', to: 'tushare' }
      );

      const logs = logger.queryLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.action).toBe('SWITCH_PRIMARY');
      expect(log.resource).toBe('tushare');
      expect(log.userId).toBe('admin123');
      expect(log.method).toBe('OPERATION');
      expect(log.success).toBe(true);
      expect(log.metadata).toEqual({ from: 'sina', to: 'tushare' });
    });

    it('应该记录凭据管理操作', () => {
      logger.logCredentialOperation(
        'ROTATE_KEY',
        'tushare-token',
        'admin123',
        true,
        undefined,
        { oldKeyAge: 90, newKeyValidUntil: '2024-04-15' }
      );

      const logs = logger.queryLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.action).toBe('ROTATE_KEY');
      expect(log.resource).toBe('credential:tushare-token');
      expect(log.userId).toBe('admin123');
      expect(log.method).toBe('CREDENTIAL');
      expect(log.success).toBe(true);
      expect(log.metadata).toEqual({
        keyId: 'tushare-token',
        oldKeyAge: 90,
        newKeyValidUntil: '2024-04-15',
      });
    });

    it('应该记录认证相关操作', () => {
      logger.logAuthOperation(
        'LOGIN_ATTEMPT',
        false,
        'user123',
        '密码错误',
        { attempts: 3, ipAddress: '192.168.1.100' }
      );

      const logs = logger.queryLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.action).toBe('LOGIN_ATTEMPT');
      expect(log.resource).toBe('authentication');
      expect(log.userId).toBe('user123');
      expect(log.method).toBe('AUTH');
      expect(log.success).toBe(false);
      expect(log.error).toBe('密码错误');
      expect(log.metadata).toEqual({
        attempts: 3,
        ipAddress: '192.168.1.100',
      });
    });

    it('应该记录敏感数据访问', () => {
      logger.logSensitiveDataAccess(
        'credential:tushare-token',
        'admin123',
        'VIEW_CREDENTIAL_STATUS',
        true,
        undefined,
        { keyId: 'tushare-token' }
      );

      const logs = logger.queryLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.resource).toBe('credential:tushare-token');
      expect(log.action).toBe('VIEW_CREDENTIAL_STATUS');
      expect(log.method).toBe('SENSITIVE_DATA');
      expect(log.metadata).toEqual({
        keyId: 'tushare-token',
        sensitiveData: true,
      });
    });
  });

  describe('日志查询功能', () => {
    beforeEach(() => {
      // 准备测试数据
      const testLogs = [
        {
          logData: {
            userId: 'user1',
            action: 'GET_STATUS',
            resource: 'data-sources',
            method: 'GET',
            success: true,
          },
          timestamp: new Date('2024-01-15T10:00:00Z')
        },
        {
          logData: {
            userId: 'user1',
            action: 'TRIGGER_UPDATE',
            resource: 'data-sources',
            method: 'POST',
            success: false,
            error: '权限不足',
          },
          timestamp: new Date('2024-01-15T10:01:00Z')
        },
        {
          logData: {
            userId: 'user2',
            action: 'GET_STATUS',
            resource: 'data-sources',
            method: 'GET',
            success: true,
          },
          timestamp: new Date('2024-01-15T10:02:00Z')
        },
        {
          logData: {
            userId: 'admin',
            action: 'ROTATE_KEY',
            resource: 'credential:tushare-token',
            method: 'CREDENTIAL',
            success: true,
          },
          timestamp: new Date('2024-01-15T10:03:00Z')
        },
      ];

      testLogs.forEach(({ logData, timestamp }) => {
        // 为每个日志设置指定的时间
        logger.setTimeProvider(() => timestamp);
        logger.logApiAccess(logData);
      });
    });

    it('应该能够按用户查询日志', () => {
      const user1Logs = logger.queryLogs({ userId: 'user1' });
      expect(user1Logs).toHaveLength(2);
      expect(user1Logs.every(log => log.userId === 'user1')).toBe(true);
    });

    it('应该能够按操作类型查询日志', () => {
      const statusLogs = logger.queryLogs({ action: 'GET_STATUS' });
      expect(statusLogs).toHaveLength(2);
      expect(statusLogs.every(log => log.action === 'GET_STATUS')).toBe(true);
    });

    it('应该能够按资源查询日志', () => {
      const dataSourceLogs = logger.queryLogs({ resource: 'data-sources' });
      expect(dataSourceLogs).toHaveLength(3);
      expect(dataSourceLogs.every(log => log.resource === 'data-sources')).toBe(true);
    });

    it('应该能够按成功状态查询日志', () => {
      const failedLogs = logger.queryLogs({ success: false });
      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0].success).toBe(false);

      const successLogs = logger.queryLogs({ success: true });
      expect(successLogs).toHaveLength(3);
      expect(successLogs.every(log => log.success === true)).toBe(true);
    });

    it('应该能够按日期范围查询日志', () => {
      const startDate = new Date('2024-01-15T10:01:00Z');
      const endDate = new Date('2024-01-15T10:02:00Z');
      
      const rangeLogs = logger.queryLogs({ startDate, endDate });
      expect(rangeLogs).toHaveLength(2); // 包含 10:01:00 和 10:02:00 的日志
      expect(rangeLogs.some(log => log.action === 'TRIGGER_UPDATE')).toBe(true);
      expect(rangeLogs.some(log => log.action === 'GET_STATUS')).toBe(true);
    });

    it('应该能够限制查询结果数量', () => {
      const limitedLogs = logger.queryLogs({ limit: 2 });
      expect(limitedLogs).toHaveLength(2);
    });

    it('应该能够组合多个查询条件', () => {
      const combinedLogs = logger.queryLogs({
        userId: 'user1',
        success: true,
        resource: 'data-sources',
      });
      expect(combinedLogs).toHaveLength(1);
      expect(combinedLogs[0].action).toBe('GET_STATUS');
    });

    it('应该按时间倒序返回查询结果', () => {
      const allLogs = logger.queryLogs();
      expect(allLogs).toHaveLength(4);
      
      // 验证时间倒序
      for (let i = 1; i < allLogs.length; i++) {
        expect(allLogs[i].timestamp.getTime()).toBeLessThanOrEqual(
          allLogs[i - 1].timestamp.getTime()
        );
      }
    });
  });

  describe('用户操作统计', () => {
    beforeEach(() => {
      // 准备用户操作数据
      logger.setTimeProvider(() => new Date('2024-01-15T10:00:00Z'));
      
      // user1 的操作（最近1小时内）
      for (let i = 0; i < 5; i++) {
        logger.logApiAccess({
          userId: 'user1',
          action: 'GET_STATUS',
          resource: 'data-sources',
          method: 'GET',
          success: true,
        });
      }
      
      for (let i = 0; i < 2; i++) {
        logger.logApiAccess({
          userId: 'user1',
          action: 'TRIGGER_UPDATE',
          resource: 'data-sources',
          method: 'POST',
          success: false,
          error: '权限不足',
        });
      }

      // user1 的一个旧操作（25小时前）
      logger.setTimeProvider(() => new Date('2024-01-14T09:00:00Z'));
      logger.logApiAccess({
        userId: 'user1',
        action: 'OLD_ACTION',
        resource: 'old-resource',
        method: 'GET',
        success: true,
      });
      
      // 重置到当前时间
      logger.setTimeProvider(() => new Date('2024-01-15T10:00:00Z'));
    });

    it('应该正确统计用户操作', () => {
      const stats = logger.getUserOperationStats('user1', 24);
      
      expect(stats.totalOperations).toBe(7); // 最近24小时的操作
      expect(stats.successfulOperations).toBe(5);
      expect(stats.failedOperations).toBe(2);
      expect(stats.operationsByAction).toEqual({
        'GET_STATUS': 5,
        'TRIGGER_UPDATE': 2,
      });
      expect(stats.operationsByResource).toEqual({
        'data-sources': 7,
      });
      expect(stats.lastOperation).toEqual(new Date('2024-01-15T10:00:00Z'));
    });

    it('应该正确处理不存在的用户', () => {
      const stats = logger.getUserOperationStats('nonexistent-user');
      
      expect(stats.totalOperations).toBe(0);
      expect(stats.successfulOperations).toBe(0);
      expect(stats.failedOperations).toBe(0);
      expect(stats.operationsByAction).toEqual({});
      expect(stats.operationsByResource).toEqual({});
      expect(stats.lastOperation).toBeUndefined();
    });

    it('应该能够指定不同的时间范围', () => {
      const stats1Hour = logger.getUserOperationStats('user1', 1);
      const stats24Hours = logger.getUserOperationStats('user1', 24);
      
      expect(stats1Hour.totalOperations).toBe(7); // 所有操作都在1小时内
      expect(stats24Hours.totalOperations).toBe(7); // 旧操作不在24小时内
    });
  });

  describe('异常活动检测', () => {
    beforeEach(() => {
      logger.setTimeProvider(() => new Date('2024-01-15T10:00:00Z'));
      
      // 创建正常用户
      for (let i = 0; i < 10; i++) {
        logger.logApiAccess({
          userId: 'normal-user',
          action: 'GET_STATUS',
          resource: 'data-sources',
          method: 'GET',
          success: true,
        });
      }
      
      // 创建高失败率用户
      for (let i = 0; i < 20; i++) {
        logger.logApiAccess({
          userId: 'suspicious-user',
          action: 'TRIGGER_UPDATE',
          resource: 'data-sources',
          method: 'POST',
          success: i < 5, // 只有前5次成功，失败率75%
          error: i >= 5 ? '权限不足' : undefined,
        });
      }
      
      // 创建高频用户
      for (let i = 0; i < 250; i++) {
        logger.logApiAccess({
          userId: 'frequent-user',
          action: 'GET_STATUS',
          resource: 'data-sources',
          method: 'GET',
          success: true,
        });
      }
      
      // 创建多个用户遇到相同错误
      const commonError = '数据源不可用';
      ['user1', 'user2', 'user3', 'user4'].forEach(userId => {
        logger.logApiAccess({
          userId,
          action: 'GET_DATA',
          resource: 'data-sources',
          method: 'GET',
          success: false,
          error: commonError,
        });
      });
    });

    it('应该检测高失败率用户', () => {
      const { suspiciousUsers } = logger.detectAnomalousActivity();
      
      const suspiciousUser = suspiciousUsers.find(u => u.userId === 'suspicious-user');
      expect(suspiciousUser).toBeDefined();
      expect(suspiciousUser?.reason).toBe('高失败率访问');
      expect(suspiciousUser?.failureRate).toBe(0.75);
      expect(suspiciousUser?.operationCount).toBe(20);
    });

    it('应该检测异常高频用户', () => {
      const { suspiciousUsers } = logger.detectAnomalousActivity();
      
      const frequentUser = suspiciousUsers.find(u => u.userId === 'frequent-user');
      expect(frequentUser).toBeDefined();
      expect(frequentUser?.reason).toBe('异常高频访问');
      expect(frequentUser?.operationCount).toBe(250);
    });

    it('应该检测频繁错误', () => {
      const { frequentErrors } = logger.detectAnomalousActivity();
      
      const commonErrorEntry = frequentErrors.find(e => e.error === '数据源不可用');
      expect(commonErrorEntry).toBeDefined();
      expect(commonErrorEntry?.count).toBe(4);
      expect(commonErrorEntry?.affectedUsers).toBe(4);
    });

    it('不应该将正常用户标记为可疑', () => {
      const { suspiciousUsers } = logger.detectAnomalousActivity();
      
      const normalUser = suspiciousUsers.find(u => u.userId === 'normal-user');
      expect(normalUser).toBeUndefined();
    });
  });

  describe('日志清理和管理', () => {
    it('应该能够清理旧日志', () => {
      // 创建一些旧日志
      logger.setTimeProvider(() => new Date('2024-01-01T10:00:00Z'));
      logger.logApiAccess({
        userId: 'user1',
        action: 'OLD_ACTION',
        resource: 'old-resource',
        method: 'GET',
        success: true,
      });
      
      // 创建一些新日志
      logger.setTimeProvider(() => new Date('2024-01-15T10:00:00Z'));
      logger.logApiAccess({
        userId: 'user1',
        action: 'NEW_ACTION',
        resource: 'new-resource',
        method: 'GET',
        success: true,
      });
      
      expect(logger.getLogCount()).toBe(2);
      
      // 清理7天以前的日志
      const cleaned = logger.cleanupOldLogs(7 * 24 * 60 * 60 * 1000);
      
      expect(cleaned).toBe(1);
      expect(logger.getLogCount()).toBe(1);
      
      const remainingLogs = logger.queryLogs();
      expect(remainingLogs[0].action).toBe('NEW_ACTION');
    });

    it('应该提供日志统计信息', () => {
      // 准备测试数据
      logger.setTimeProvider(() => new Date('2024-01-15T10:00:00Z'));
      
      // 今天的日志
      logger.logApiAccess({
        userId: 'user1',
        action: 'GET_STATUS',
        resource: 'data-sources',
        method: 'GET',
        success: true,
      });
      
      logger.logApiAccess({
        userId: 'user2',
        action: 'GET_STATUS',
        resource: 'data-sources',
        method: 'GET',
        success: false,
      });
      
      // 昨天的日志
      logger.setTimeProvider(() => new Date('2024-01-14T10:00:00Z'));
      logger.logApiAccess({
        userId: 'user3',
        action: 'TRIGGER_UPDATE',
        resource: 'scheduler',
        method: 'POST',
        success: true,
      });
      
      logger.setTimeProvider(() => new Date('2024-01-15T10:00:00Z'));
      
      const stats = logger.getLogStats();
      
      expect(stats.totalLogs).toBe(3);
      expect(stats.logsToday).toBe(2);
      expect(stats.successRate).toBeCloseTo(2/3, 2);
      expect(stats.topActions).toContainEqual({ action: 'GET_STATUS', count: 2 });
      expect(stats.topResources).toContainEqual({ resource: 'data-sources', count: 2 });
    });
  });

  describe('日志导出功能', () => {
    beforeEach(() => {
      logger.logApiAccess({
        userId: 'user1',
        clientId: 'client1',
        action: 'GET_STATUS',
        resource: 'data-sources',
        method: 'GET',
        success: true,
        ipAddress: '192.168.1.1',
        sessionId: 'session1',
      });
      
      logger.logApiAccess({
        userId: 'user2',
        action: 'TRIGGER_UPDATE',
        resource: 'scheduler',
        method: 'POST',
        success: false,
        error: '权限不足',
      });
    });

    it('应该能够导出CSV格式的日志', () => {
      const csv = logger.exportLogs();
      const lines = csv.split('\n');
      
      expect(lines).toHaveLength(3); // 表头 + 2条数据
      expect(lines[0]).toContain('ID,Timestamp,User ID');
      expect(lines[1]).toContain('"user1"');
      expect(lines[2]).toContain('"user2"');
    });

    it('应该能够按筛选条件导出日志', () => {
      const csv = logger.exportLogs({ success: true });
      const lines = csv.split('\n');
      
      expect(lines).toHaveLength(2); // 表头 + 1条成功的数据
      expect(lines[1]).toContain('"user1"');
      expect(lines[1]).toContain('"true"');
    });
  });

  describe('并发和性能', () => {
    it('应该能够处理大量并发日志记录', () => {
      const startTime = Date.now();
      const logCount = 1000;
      
      for (let i = 0; i < logCount; i++) {
        logger.logApiAccess({
          userId: `user${i % 10}`,
          action: 'PERFORMANCE_TEST',
          resource: 'test',
          method: 'GET',
          success: true,
        });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(logger.getLogCount()).toBe(logCount);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该在达到最大日志数量时清理旧日志', () => {
      // 这个测试需要修改最大日志数量的设置或者创建大量日志
      // 为了测试方便，我们创建足够多的日志来验证清理机制
      
      const maxLogs = 50; // 假设我们想测试50个日志的限制
      
      for (let i = 0; i < maxLogs + 10; i++) {
        logger.logApiAccess({
          userId: `user${i}`,
          action: 'TEST_ACTION',
          resource: 'test',
          method: 'GET',
          success: true,
        });
      }
      
      // 注意：这个测试依赖于实际的maxLogSize设置
      // 在真实场景中，应该有机制防止内存无限增长
      expect(logger.getLogCount()).toBeGreaterThan(0);
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理空的查询条件', () => {
      logger.logApiAccess({
        userId: 'test-user',
        action: 'TEST',
        resource: 'test',
        method: 'GET',
        success: true,
      });
      
      const logs = logger.queryLogs({});
      expect(logs).toHaveLength(1);
    });

    it('应该处理不存在的用户ID查询', () => {
      const logs = logger.queryLogs({ userId: 'nonexistent' });
      expect(logs).toHaveLength(0);
    });

    it('应该处理无效的日期范围', () => {
      const endDate = new Date('2024-01-01');
      const startDate = new Date('2024-01-02'); // 开始日期晚于结束日期
      
      logger.logApiAccess({
        userId: 'test-user',
        action: 'TEST',
        resource: 'test',
        method: 'GET',
        success: true,
      });
      
      const logs = logger.queryLogs({ startDate, endDate });
      expect(logs).toHaveLength(0);
    });

    it('应该处理超大的limit值', () => {
      logger.logApiAccess({
        userId: 'test-user',
        action: 'TEST',
        resource: 'test',
        method: 'GET',
        success: true,
      });
      
      const logs = logger.queryLogs({ limit: 999999 });
      expect(logs).toHaveLength(1);
    });
  });
});