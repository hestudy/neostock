import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { CredentialsManager } from "../../../lib/security/credentials-manager";

describe("凭据管理器 - 90天轮换机制测试 (Fixed)", () => {
  let credentialsManager: CredentialsManager;
  let currentTime: Date;

  beforeEach(() => {
    credentialsManager = CredentialsManager.getInstance();
    credentialsManager.clearAll();
    
    process.env.CREDENTIAL_ENCRYPTION_KEY = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    
    currentTime = new Date("2024-01-01T00:00:00Z");
    credentialsManager.setTimeProvider(() => new Date(currentTime));
  });

  afterEach(() => {
    credentialsManager.resetTimeProvider();
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
  });

  const setTime = (time: number | Date) => {
    currentTime = new Date(time);
    credentialsManager.setTimeProvider(() => new Date(currentTime));
  };

  describe("90天轮换周期验证", () => {
    test("新创建的凭据应该设置正确的轮换到期时间", () => {
      const fixedTime = new Date("2024-01-01T00:00:00Z");
      setTime(fixedTime);

      const keyId = "test_rotation_key";
      const plainTextKey = "test_api_key_12345";

      credentialsManager.storeCredential(keyId, plainTextKey);
      const status = credentialsManager.getCredentialStatus(keyId);
      
      expect(status).toBeTruthy();
      
      const expectedRotationDate = new Date(fixedTime.getTime() + 90 * 24 * 60 * 60 * 1000);
      expect(status!.rotationDue).toEqual(expectedRotationDate);
      expect(status!.isActive).toBe(true);
    });

    test("未过期的凭据应该正常工作", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z");
      setTime(baseTime);

      const keyId = "not_expired_key";
      const plainTextKey = "valid_api_key";
      credentialsManager.storeCredential(keyId, plainTextKey);

      // 88天后 (还有2天到期)
      setTime(new Date(baseTime.getTime() + 88 * 24 * 60 * 60 * 1000));

      const retrievedKey = credentialsManager.getCredential(keyId);
      expect(retrievedKey).toBe(plainTextKey);

      const keysRequiringRotation = credentialsManager.getKeysRequiringRotation();
      expect(keysRequiringRotation).not.toContain(keyId);
    });

    test("已过期的凭据应该被识别为需要轮换", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z");
      setTime(baseTime);

      const keyId = "expired_key";
      const plainTextKey = "expired_api_key";
      credentialsManager.storeCredential(keyId, plainTextKey);

      // 91天后 (过期1天)
      setTime(new Date(baseTime.getTime() + 91 * 24 * 60 * 60 * 1000));

      const keysRequiringRotation = credentialsManager.getKeysRequiringRotation();
      expect(keysRequiringRotation).toContain(keyId);

      expect(() => {
        credentialsManager.getCredential(keyId);
      }).toThrow("已过期，需要轮换");
    });

    test("正好90天到期的凭据应该被识别为需要轮换", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z");
      setTime(baseTime);

      const keyId = "exactly_expired_key";
      credentialsManager.storeCredential(keyId, "exactly_expired_api_key");

      // 正好90天后+1毫秒
      setTime(new Date(baseTime.getTime() + 90 * 24 * 60 * 60 * 1000 + 1));

      const keysRequiringRotation = credentialsManager.getKeysRequiringRotation();
      expect(keysRequiringRotation).toContain(keyId);
    });
  });

  describe("凭据轮换操作", () => {
    test("手动轮换凭据应该正确更新轮换到期时间", () => {
      const initialTime = new Date("2024-01-01T00:00:00Z");
      setTime(initialTime);

      const keyId = "rotation_test_key";
      const oldKey = "old_api_key";
      const newKey = "new_api_key";

      credentialsManager.storeCredential(keyId, oldKey);

      // 30天后轮换
      const rotationTime = new Date(initialTime.getTime() + 30 * 24 * 60 * 60 * 1000);
      setTime(rotationTime);

      credentialsManager.rotateCredential(keyId, newKey);
      const status = credentialsManager.getCredentialStatus(keyId);

      expect(status).toBeTruthy();
      
      const expectedNewRotationDate = new Date(rotationTime.getTime() + 90 * 24 * 60 * 60 * 1000);
      expect(status!.rotationDue).toEqual(expectedNewRotationDate);
      expect(status!.isActive).toBe(true);

      const retrievedKey = credentialsManager.getCredential(keyId);
      expect(retrievedKey).toBe(newKey);
    });

    test("轮换应该记录正确的审计日志", () => {
      const keyId = "audit_test_key";
      const oldKey = "old_key";
      const newKey = "new_key";

      credentialsManager.storeCredential(keyId, oldKey);
      credentialsManager.rotateCredential(keyId, newKey);

      const auditLogs = credentialsManager.getAuditLogs(keyId);
      
      const createLogs = auditLogs.filter(log => log.action === 'create');
      const rotateLogs = auditLogs.filter(log => log.action === 'rotate');

      expect(createLogs).toHaveLength(2); // 初始创建 + 轮换时的创建
      expect(rotateLogs).toHaveLength(1); // 轮换操作

      const rotateLog = rotateLogs[0];
      expect(rotateLog.keyId).toBe(keyId);
      expect(rotateLog.source).toBe('system');
      expect(rotateLog.details).toBe('密钥已轮换');
    });
  });

  describe("多密钥管理", () => {
    test("应该能识别多个需要轮换的密钥", () => {
      const baseTime = new Date("2024-01-01T00:00:00Z");
      setTime(baseTime);

      const keyIds = ["key1", "key2", "key3"];
      
      // 创建3个密钥，不同的创建时间
      keyIds.forEach((keyId, index) => {
        const createTime = new Date(baseTime.getTime() + index * 10 * 24 * 60 * 60 * 1000); // 每隔10天
        setTime(createTime);
        credentialsManager.storeCredential(keyId, `api_key_${index}`);
      });

      // 95天后
      setTime(new Date(baseTime.getTime() + 95 * 24 * 60 * 60 * 1000));

      const keysRequiringRotation = credentialsManager.getKeysRequiringRotation();
      
      expect(keysRequiringRotation).toContain("key1"); // 95天前创建，需要轮换
      expect(keysRequiringRotation).not.toContain("key2"); // 85天前创建，还不需要
      expect(keysRequiringRotation).not.toContain("key3"); // 75天前创建，还不需要
    });
  });

  describe("边界条件", () => {
    test("轮换不存在的密钥应该创建新密钥", () => {
      const keyId = "non_existent_key";
      const newKey = "new_key";

      expect(() => {
        credentialsManager.rotateCredential(keyId, newKey);
      }).not.toThrow();

      const status = credentialsManager.getCredentialStatus(keyId);
      expect(status).toBeTruthy();
      expect(status!.isActive).toBe(true);
    });

    test("精确到毫秒的到期时间验证", () => {
      const exactTime = new Date("2024-01-01T12:30:45.123Z");
      setTime(exactTime);

      const keyId = "precise_timing_key";
      credentialsManager.storeCredential(keyId, "precise_api_key");

      // 前1毫秒
      setTime(new Date(exactTime.getTime() + 90 * 24 * 60 * 60 * 1000 - 1));
      expect(credentialsManager.getKeysRequiringRotation()).not.toContain(keyId);

      // 后1毫秒
      setTime(new Date(exactTime.getTime() + 90 * 24 * 60 * 60 * 1000 + 1));
      expect(credentialsManager.getKeysRequiringRotation()).toContain(keyId);
    });
  });
});