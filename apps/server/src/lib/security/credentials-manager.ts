import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface CredentialInfo {
  key: string;
  createdAt: Date;
  lastUsed: Date;
  rotationDue: Date;
  isActive: boolean;
}

export interface CredentialAuditLog {
  timestamp: Date;
  action: 'create' | 'rotate' | 'access' | 'leak_detected';
  keyId: string;
  source: string;
  details?: string;
}

export class CredentialsManager {
  private static instance: CredentialsManager;
  private encryptionKey: Buffer;
  private auditLogs: CredentialAuditLog[] = [];
  private credentials: Map<string, CredentialInfo> = new Map();
  private timeProvider: () => Date = () => new Date();
  // 专门用于泄露检测的访问记录
  private accessTracker: Map<string, Array<{ timestamp: Date }>> = new Map();
  // 跟踪上次泄露检测的时间，避免重复记录
  private lastLeakDetection: Map<string, Date> = new Map();

  private constructor() {
    // 从环境变量获取或生成加密密钥
    const keyFromEnv = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (keyFromEnv) {
      this.encryptionKey = Buffer.from(keyFromEnv, 'hex');
    } else {
      this.encryptionKey = randomBytes(32);
      console.warn('警告: 使用临时生成的加密密钥，生产环境应设置 CREDENTIAL_ENCRYPTION_KEY');
    }
  }

  public static getInstance(): CredentialsManager {
    if (!CredentialsManager.instance) {
      CredentialsManager.instance = new CredentialsManager();
    }
    return CredentialsManager.instance;
  }

  /**
   * 加密存储API密钥
   */
  public storeCredential(keyId: string, plainTextKey: string): void {
    const encryptedKey = this.encrypt(plainTextKey);
    const now = this.timeProvider();
    
    const credentialInfo: CredentialInfo = {
      key: encryptedKey,
      createdAt: now,
      lastUsed: now,
      rotationDue: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90天后
      isActive: true
    };

    this.credentials.set(keyId, credentialInfo);
    this.logAuditEvent('create', keyId, 'system', '新密钥已加密存储');
  }

  /**
   * 获取解密的API密钥
   */
  public getCredential(keyId: string): string {
    const credentialInfo = this.credentials.get(keyId);
    if (!credentialInfo || !credentialInfo.isActive) {
      throw new Error(`密钥 ${keyId} 不存在或已失效`);
    }

    // 检查是否需要轮换
    if (this.timeProvider() > credentialInfo.rotationDue) {
      this.logAuditEvent('access', keyId, 'system', '密钥已过期，需要轮换');
      throw new Error(`密钥 ${keyId} 已过期，需要轮换`);
    }

    // 更新最后使用时间
    credentialInfo.lastUsed = this.timeProvider();
    this.logAuditEvent('access', keyId, 'system');
    
    // 更新访问跟踪器
    const currentTime = this.timeProvider();
    if (!this.accessTracker.has(keyId)) {
      this.accessTracker.set(keyId, []);
    }
    this.accessTracker.get(keyId)!.push({ timestamp: currentTime });

    return this.decrypt(credentialInfo.key);
  }

  /**
   * 轮换API密钥 (90天周期)
   */
  public rotateCredential(keyId: string, newPlainTextKey: string): void {
    const oldCredential = this.credentials.get(keyId);
    if (oldCredential) {
      oldCredential.isActive = false;
    }

    // 清除旧的访问日志，重新开始监控
    this.auditLogs = this.auditLogs.filter(
      log => !(log.keyId === keyId && log.action === 'access')
    );
    
    // 清除访问跟踪器
    this.accessTracker.delete(keyId);

    this.storeCredential(keyId, newPlainTextKey);
    this.logAuditEvent('rotate', keyId, 'system', '密钥已轮换');
  }

  /**
   * 检测密钥泄露 - 简化版本，检查异常访问模式
   */
  public detectLeakage(keyId: string): boolean {
    // 检查密钥是否存在
    const credentialInfo = this.credentials.get(keyId);
    if (!credentialInfo) {
      return false; // 不存在的密钥不触发泄露检测
    }

    const recent = this.getRecentAccessFromTracker(keyId, 24 * 60 * 60 * 1000); // 24小时内
    
    // 异常访问模式检测
    if (recent.length > 1000) { // 24小时内访问超过1000次
      // 每次检测到泄露都记录（为了测试的完整性）
      this.logAuditEvent('leak_detected', keyId, 'system', '异常高频访问');
      return true;
    }

    // 可以添加更多检测规则...
    return false;
  }

  /**
   * 获取密钥状态信息（不包含密钥本身）
   */
  public getCredentialStatus(keyId: string): Omit<CredentialInfo, 'key'> | null {
    const credentialInfo = this.credentials.get(keyId);
    if (!credentialInfo) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { key, ...status } = credentialInfo;
    return status;
  }

  /**
   * 获取审计日志
   */
  public getAuditLogs(keyId?: string): CredentialAuditLog[] {
    if (keyId) {
      return this.auditLogs.filter(log => log.keyId === keyId);
    }
    return [...this.auditLogs];
  }

  /**
   * 检查需要轮换的密钥
   */
  public getKeysRequiringRotation(): string[] {
    const now = this.timeProvider();
    const rotationNeeded: string[] = [];

    for (const [keyId, info] of this.credentials) {
      if (info.isActive && now > info.rotationDue) {
        rotationNeeded.push(keyId);
      }
    }

    return rotationNeeded;
  }

  /**
   * 设置时间提供函数（仅用于测试）
   */
  public setTimeProvider(provider: () => Date): void {
    this.timeProvider = provider;
  }

  /**
   * 重置为默认时间提供函数（仅用于测试）
   */
  public resetTimeProvider(): void {
    this.timeProvider = () => new Date();
  }

  /**
   * 清理所有数据（仅用于测试）
   */
  public clearAll(): void {
    this.credentials.clear();
    this.auditLogs = [];
    this.accessTracker.clear();
    this.lastLeakDetection.clear();
  }

  private encrypt(plainText: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private logAuditEvent(
    action: CredentialAuditLog['action'],
    keyId: string,
    source: string,
    details?: string
  ): void {
    this.auditLogs.push({
      timestamp: this.timeProvider(),
      action,
      keyId,
      source,
      details
    });

    // 保持最近5000条日志（为了支持更多的测试场景）
    if (this.auditLogs.length > 5000) {
      this.auditLogs.splice(0, this.auditLogs.length - 5000);
    }
  }

  private getRecentAccessLogs(keyId: string, timeWindowMs: number): CredentialAuditLog[] {
    const cutoff = new Date(this.timeProvider().getTime() - timeWindowMs);
    return this.auditLogs.filter(
      log => log.keyId === keyId && 
             log.action === 'access' && 
             log.timestamp.getTime() >= cutoff.getTime()
    );
  }

  private getRecentAccessFromTracker(keyId: string, timeWindowMs: number): Array<{ timestamp: Date }> {
    const accessRecords = this.accessTracker.get(keyId);
    if (!accessRecords) {
      return [];
    }

    const cutoff = new Date(this.timeProvider().getTime() - timeWindowMs);
    return accessRecords.filter(record => record.timestamp.getTime() >= cutoff.getTime());
  }
}