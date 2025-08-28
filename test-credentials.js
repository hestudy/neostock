// 设置环境变量
process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const { CredentialsManager } = require('./apps/server/dist/src/lib/security/credentials-manager.js');

console.log('Starting test...');

const cm = CredentialsManager.getInstance();
cm.clearAll();

// Test basic functionality
const keyId = 'test-key';
cm.storeCredential(keyId, 'secret');
console.log('Stored credential');

// Make some accesses
for (let i = 0; i < 5; i++) {
  cm.getCredential(keyId);
}
console.log('Made 5 accesses');

// Check audit logs
const logs = cm.getAuditLogs(keyId);
console.log('Audit logs actions:', logs.map(l => l.action));
console.log('Total logs:', logs.length);

// Test leak detection with 5 accesses
const isLeaked1 = cm.detectLeakage(keyId);
console.log('Leaked (after 5):', isLeaked1);

// Test with more accesses (1000+)
for (let i = 0; i < 1000; i++) {
  cm.getCredential(keyId);
}
console.log('Made 1000 more accesses');

const logs2 = cm.getAuditLogs(keyId);
console.log('Total access logs:', logs2.filter(l => l.action === 'access').length);

// Test leak detection with 1000+ accesses
const isLeaked2 = cm.detectLeakage(keyId);
console.log('Leaked (after 1000+):', isLeaked2);