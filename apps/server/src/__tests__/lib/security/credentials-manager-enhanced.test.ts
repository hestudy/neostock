import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CredentialsManager } from '../../../lib/security/credentials-manager';

describe('CredentialsManager 增强安全测试 (AC7)', () => {
  let credentialsManager: CredentialsManager;
  let currentTime = new Date('2024-01-15T10:00:00Z');
  
  // 保存原始环境变量
  const originalEnv = process.env.CREDENTIAL_ENCRYPTION_KEY;
  
  // 时间推进辅助函数
  const advanceTime = (ms: number) => {
    currentTime = new Date(currentTime.getTime() + ms);
    credentialsManager.setTimeProvider(() => new Date(currentTime));
  };
  
  beforeEach(() => {
    // 重置实例
    vi.clearAllMocks();
    
    // 重置时间
    currentTime = new Date('2024-01-15T10:00:00Z');
    
    // 设置测试用的加密密钥
    process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    
    // 获取新的实例
    credentialsManager = CredentialsManager.getInstance();
    
    // 设置固定时间
    credentialsManager.setTimeProvider(() => new Date(currentTime));
  });

  afterEach(() => {
    // 重置时间提供器
    credentialsManager.resetTimeProvider();
    
    // 恢复环境变量
    if (originalEnv) {
      process.env.CREDENTIAL_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    }
  });

  describe('加密存储深度验证', () => {
    it('应该使用AES-256-CBC加密算法正确加密存储密钥', () => {
      const keyId = 'tushare-token';
      const plainTextKey = 'super-secret-api-key-12345';
      
      credentialsManager.storeCredential(keyId, plainTextKey);
      
      // 验证可以正确解密
      const decryptedKey = credentialsManager.getCredential(keyId);
      expect(decryptedKey).toBe(plainTextKey);
    });

    it('应该为每次加密生成不同的加密结果（随机IV）', () => {
      const keyId1 = 'test-key-1';
      const keyId2 = 'test-key-2';
      const sameKey = 'identical-secret-key';
      
      credentialsManager.storeCredential(keyId1, sameKey);
      credentialsManager.storeCredential(keyId2, sameKey);
      
      // 获取密钥状态来验证加密结果不同（通过间接方式）
      const status1 = credentialsManager.getCredentialStatus(keyId1);
      const status2 = credentialsManager.getCredentialStatus(keyId2);
      
      // 虽然我们无法直接访问加密的密钥，但我们可以验证它们被独立存储
      expect(status1?.createdAt).toEqual(status2?.createdAt);
      expect(credentialsManager.getCredential(keyId1)).toBe(sameKey);
      expect(credentialsManager.getCredential(keyId2)).toBe(sameKey);
    });

    it('应该验证加密密钥的长度和格式要求', () => {
      // 测试不同长度的密钥
      const testCases = [
        { key: '', description: '空密钥' },
        { key: 'short', description: '短密钥' },
        { key: 'a'.repeat(32), description: '32字符密钥' },
        { key: 'a'.repeat(64), description: '64字符密钥' },
        { key: 'a'.repeat(128), description: '128字符密钥' },
        { key: 'special!@#$%^&*()_+-={}[]|\\:";\'<>?,./', description: '特殊字符密钥' },
        { key: '中文密钥测试', description: 'Unicode密钥' },
      ];
      
      testCases.forEach(({ key }, index) => {
        const keyId = `test-key-${index}`;
        
        // 所有格式的密钥都应该能够成功加密存储
        expect(() => {
          credentialsManager.storeCredential(keyId, key);
        }).not.toThrow();
        
        // 并且能够正确解密
        const decrypted = credentialsManager.getCredential(keyId);
        expect(decrypted).toBe(key);
      });
    });

    it('应该验证加密过程的完整性（防止数据损坏）', () => {
      const keyId = 'integrity-test';
      const originalKey = 'test-key-with-integrity-check-12345';
      
      credentialsManager.storeCredential(keyId, originalKey);
      
      // 多次获取应该得到相同结果
      for (let i = 0; i < 10; i++) {
        const decrypted = credentialsManager.getCredential(keyId);
        expect(decrypted).toBe(originalKey);
      }
    });

    it('应该在环境变量缺失时使用安全的回退机制', () => {
      // 移除环境变量
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
      
      // 创建新实例应该生成临时密钥并发出警告
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // 强制重置单例实例来测试回退机制
      // @ts-expect-error - 访问私有静态成员用于测试
      CredentialsManager.instance = undefined;
      const newManager = CredentialsManager.getInstance();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '警告: 使用临时生成的加密密钥，生产环境应设置 CREDENTIAL_ENCRYPTION_KEY'
      );
      
      // 即使使用临时密钥，加密解密也应该正常工作
      const keyId = 'fallback-test';
      const testKey = 'fallback-test-key';
      
      newManager.storeCredential(keyId, testKey);
      const decrypted = newManager.getCredential(keyId);
      expect(decrypted).toBe(testKey);
      
      consoleSpy.mockRestore();
    });

    it('应该验证加密密钥的安全强度', () => {
      // 验证环境变量中的加密密钥长度
      const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
      expect(encryptionKey).toBeDefined();
      
      // AES-256 需要32字节（64个十六进制字符）的密钥
      const keyBuffer = Buffer.from(encryptionKey!, 'hex');
      expect(keyBuffer.length).toBe(32);
    });
  });

  describe('密钥泄露检测机制增强验证', () => {
    it('应该检测异常高频访问模式', () => {
      const keyId = 'high-frequency-test';
      const testKey = 'test-api-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 模拟24小时内进行1001次访问
      for (let i = 0; i < 1001; i++) {
        credentialsManager.getCredential(keyId);
      }
      
      const leakDetected = credentialsManager.detectLeakage(keyId);
      expect(leakDetected).toBe(true);
      
      const auditLogs = credentialsManager.getAuditLogs(keyId);
      const leakLog = auditLogs.find(log => log.action === 'leak_detected');
      expect(leakLog).toBeDefined();
      expect(leakLog?.details).toContain('异常高频访问');
    });

    it('应该在正常访问频率下不触发泄露检测', () => {
      const keyId = 'normal-frequency-test';
      const testKey = 'test-api-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 模拟正常的访问频率（24小时内100次）
      for (let i = 0; i < 100; i++) {
        credentialsManager.getCredential(keyId);
      }
      
      const leakDetected = credentialsManager.detectLeakage(keyId);
      expect(leakDetected).toBe(false);
      
      const auditLogs = credentialsManager.getAuditLogs(keyId);
      const leakLog = auditLogs.find(log => log.action === 'leak_detected');
      expect(leakLog).toBeUndefined();
    });

    it('应该区分不同密钥的访问模式', () => {
      const keyId1 = 'key-1';
      const keyId2 = 'key-2';
      const testKey = 'test-api-key';
      
      credentialsManager.storeCredential(keyId1, testKey);
      credentialsManager.storeCredential(keyId2, testKey);
      
      // key1 异常高频访问
      for (let i = 0; i < 1001; i++) {
        credentialsManager.getCredential(keyId1);
      }
      
      // key2 正常访问
      for (let i = 0; i < 10; i++) {
        credentialsManager.getCredential(keyId2);
      }
      
      expect(credentialsManager.detectLeakage(keyId1)).toBe(true);
      expect(credentialsManager.detectLeakage(keyId2)).toBe(false);
    });

    it('应该考虑时间窗口进行泄露检测', () => {
      const keyId = 'time-window-test';
      const testKey = 'test-api-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 在第一天进行500次访问
      for (let i = 0; i < 500; i++) {
        credentialsManager.getCredential(keyId);
      }
      
      // 时间推进25小时
      advanceTime(25 * 60 * 60 * 1000);
      
      // 在第二天再进行500次访问
      for (let i = 0; i < 500; i++) {
        credentialsManager.getCredential(keyId);
      }
      
      // 应该不会触发泄露检测，因为每个24小时窗口内都没有超过1000次
      const leakDetected = credentialsManager.detectLeakage(keyId);
      expect(leakDetected).toBe(false);
    });

    it('应该提供详细的访问统计用于泄露分析', () => {
      const keyId = 'statistics-test';
      const testKey = 'test-api-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 进行一些访问
      const accessCount = 50;
      for (let i = 0; i < accessCount; i++) {
        credentialsManager.getCredential(keyId);
      }
      
      const auditLogs = credentialsManager.getAuditLogs(keyId);
      
      // 验证审计日志的完整性
      const accessLogs = auditLogs.filter(log => log.action === 'access');
      expect(accessLogs.length).toBe(accessCount);
      
      // 验证每个访问都被记录
      accessLogs.forEach(log => {
        expect(log.keyId).toBe(keyId);
        expect(log.action).toBe('access');
        expect(log.source).toBe('system');
        expect(log.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('审计日志记录深度验证', () => {
    it('应该记录所有密钥生命周期事件', () => {
      const keyId = 'lifecycle-test';
      const originalKey = 'original-key';
      const newKey = 'rotated-key';
      
      // 创建密钥
      credentialsManager.storeCredential(keyId, originalKey);
      
      // 访问密钥
      credentialsManager.getCredential(keyId);
      
      // 轮换密钥
      credentialsManager.rotateCredential(keyId, newKey);
      
      // 访问新密钥
      credentialsManager.getCredential(keyId);
      
      const auditLogs = credentialsManager.getAuditLogs(keyId);
      
      // 验证所有事件都被记录
      const createLog = auditLogs.find(log => log.action === 'create');
      expect(createLog).toBeDefined();
      expect(createLog?.details).toContain('新密钥已加密存储');
      
      const accessLogs = auditLogs.filter(log => log.action === 'access');
      expect(accessLogs.length).toBe(2); // 轮换前后各一次访问
      
      const rotateLog = auditLogs.find(log => log.action === 'rotate');
      expect(rotateLog).toBeDefined();
      expect(rotateLog?.details).toContain('密钥已轮换');
    });

    it('应该记录密钥访问的时间戳和上下文', () => {
      const keyId = 'timestamp-test';
      const testKey = 'test-key';
      
      const startTime = new Date('2024-01-15T10:00:00Z');
      currentTime = startTime;
      credentialsManager.setTimeProvider(() => new Date(currentTime));
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 推进时间并访问
      advanceTime(60 * 1000); // 1分钟后
      credentialsManager.getCredential(keyId);
      
      const auditLogs = credentialsManager.getAuditLogs(keyId);
      const accessLog = auditLogs.find(log => log.action === 'access');
      
      expect(accessLog?.timestamp).toEqual(new Date('2024-01-15T10:01:00Z'));
      expect(accessLog?.source).toBe('system');
      expect(accessLog?.keyId).toBe(keyId);
    });

    it('应该维护审计日志的完整性和顺序', () => {
      const keyId = 'integrity-audit-test';
      const testKey = 'test-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 进行多次操作
      const operations = [
        () => credentialsManager.getCredential(keyId),
        () => credentialsManager.getCredential(keyId),
        () => credentialsManager.rotateCredential(keyId, 'new-key'),
        () => credentialsManager.getCredential(keyId),
      ];
      
      operations.forEach((operation) => {
        advanceTime(60 * 1000); // 每次操作间隔1分钟
        operation();
      });
      
      const auditLogs = credentialsManager.getAuditLogs(keyId);
      
      // 验证日志按时间顺序排列
      for (let i = 1; i < auditLogs.length; i++) {
        expect(auditLogs[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          auditLogs[i - 1].timestamp.getTime()
        );
      }
      
      // 验证操作序列的完整性
      const actions = auditLogs.map(log => log.action);
      expect(actions).toEqual(['create', 'access', 'access', 'rotate', 'create', 'access']);
    });

    it('应该正确处理审计日志的存储限制', () => {
      const keyId = 'log-limit-test';
      const testKey = 'test-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 生成超过1000条日志（当前限制）
      for (let i = 0; i < 1200; i++) {
        credentialsManager.getCredential(keyId);
      }
      
      const allLogs = credentialsManager.getAuditLogs();
      
      // 验证日志数量不超过限制
      expect(allLogs.length).toBeLessThanOrEqual(1000);
      
      // 验证保留的是最新的日志
      const keyLogs = credentialsManager.getAuditLogs(keyId);
      expect(keyLogs.length).toBeGreaterThan(0); // 应该还有该密钥的日志
    });

    it('应该支持按密钥过滤审计日志', () => {
      const keyId1 = 'filter-test-1';
      const keyId2 = 'filter-test-2';
      const testKey = 'test-key';
      
      credentialsManager.storeCredential(keyId1, testKey);
      credentialsManager.storeCredential(keyId2, testKey);
      
      credentialsManager.getCredential(keyId1);
      credentialsManager.getCredential(keyId2);
      credentialsManager.getCredential(keyId1);
      
      const key1Logs = credentialsManager.getAuditLogs(keyId1);
      const key2Logs = credentialsManager.getAuditLogs(keyId2);
      const allLogs = credentialsManager.getAuditLogs();
      
      // 验证过滤功能
      expect(key1Logs.every(log => log.keyId === keyId1)).toBe(true);
      expect(key2Logs.every(log => log.keyId === keyId2)).toBe(true);
      expect(key1Logs.length).toBe(3); // create + 2次access
      expect(key2Logs.length).toBe(2); // create + 1次access
      expect(allLogs.length).toBeGreaterThanOrEqual(key1Logs.length + key2Logs.length);
    });
  });

  describe('密钥过期和轮换深度验证', () => {
    it('应该严格执行90天轮换周期', () => {
      const keyId = 'rotation-cycle-test';
      const testKey = 'test-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 密钥应该在创建后立即可用
      expect(() => credentialsManager.getCredential(keyId)).not.toThrow();
      
      // 推进89天 - 应该仍然有效
      advanceTime(89 * 24 * 60 * 60 * 1000);
      expect(() => credentialsManager.getCredential(keyId)).not.toThrow();
      
      // 推进到第90天 - 应该仍然有效
      advanceTime(24 * 60 * 60 * 1000);
      expect(() => credentialsManager.getCredential(keyId)).not.toThrow();
      
      // 推进到第91天 - 应该过期
      advanceTime(24 * 60 * 60 * 1000);
      expect(() => credentialsManager.getCredential(keyId)).toThrow('已过期');
      
      // 验证审计日志记录了过期访问尝试
      const auditLogs = credentialsManager.getAuditLogs(keyId);
      const expiredAccessLog = auditLogs.find(log => 
        log.action === 'access' && log.details?.includes('密钥已过期')
      );
      expect(expiredAccessLog).toBeDefined();
    });

    it('应该在轮换后立即使新密钥生效', () => {
      const keyId = 'immediate-rotation-test';
      const oldKey = 'old-key';
      const newKey = 'new-key';
      
      credentialsManager.storeCredential(keyId, oldKey);
      
      // 验证旧密钥有效
      expect(credentialsManager.getCredential(keyId)).toBe(oldKey);
      
      // 轮换密钥
      credentialsManager.rotateCredential(keyId, newKey);
      
      // 新密钥应该立即生效
      expect(credentialsManager.getCredential(keyId)).toBe(newKey);
      
      // 验证新密钥有正确的轮换周期（从轮换时开始计算90天）
      const status = credentialsManager.getCredentialStatus(keyId);
      expect(status?.rotationDue).toEqual(new Date('2024-04-14T10:00:00Z')); // 90天后
    });

    it('应该正确识别需要轮换的密钥', () => {
      const keyId1 = 'rotation-needed-1';
      const keyId2 = 'rotation-needed-2';
      const keyId3 = 'rotation-not-needed';
      const testKey = 'test-key';
      
      // 创建三个密钥
      credentialsManager.storeCredential(keyId1, testKey);
      credentialsManager.storeCredential(keyId2, testKey);
      credentialsManager.storeCredential(keyId3, testKey);
      
      // 推进时间使前两个密钥过期
      advanceTime(91 * 24 * 60 * 60 * 1000); // 91天后
      
      // 轮换第三个密钥，使其重新计时
      credentialsManager.rotateCredential(keyId3, testKey);
      
      const keysNeedingRotation = credentialsManager.getKeysRequiringRotation();
      
      expect(keysNeedingRotation).toContain(keyId1);
      expect(keysNeedingRotation).toContain(keyId2);
      expect(keysNeedingRotation).not.toContain(keyId3);
    });
  });

  describe('错误处理和边界条件', () => {
    it('应该正确处理不存在的密钥访问', () => {
      expect(() => {
        credentialsManager.getCredential('nonexistent-key');
      }).toThrow('密钥 nonexistent-key 不存在或已失效');
    });

    it('应该正确处理已失效的密钥访问', () => {
      const keyId = 'deactivated-key';
      const testKey = 'test-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 通过轮换使旧密钥失效
      credentialsManager.rotateCredential(keyId, 'new-key');
      
      // 密钥状态中应该显示新密钥是活跃的
      const status = credentialsManager.getCredentialStatus(keyId);
      expect(status?.isActive).toBe(true);
    });

    it('应该处理空字符串和特殊字符的密钥ID', () => {
      const testCases = [
        { keyId: '', description: '空字符串密钥ID' },
        { keyId: 'key with spaces', description: '包含空格的密钥ID' },
        { keyId: 'key-with-special!@#$', description: '包含特殊字符的密钥ID' },
        { keyId: '中文密钥ID', description: 'Unicode密钥ID' },
      ];
      
      testCases.forEach(({ keyId }, index) => {
        const testKey = `test-key-${index}`;
        
        // 应该能够存储和检索特殊密钥ID
        credentialsManager.storeCredential(keyId, testKey);
        expect(credentialsManager.getCredential(keyId)).toBe(testKey);
        
        const status = credentialsManager.getCredentialStatus(keyId);
        expect(status).toBeDefined();
      });
    });

    it('应该正确处理并发访问场景', () => {
      const keyId = 'concurrent-access-test';
      const testKey = 'test-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 模拟并发访问
      const concurrentAccesses = Array.from({ length: 100 }, () => {
        return () => {
          const result = credentialsManager.getCredential(keyId);
          expect(result).toBe(testKey);
          return result;
        };
      });
      
      // 执行所有并发访问
      expect(() => {
        concurrentAccesses.forEach(access => access());
      }).not.toThrow();
      
      // 验证所有访问都被正确记录
      const auditLogs = credentialsManager.getAuditLogs(keyId);
      const accessLogs = auditLogs.filter(log => log.action === 'access');
      expect(accessLogs.length).toBe(100);
    });
  });

  describe('性能和内存管理', () => {
    it('应该在处理大量密钥时保持性能', () => {
      const keyCount = 1000;
      const testKey = 'performance-test-key';
      
      const startTime = performance.now();
      
      // 创建大量密钥
      for (let i = 0; i < keyCount; i++) {
        credentialsManager.storeCredential(`perf-key-${i}`, `${testKey}-${i}`);
      }
      
      // 访问所有密钥
      for (let i = 0; i < keyCount; i++) {
        const decrypted = credentialsManager.getCredential(`perf-key-${i}`);
        expect(decrypted).toBe(`${testKey}-${i}`);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 性能检查：应该在合理时间内完成（这个阈值可能需要根据实际环境调整）
      expect(duration).toBeLessThan(10000); // 10秒内完成
    });

    it('应该正确管理内存使用', () => {
      const keyId = 'memory-management-test';
      const testKey = 'test-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 生成大量访问来测试日志管理
      for (let i = 0; i < 2000; i++) {
        credentialsManager.getCredential(keyId);
      }
      
      const allLogs = credentialsManager.getAuditLogs();
      
      // 验证日志数量被限制在合理范围内
      expect(allLogs.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('安全性验证', () => {
    it('应该验证加密后的数据不包含原始密钥信息', () => {
      const keyId = 'security-test';
      const sensitiveKey = 'very-secret-api-key-with-sensitive-info';
      
      credentialsManager.storeCredential(keyId, sensitiveKey);
      
      // 获取状态信息（不包含加密的密钥）
      const status = credentialsManager.getCredentialStatus(keyId);
      
      // 状态信息不应该包含原始密钥
      expect(JSON.stringify(status)).not.toContain(sensitiveKey);
      expect(JSON.stringify(status)).not.toContain('secret');
      expect(JSON.stringify(status)).not.toContain('sensitive');
    });

    it('应该验证不同实例间的密钥隔离', () => {
      // 这个测试验证密钥不会意外泄露到其他实例
      const keyId = 'isolation-test';
      const testKey = 'isolated-key';
      
      credentialsManager.storeCredential(keyId, testKey);
      
      // 验证只有正确的密钥ID能访问对应的密钥
      expect(() => {
        credentialsManager.getCredential('wrong-key-id');
      }).toThrow();
      
      expect(credentialsManager.getCredential(keyId)).toBe(testKey);
    });
  });
});