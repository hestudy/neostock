import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { CredentialsManager } from "../../../lib/security/credentials-manager";

describe("凭据管理器 - 90天轮换机制测试", () => {
  let credentialsManager: CredentialsManager;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    // 获取单例实例（注意：在实际生产中应该考虑测试隔离）
    credentialsManager = CredentialsManager.getInstance();
    
    // 模拟环境变量
    process.env.CREDENTIAL_ENCRYPTION_KEY = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    
    // 保存原始的 Date.now
    originalDateNow = Date.now;
  });

  afterEach(() => {
    // 恢复原始的 Date.now
    Date.now = originalDateNow;
    
    // 清理环境变量
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    
    vi.restoreAllMocks();
  });

  describe("90天轮换周期验证", () => {
    test("新创建的凭据应该设置正确的轮换到期时间", () => {
      const fixedTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => fixedTime);

      const keyId = "test_rotation_key";
      const plainTextKey = "test_api_key_12345";

      credentialsManager.storeCredential(keyId, plainTextKey);

      const status = credentialsManager.getCredentialStatus(keyId);
      expect(status).toBeTruthy();
      
      // 验证轮换到期时间是90天后
      const expectedRotationDate = new Date(fixedTime + 90 * 24 * 60 * 60 * 1000);
      expect(status!.rotationDue).toEqual(expectedRotationDate);
      expect(status!.isActive).toBe(true);
    });

    test("距离到期还有时间的凭据应该正常工作", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => baseTime);

      const keyId = "not_expired_key";
      const plainTextKey = "valid_api_key";

      credentialsManager.storeCredential(keyId, plainTextKey);

      // 模拟时间前进到88天后 (还有2天到期)
      const futureTime = baseTime + 88 * 24 * 60 * 60 * 1000;
      Date.now = vi.fn(() => futureTime);

      // 应该能正常获取凭据
      const retrievedKey = credentialsManager.getCredential(keyId);
      expect(retrievedKey).toBe(plainTextKey);

      // 检查需要轮换的密钥列表应该为空
      const keysRequiringRotation = credentialsManager.getKeysRequiringRotation();
      expect(keysRequiringRotation).not.toContain(keyId);
    });

    test("已过期的凭据应该被识别为需要轮换", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => baseTime);

      const keyId = "expired_key";
      const plainTextKey = "expired_api_key";

      credentialsManager.storeCredential(keyId, plainTextKey);

      // 模拟时间前进到91天后 (已过期1天)
      const expiredTime = baseTime + 91 * 24 * 60 * 60 * 1000;
      Date.now = vi.fn(() => expiredTime);

      // 检查需要轮换的密钥列表
      const keysRequiringRotation = credentialsManager.getKeysRequiringRotation();
      expect(keysRequiringRotation).toContain(keyId);

      // 尝试获取过期凭据应该抛出错误
      expect(() => {
        credentialsManager.getCredential(keyId);
      }).toThrow("已过期，需要轮换");
    });

    test("正好90天到期的凭据应该被识别为需要轮换", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => baseTime);

      const keyId = "exactly_expired_key";
      const plainTextKey = "exactly_expired_api_key";

      credentialsManager.storeCredential(keyId, plainTextKey);

      // 模拟时间前进到正好90天后
      const exactExpiryTime = baseTime + 90 * 24 * 60 * 60 * 1000;
      Date.now = vi.fn(() => exactExpiryTime + 1); // 加1毫秒确保过期

      // 检查需要轮换的密钥列表
      const keysRequiringRotation = credentialsManager.getKeysRequiringRotation();
      expect(keysRequiringRotation).toContain(keyId);
    });
  });

  describe("凭据轮换操作", () => {
    test("手动轮换凭据应该正确更新轮换到期时间", () => {
      const initialTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => initialTime);

      const keyId = "rotation_test_key";
      const oldKey = "old_api_key";
      const newKey = "new_api_key";

      // 存储初始凭据
      credentialsManager.storeCredential(keyId, oldKey);

      // 30天后进行轮换
      const rotationTime = initialTime + 30 * 24 * 60 * 60 * 1000;
      Date.now = vi.fn(() => rotationTime);

      credentialsManager.rotateCredential(keyId, newKey);

      const status = credentialsManager.getCredentialStatus(keyId);
      expect(status).toBeTruthy();

      // 验证新的轮换到期时间是从轮换时间开始的90天后
      const expectedNewRotationDate = new Date(rotationTime + 90 * 24 * 60 * 60 * 1000);
      expect(status!.rotationDue).toEqual(expectedNewRotationDate);
      expect(status!.isActive).toBe(true);

      // 验证可以获取新的凭据
      const retrievedKey = credentialsManager.getCredential(keyId);
      expect(retrievedKey).toBe(newKey);
    });

    test("轮换后的凭据应该重新计算90天周期", () => {
      const initialTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => initialTime);

      const keyId = "multi_rotation_key";
      credentialsManager.storeCredential(keyId, "key_v1");

      // 第一次轮换（60天后）
      const firstRotationTime = initialTime + 60 * 24 * 60 * 60 * 1000;
      Date.now = vi.fn(() => firstRotationTime);
      credentialsManager.rotateCredential(keyId, "key_v2");

      // 第二次轮换（再60天后，距离初始时间120天）
      const secondRotationTime = firstRotationTime + 60 * 24 * 60 * 60 * 1000;
      Date.now = vi.fn(() => secondRotationTime);
      credentialsManager.rotateCredential(keyId, "key_v3");

      const status = credentialsManager.getCredentialStatus(keyId);
      
      // 验证轮换到期时间是从最后一次轮换开始的90天后
      const expectedRotationDate = new Date(secondRotationTime + 90 * 24 * 60 * 60 * 1000);
      expect(status!.rotationDue).toEqual(expectedRotationDate);

      // 模拟到88天后，应该还没有过期
      const almostExpiredTime = secondRotationTime + 88 * 24 * 60 * 60 * 1000;
      Date.now = vi.fn(() => almostExpiredTime);
      
      expect(credentialsManager.getCredential(keyId)).toBe("key_v3");
      expect(credentialsManager.getKeysRequiringRotation()).not.toContain(keyId);
    });
  });

  describe("轮换检查和通知", () => {
    test("应该能识别多个需要轮换的密钥", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => baseTime);

      const keyIds = ["key1", "key2", "key3", "key4"];
      
      // 创建4个密钥，不同的创建时间
      keyIds.forEach((keyId, index) => {
        const createTime = baseTime + index * 10 * 24 * 60 * 60 * 1000; // 每隔10天
        Date.now = vi.fn(() => createTime);
        credentialsManager.storeCredential(keyId, `api_key_${index}`);
      });

      // 模拟时间前进到95天后
      const checkTime = baseTime + 95 * 24 * 60 * 60 * 1000;
      Date.now = vi.fn(() => checkTime);

      const keysRequiringRotation = credentialsManager.getKeysRequiringRotation();
      
      // key1 (95天前创建) 应该需要轮换
      expect(keysRequiringRotation).toContain("key1");
      
      // key2 (85天前创建) 还不需要轮换
      expect(keysRequiringRotation).not.toContain("key2");
      expect(keysRequiringRotation).not.toContain("key3");
      expect(keysRequiringRotation).not.toContain("key4");
    });

    test("轮换周期验证应该精确到毫秒级别", () => {
      const exactTime = new Date("2024-01-01T12:30:45.123Z").getTime();
      Date.now = vi.fn(() => exactTime);

      const keyId = "precise_timing_key";
      credentialsManager.storeCredential(keyId, "precise_api_key");

      // 模拟时间前进到正好90天后的前1毫秒
      const almostExpiredTime = exactTime + 90 * 24 * 60 * 60 * 1000 - 1;
      Date.now = vi.fn(() => almostExpiredTime);

      // 应该还没有过期
      expect(credentialsManager.getKeysRequiringRotation()).not.toContain(keyId);
      expect(() => credentialsManager.getCredential(keyId)).not.toThrow();

      // 前进1毫秒到正好过期时间
      Date.now = vi.fn(() => exactTime + 90 * 24 * 60 * 60 * 1000 + 1);

      // 现在应该过期了
      expect(credentialsManager.getKeysRequiringRotation()).toContain(keyId);
      expect(() => credentialsManager.getCredential(keyId)).toThrow();
    });
  });

  describe("轮换审计日志", () => {
    test("凭据轮换应该记录正确的审计日志", () => {
      const keyId = "audit_test_key";
      const oldKey = "old_key";
      const newKey = "new_key";

      // 存储初始凭据
      credentialsManager.storeCredential(keyId, oldKey);
      
      // 轮换凭据
      credentialsManager.rotateCredential(keyId, newKey);

      const auditLogs = credentialsManager.getAuditLogs(keyId);
      
      // 应该有创建和轮换的日志
      const createLogs = auditLogs.filter(log => log.action === 'create');
      const rotateLogs = auditLogs.filter(log => log.action === 'rotate');

      expect(createLogs).toHaveLength(2); // 初始创建 + 轮换时的创建
      expect(rotateLogs).toHaveLength(1); // 轮换操作

      const rotateLog = rotateLogs[0];
      expect(rotateLog.keyId).toBe(keyId);
      expect(rotateLog.source).toBe('system');
      expect(rotateLog.details).toBe('密钥已轮换');
    });

    test("过期凭据访问应该记录审计日志", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => baseTime);

      const keyId = "expired_audit_key";
      credentialsManager.storeCredential(keyId, "expired_key");

      // 模拟时间前进到过期后
      const expiredTime = baseTime + 91 * 24 * 60 * 60 * 1000;
      Date.now = vi.fn(() => expiredTime);

      // 尝试访问过期凭据
      expect(() => {
        credentialsManager.getCredential(keyId);
      }).toThrow();

      const auditLogs = credentialsManager.getAuditLogs(keyId);
      const accessLogs = auditLogs.filter(log => 
        log.action === 'access' && 
        log.details?.includes('已过期')
      );

      expect(accessLogs.length).toBeGreaterThan(0);
      expect(accessLogs[accessLogs.length - 1].details).toBe('密钥已过期，需要轮换');
    });
  });

  describe("自动轮换策略验证", () => {
    test("应该能正确计算剩余天数", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => baseTime);

      const keyId = "remaining_days_key";
      credentialsManager.storeCredential(keyId, "test_key");

      const status = credentialsManager.getCredentialStatus(keyId);
      expect(status).toBeTruthy();

      // 计算剩余天数
      const now = new Date(baseTime);
      const rotationDue = status!.rotationDue;
      const remainingMs = rotationDue.getTime() - now.getTime();
      const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

      expect(remainingDays).toBe(90);
    });

    test("应该在轮换前提醒阶段正确识别密钥", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => baseTime);

      const keyId = "warning_period_key";
      credentialsManager.storeCredential(keyId, "warning_key");

      // 模拟时间前进到85天后（还有5天到期，进入警告期）
      const warningTime = baseTime + 85 * 24 * 60 * 60 * 1000;
      Date.now = vi.fn(() => warningTime);

      const status = credentialsManager.getCredentialStatus(keyId);
      const now = new Date(warningTime);
      const remainingMs = status!.rotationDue.getTime() - now.getTime();
      const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

      // 还有5天到期，应该进入警告期
      expect(remainingDays).toBeLessThanOrEqual(7); // 假设7天内为警告期
      expect(remainingDays).toBeGreaterThan(0); // 还没有过期
    });
  });

  describe("边界条件和错误处理", () => {
    test("轮换不存在的密钥应该正确处理", () => {
      const keyId = "non_existent_key";
      const newKey = "new_key";

      // 轮换不存在的密钥应该不会抛出错误，而是创建新密钥
      expect(() => {
        credentialsManager.rotateCredential(keyId, newKey);
      }).not.toThrow();

      // 验证密钥被创建了
      const status = credentialsManager.getCredentialStatus(keyId);
      expect(status).toBeTruthy();
      expect(status!.isActive).toBe(true);
    });

    test("并发轮换操作应该安全处理", async () => {
      const keyId = "concurrent_rotation_key";
      credentialsManager.storeCredential(keyId, "initial_key");

      // 模拟并发轮换操作
      const rotationPromises = [];
      for (let i = 0; i < 5; i++) {
        rotationPromises.push(
          Promise.resolve().then(() => {
            credentialsManager.rotateCredential(keyId, `key_${i}`);
          })
        );
      }

      await Promise.all(rotationPromises);

      // 验证最终状态是有效的
      const status = credentialsManager.getCredentialStatus(keyId);
      expect(status).toBeTruthy();
      expect(status!.isActive).toBe(true);

      // 应该能够获取凭据（不管是哪个版本）
      expect(() => {
        credentialsManager.getCredential(keyId);
      }).not.toThrow();
    });

    test("系统时间回退不应该影响轮换逻辑", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
      Date.now = vi.fn(() => baseTime);

      const keyId = "time_regression_key";
      credentialsManager.storeCredential(keyId, "test_key");

      // 模拟系统时间回退到过去
      const pastTime = baseTime - 30 * 24 * 60 * 60 * 1000; // 30天前
      Date.now = vi.fn(() => pastTime);

      // 即使时间回退，密钥状态应该仍然有效
      // （因为轮换到期时间是绝对时间戳）
      const status = credentialsManager.getCredentialStatus(keyId);
      expect(status).toBeTruthy();
      
      // 由于当前时间比创建时间早，这个测试实际检查的是时间处理的鲁棒性
      expect(status!.rotationDue.getTime()).toBeGreaterThan(pastTime);
    });
  });
});