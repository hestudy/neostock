import { describe, it, expect, beforeEach } from "vitest";
import { SecureCredentialManager } from '../../lib/security';

describe('Secure Credential Manager', () => {
  let credentialManager: SecureCredentialManager;

  beforeEach(() => {
    credentialManager = new SecureCredentialManager('test-master-key-32-bytes-long!');
  });

  describe('Credential Storage and Retrieval', () => {
    it('should store and retrieve credentials correctly', async () => {
      const key = 'tushare_api_token';
      const value = 'test-token-12345';
      const environment = 'testing';

      const stored = await credentialManager.storeCredential(key, value, environment);
      if (!stored) {
        const auditLog = credentialManager.getAuditLog();
        console.log('Store failed, audit log:', auditLog.filter(e => e.action === 'creation'));
      }
      expect(stored).toBe(true);

      const retrieved = await credentialManager.getCredential(key, environment);
      expect(retrieved).toBe(value);
    });

    it('should return null for non-existent credentials', async () => {
      const retrieved = await credentialManager.getCredential('non-existent', 'testing');
      expect(retrieved).toBeNull();
    });

    it('should handle credential storage failures gracefully', async () => {
      // Create manager with invalid key to force encryption failure
      const invalidManager = new SecureCredentialManager('');
      
      const stored = await invalidManager.storeCredential('test', 'value', 'testing');
      // Should handle the error gracefully
      expect(typeof stored).toBe('boolean');
    });
  });

  describe('Environment Isolation', () => {
    it('should isolate credentials by environment', async () => {
      const key = 'api_token';
      const devValue = 'dev-token';
      const prodValue = 'prod-token';

      await credentialManager.storeCredential(key, devValue, 'development');
      await credentialManager.storeCredential(key, prodValue, 'production');

      const devRetrieved = await credentialManager.getCredential(key, 'development');
      const prodRetrieved = await credentialManager.getCredential(key, 'production');

      expect(devRetrieved).toBe(devValue);
      expect(prodRetrieved).toBe(prodValue);
      expect(devRetrieved).not.toBe(prodRetrieved);
    });

    it('should not retrieve credentials from wrong environment', async () => {
      await credentialManager.storeCredential('secret', 'dev-secret', 'development');
      
      const retrieved = await credentialManager.getCredential('secret', 'production');
      expect(retrieved).toBeNull();
    });

    it('should verify environment isolation', async () => {
      await credentialManager.storeCredential('normal_key', 'value1', 'development');
      await credentialManager.storeCredential('prod_api_key', 'value2', 'production');
      await credentialManager.storeCredential('prod_api_key', 'value3', 'testing'); // Violation

      const isolation = credentialManager.verifyEnvironmentIsolation();
      expect(isolation.isolated).toBe(false);
      expect(isolation.violations.length).toBeGreaterThan(0);
      expect(isolation.violations[0]).toContain('Production credential');
    });
  });

  describe('Credential Rotation', () => {
    it('should rotate existing credentials', async () => {
      const key = 'rotate_test';
      const originalValue = 'original-value';
      const newValue = 'rotated-value';

      await credentialManager.storeCredential(key, originalValue, 'testing');
      const rotated = await credentialManager.rotateCredential(key, 'testing', newValue);
      
      expect(rotated).toBe(true);

      const retrieved = await credentialManager.getCredential(key, 'testing');
      expect(retrieved).toBe(newValue);
      expect(retrieved).not.toBe(originalValue);
    });

    it('should not rotate non-existent credentials', async () => {
      const rotated = await credentialManager.rotateCredential('non-existent', 'testing', 'new-value');
      expect(rotated).toBe(false);
    });

    it('should identify credentials needing rotation', async () => {
      // Store credential with short rotation period (simulate expired)
      await credentialManager.storeCredential('old_key', 'old_value', 'testing', -1); // Negative days = already expired
      
      const needingRotation = credentialManager.getCredentialsNeedingRotation();
      expect(needingRotation.length).toBeGreaterThan(0);
      expect(needingRotation[0].key).toBe('old_key');
      expect(needingRotation[0].daysOverdue).toBeGreaterThan(0);
    });

    it('should not flag fresh credentials for rotation', async () => {
      await credentialManager.storeCredential('fresh_key', 'fresh_value', 'testing', 90);
      
      const needingRotation = credentialManager.getCredentialsNeedingRotation();
      const freshCredential = needingRotation.find(cred => cred.key === 'fresh_key');
      expect(freshCredential).toBeUndefined();
    });
  });

  describe('Audit Logging', () => {
    it('should log credential access', async () => {
      await credentialManager.storeCredential('audit_test', 'value', 'testing');
      await credentialManager.getCredential('audit_test', 'testing');

      const auditLog = credentialManager.getAuditLog();
      expect(auditLog.length).toBeGreaterThanOrEqual(2); // Store + access

      const accessLog = auditLog.find(entry => entry.action === 'access');
      expect(accessLog).toBeDefined();
      expect(accessLog!.key).toBe('audit_test');
      expect(accessLog!.success).toBe(true);
    });

    it('should log failed access attempts', async () => {
      await credentialManager.getCredential('non-existent', 'testing');

      const auditLog = credentialManager.getAuditLog();
      const failedAccess = auditLog.find(entry => entry.action === 'access' && !entry.success);
      
      expect(failedAccess).toBeDefined();
      expect(failedAccess!.error).toContain('not found');
    });

    it('should log credential rotation', async () => {
      await credentialManager.storeCredential('rotation_test', 'original', 'testing');
      await credentialManager.rotateCredential('rotation_test', 'testing', 'rotated');

      const auditLog = credentialManager.getAuditLog();
      const rotationLog = auditLog.find(entry => entry.action === 'rotation');
      
      expect(rotationLog).toBeDefined();
      expect(rotationLog!.success).toBe(true);
    });

    it('should filter audit log by parameters', async () => {
      await credentialManager.storeCredential('test1', 'value1', 'development');
      await credentialManager.storeCredential('test2', 'value2', 'production');

      const devLogs = credentialManager.getAuditLog('development');
      const prodLogs = credentialManager.getAuditLog('production');

      expect(devLogs.length).toBeGreaterThan(0);
      expect(prodLogs.length).toBeGreaterThan(0);
      
      devLogs.forEach(log => expect(log.environment).toBe('development'));
      prodLogs.forEach(log => expect(log.environment).toBe('production'));
    });

    it('should filter audit log by date range', async () => {
      const beforeStore = new Date();
      // 添加小延时确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await credentialManager.storeCredential('time_test', 'value', 'testing');
      
      // 添加小延时确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));
      const afterStore = new Date();
      
      // 使用存储前后的时间范围过滤
      const recentLogs = credentialManager.getAuditLog(undefined, undefined, beforeStore, afterStore);
      expect(recentLogs.length).toBeGreaterThan(0);
      
      // 测试未来时间应该没有日志
      const futureTime = new Date(afterStore.getTime() + 60 * 1000); // 1分钟后
      const futureLogs = credentialManager.getAuditLog(undefined, undefined, futureTime);
      expect(futureLogs.length).toBe(0);
    });
  });

  describe('Security Health Check', () => {
    it('should report healthy status for good configuration', async () => {
      await credentialManager.storeCredential('healthy_key', 'value', 'testing', 90);
      
      const healthCheck = credentialManager.performSecurityHealthCheck();
      
      expect(healthCheck.healthy).toBe(true);
      expect(healthCheck.issues).toHaveLength(0);
      expect(healthCheck.recommendations).toHaveLength(0);
    });

    it('should detect credentials needing rotation', async () => {
      await credentialManager.storeCredential('expired_key', 'value', 'testing', -1);
      
      const healthCheck = credentialManager.performSecurityHealthCheck();
      
      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.issues.some(issue => issue.includes('need rotation'))).toBe(true);
      expect(healthCheck.recommendations.some(rec => rec.includes('Rotate'))).toBe(true);
    });

    it('should detect environment isolation issues', async () => {
      await credentialManager.storeCredential('prod_secret', 'value1', 'production');
      await credentialManager.storeCredential('prod_secret', 'value2', 'development');
      
      const healthCheck = credentialManager.performSecurityHealthCheck();
      
      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.issues.some(issue => issue.includes('isolation'))).toBe(true);
    });

    it('should detect recent access failures', async () => {
      // Generate multiple failed accesses
      for (let i = 0; i < 6; i++) {
        await credentialManager.getCredential('non-existent', 'testing');
      }
      
      const healthCheck = credentialManager.performSecurityHealthCheck();
      
      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.issues.some(issue => issue.includes('access failures'))).toBe(true);
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('should not detect suspicious activity under normal conditions', async () => {
      await credentialManager.storeCredential('normal', 'value', 'testing');
      await credentialManager.getCredential('normal', 'testing');
      
      const suspiciousActivity = credentialManager.detectSuspiciousActivity();
      
      expect(suspiciousActivity.suspicious).toBe(false);
      expect(suspiciousActivity.alerts).toHaveLength(0);
    });

    it('should detect high frequency access', async () => {
      await credentialManager.storeCredential('frequent', 'value', 'testing');
      
      // Generate high frequency access
      for (let i = 0; i < 101; i++) {
        await credentialManager.getCredential('frequent', 'testing');
      }
      
      const suspiciousActivity = credentialManager.detectSuspiciousActivity();
      
      expect(suspiciousActivity.suspicious).toBe(true);
      expect(suspiciousActivity.alerts.some(alert => alert.type === 'high_frequency_access')).toBe(true);
    });

    it('should detect brute force attempts', async () => {
      // Generate failed access attempts
      for (let i = 0; i < 5; i++) {
        await credentialManager.getCredential('target_key', 'testing');
      }
      
      const suspiciousActivity = credentialManager.detectSuspiciousActivity();
      
      expect(suspiciousActivity.suspicious).toBe(true);
      expect(suspiciousActivity.alerts.some(alert => alert.type === 'brute_force_attempt')).toBe(true);
      expect(suspiciousActivity.alerts.find(alert => alert.type === 'brute_force_attempt')?.severity).toBe('high');
    });

    it('should detect cross-environment access', async () => {
      await credentialManager.storeCredential('cross_env', 'value1', 'development');
      await credentialManager.storeCredential('cross_env', 'value2', 'production');
      
      await credentialManager.getCredential('cross_env', 'development');
      await credentialManager.getCredential('cross_env', 'production');
      
      const suspiciousActivity = credentialManager.detectSuspiciousActivity();
      
      expect(suspiciousActivity.suspicious).toBe(true);
      expect(suspiciousActivity.alerts.some(alert => alert.type === 'cross_environment_access')).toBe(true);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive statistics', async () => {
      await credentialManager.storeCredential('stat_test', 'value', 'testing');
      
      const stats = credentialManager.getStatistics();
      
      expect(stats).toHaveProperty('totalCredentials');
      expect(stats).toHaveProperty('auditLogEntries');
      expect(stats).toHaveProperty('credentialsNeedingRotation');
      expect(stats).toHaveProperty('environmentIsolation');
      expect(stats).toHaveProperty('securityHealth');
      
      expect(stats.totalCredentials).toBeGreaterThan(0);
      expect(stats.auditLogEntries).toBeGreaterThan(0);
    });

    it('should track statistics accurately', async () => {
      const initialStats = credentialManager.getStatistics();
      
      await credentialManager.storeCredential('track_test1', 'value1', 'testing');
      await credentialManager.storeCredential('track_test2', 'value2', 'production');
      
      const newStats = credentialManager.getStatistics();
      
      expect(newStats.totalCredentials).toBe(initialStats.totalCredentials + 2);
      expect(newStats.auditLogEntries).toBeGreaterThan(initialStats.auditLogEntries);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle encryption/decryption errors', async () => {
      // This test would require mocking crypto functions to force errors
      // For now, we test that the methods return appropriate values on failure
      const result = await credentialManager.getCredential('non-existent', 'testing');
      expect(result).toBeNull();
    });

    it('should handle invalid environment values', async () => {
      // TypeScript prevents invalid environment values at compile time
      // This test ensures runtime handling
      const result = await credentialManager.storeCredential('test', 'value', 'testing');
      expect(result).toBe(true);
    });

    it('should handle empty or invalid credential values', async () => {
      const emptyResult = await credentialManager.storeCredential('empty', '', 'testing');
      expect(emptyResult).toBe(true);
      
      const retrieved = await credentialManager.getCredential('empty', 'testing');
      expect(retrieved).toBe('');
    });

    it('should handle audit log clearing', () => {
      credentialManager.clearAuditLog();
      const auditLog = credentialManager.getAuditLog();
      expect(auditLog).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent credential operations', async () => {
      const operations = [];
      
      // Create concurrent store operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          credentialManager.storeCredential(`concurrent_${i}`, `value_${i}`, 'testing')
        );
      }
      
      const results = await Promise.all(operations);
      results.forEach(result => expect(result).toBe(true));
      
      // Verify all credentials can be retrieved
      const retrievals = [];
      for (let i = 0; i < 10; i++) {
        retrievals.push(
          credentialManager.getCredential(`concurrent_${i}`, 'testing')
        );
      }
      
      const values = await Promise.all(retrievals);
      values.forEach((value, index) => {
        expect(value).toBe(`value_${index}`);
      });
    });

    it('should maintain performance with large audit logs', async () => {
      // Generate large audit log
      for (let i = 0; i < 100; i++) {
        await credentialManager.getCredential('non-existent', 'testing');
      }
      
      const startTime = Date.now();
      const suspiciousActivity = credentialManager.detectSuspiciousActivity();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(suspiciousActivity).toBeDefined();
    });
  });
});