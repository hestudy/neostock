import { describe, it, expect, beforeEach } from 'vitest';
import { CredentialsManager } from '../../../lib/security/credentials-manager';

describe('Debug Credentials Manager', () => {
  let credentialsManager: CredentialsManager;
  
  beforeEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    credentialsManager = CredentialsManager.getInstance();
    credentialsManager.clearAll();
  });

  it('should log access records correctly', () => {
    const keyId = 'debug-test';
    credentialsManager.storeCredential(keyId, 'secret');

    // Make several accesses
    for (let i = 0; i < 5; i++) {
      credentialsManager.getCredential(keyId);
    }

    const logs = credentialsManager.getAuditLogs(keyId);
    console.log('All logs:', logs);
    console.log('Access logs count:', logs.filter(l => l.action === 'access').length);
    
    // Should have 1 create + 5 access logs
    expect(logs.filter(l => l.action === 'create')).toHaveLength(1);
    expect(logs.filter(l => l.action === 'access')).toHaveLength(5);
  });

  it('should detect leakage with 1000+ accesses', () => {
    const keyId = 'leak-test';
    credentialsManager.storeCredential(keyId, 'secret');

    // Make 1001 accesses
    for (let i = 0; i < 1001; i++) {
      credentialsManager.getCredential(keyId);
    }

    const logs = credentialsManager.getAuditLogs(keyId);
    console.log('Total logs after 1001 accesses:', logs.length);
    console.log('Access logs after 1001 accesses:', logs.filter(l => l.action === 'access').length);

    const isLeaked = credentialsManager.detectLeakage(keyId);
    console.log('Leaked:', isLeaked);
    
    expect(isLeaked).toBe(true);
  });
});