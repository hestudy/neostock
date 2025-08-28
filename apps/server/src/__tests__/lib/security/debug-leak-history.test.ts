import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CredentialsManager } from '../../../lib/security/credentials-manager';

describe('Debug Leak Detection History', () => {
  let credentialsManager: CredentialsManager;
  let currentTime = new Date('2024-01-15T10:00:00Z');
  
  beforeEach(() => {
    currentTime = new Date('2024-01-15T10:00:00Z');
    process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    credentialsManager = CredentialsManager.getInstance();
    credentialsManager.clearAll();
    credentialsManager.setTimeProvider(() => new Date(currentTime));
  });

  afterEach(() => {
    credentialsManager.resetTimeProvider();
  });

  const advanceTime = (ms: number) => {
    currentTime = new Date(currentTime.getTime() + ms);
    credentialsManager.setTimeProvider(() => new Date(currentTime));
  };

  it('should record leak detection history debug', () => {
    const keyId = 'leak-history-debug';
    const testKey = 'test-key';
    
    credentialsManager.storeCredential(keyId, testKey);
    console.log('Time 1:', currentTime);
    
    // 第一次触发泄露检测
    for (let i = 0; i < 1001; i++) {
      credentialsManager.getCredential(keyId);
    }
    
    const result1 = credentialsManager.detectLeakage(keyId);
    console.log('First detection result:', result1);
    
    let logs1 = credentialsManager.getAuditLogs(keyId);
    console.log('After first detection, leak logs:', logs1.filter(l => l.action === 'leak_detected').length);
    
    // 时间推进，清除窗口
    advanceTime(25 * 60 * 60 * 1000);
    console.log('Time 2 (after 25h):', currentTime);
    
    // 第二次触发泄露检测
    for (let i = 0; i < 1001; i++) {
      credentialsManager.getCredential(keyId);
    }
    
    const result2 = credentialsManager.detectLeakage(keyId);
    console.log('Second detection result:', result2);
    
    // 验证两次泄露检测都被记录
    const auditLogs = credentialsManager.getAuditLogs(keyId);
    const leakLogs = auditLogs.filter(log => log.action === 'leak_detected');
    console.log('Final audit logs count:', auditLogs.length);
    console.log('Final leak logs count:', leakLogs.length);
    console.log('Leak logs:', leakLogs.map(l => ({ action: l.action, timestamp: l.timestamp })));
    
    expect(leakLogs).toHaveLength(2);
  });
});