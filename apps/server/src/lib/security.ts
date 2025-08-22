import crypto from 'crypto';

export interface CredentialConfig {
  key: string;
  algorithm: string;
  rotationInterval: number; // in days
  environment: 'development' | 'testing' | 'production';
}

export interface AuditEntry {
  timestamp: string;
  action: 'access' | 'rotation' | 'creation' | 'deletion';
  key: string;
  environment: string;
  success: boolean;
  error?: string;
}

export class SecureCredentialManager {
  private credentials = new Map<string, string>();
  private auditLog: AuditEntry[] = [];
  private rotationSchedule = new Map<string, Date>();
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';

  constructor(masterKey?: string) {
    // In production, this would come from a secure key management service
    this.encryptionKey = Buffer.from(
      masterKey || process.env.ENCRYPTION_MASTER_KEY || 'fallback-key-for-testing-only-32b',
      'utf8'
    ).subarray(0, 32);
  }

  // Encrypt credentials for storage
  private encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    try {
      const iv = crypto.randomBytes(16);
      // Use AES-256-CBC for compatibility
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: '' // For compatibility
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Decrypt credentials for use
  private decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Store encrypted credentials
  async storeCredential(
    key: string, 
    value: string, 
    environment: 'development' | 'testing' | 'production',
    rotationDays: number = 90
  ): Promise<boolean> {
    try {
      const encrypted = this.encrypt(value);
      const storedValue = JSON.stringify(encrypted);
      
      this.credentials.set(`${environment}:${key}`, storedValue);
      
      // Set rotation schedule
      const rotationDate = new Date();
      rotationDate.setDate(rotationDate.getDate() + rotationDays);
      this.rotationSchedule.set(`${environment}:${key}`, rotationDate);
      
      // Log action
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'creation',
        key,
        environment,
        success: true
      });

      return true;
    } catch (error) {
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'creation',
        key,
        environment,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // Retrieve and decrypt credentials
  async getCredential(
    key: string, 
    environment: 'development' | 'testing' | 'production'
  ): Promise<string | null> {
    try {
      const storedValue = this.credentials.get(`${environment}:${key}`);
      if (!storedValue) {
        this.auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'access',
          key,
          environment,
          success: false,
          error: 'Credential not found'
        });
        return null;
      }

      const encrypted = JSON.parse(storedValue);
      const decrypted = this.decrypt(encrypted);
      
      // Log successful access
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'access',
        key,
        environment,
        success: true
      });

      return decrypted;
    } catch (error) {
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'access',
        key,
        environment,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  // Rotate credentials
  async rotateCredential(
    key: string,
    environment: 'development' | 'testing' | 'production',
    newValue: string
  ): Promise<boolean> {
    try {
      const oldExists = this.credentials.has(`${environment}:${key}`);
      if (!oldExists) {
        throw new Error('Cannot rotate non-existent credential');
      }

      // Store new encrypted value
      const encrypted = this.encrypt(newValue);
      const storedValue = JSON.stringify(encrypted);
      this.credentials.set(`${environment}:${key}`, storedValue);

      // Update rotation schedule
      const rotationDate = new Date();
      rotationDate.setDate(rotationDate.getDate() + 90);
      this.rotationSchedule.set(`${environment}:${key}`, rotationDate);

      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'rotation',
        key,
        environment,
        success: true
      });

      return true;
    } catch (error) {
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'rotation',
        key,
        environment,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // Check which credentials need rotation
  getCredentialsNeedingRotation(): Array<{
    key: string;
    environment: string;
    rotationDate: Date;
    daysOverdue: number;
  }> {
    const now = new Date();
    const needingRotation: Array<{
      key: string;
      environment: string;
      rotationDate: Date;
      daysOverdue: number;
    }> = [];

    for (const [fullKey, rotationDate] of this.rotationSchedule.entries()) {
      if (now > rotationDate) {
        const [environment, key] = fullKey.split(':');
        const daysOverdue = Math.floor((now.getTime() - rotationDate.getTime()) / (1000 * 60 * 60 * 24));
        
        needingRotation.push({
          key,
          environment: environment as 'development' | 'testing' | 'production',
          rotationDate,
          daysOverdue
        });
      }
    }

    return needingRotation;
  }

  // Environment isolation check
  verifyEnvironmentIsolation(): { isolated: boolean; violations: string[] } {
    const violations: string[] = [];
    const environments = ['development', 'testing', 'production'];

    // Check that credentials are properly namespaced by environment
    const keysByEnv = new Map<string, Set<string>>();
    
    for (const fullKey of this.credentials.keys()) {
      const [env, key] = fullKey.split(':');
      if (!keysByEnv.has(env)) {
        keysByEnv.set(env, new Set());
      }
      keysByEnv.get(env)!.add(key);
    }

    // Check for proper isolation
    for (const env of environments) {
      const envCredentials = keysByEnv.get(env) || new Set();
      
      // In production, certain keys should not exist in other environments
      if (env === 'production') {
        for (const key of envCredentials) {
          if (key.includes('prod') || key.includes('live')) {
            // Check if this production key exists in other environments
            for (const otherEnv of environments) {
              if (otherEnv !== 'production' && keysByEnv.get(otherEnv)?.has(key)) {
                violations.push(`Production credential '${key}' found in ${otherEnv} environment`);
              }
            }
          }
        }
      }
    }

    return {
      isolated: violations.length === 0,
      violations
    };
  }

  // Audit log access
  getAuditLog(
    environment?: string,
    action?: string,
    startDate?: Date,
    endDate?: Date
  ): AuditEntry[] {
    return this.auditLog.filter(entry => {
      if (environment && entry.environment !== environment) return false;
      if (action && entry.action !== action) return false;
      if (startDate && new Date(entry.timestamp) < startDate) return false;
      if (endDate && new Date(entry.timestamp) > endDate) return false;
      return true;
    });
  }

  // Security health check
  performSecurityHealthCheck(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for credentials needing rotation
    const needingRotation = this.getCredentialsNeedingRotation();
    if (needingRotation.length > 0) {
      issues.push(`${needingRotation.length} credentials need rotation`);
      recommendations.push('Rotate overdue credentials immediately');
    }

    // Check environment isolation
    const isolation = this.verifyEnvironmentIsolation();
    if (!isolation.isolated) {
      issues.push('Environment isolation violations detected');
      issues.push(...isolation.violations);
      recommendations.push('Review and fix environment isolation');
    }

    // Check for recent access failures
    const recentFailures = this.auditLog.filter(entry => {
      const entryTime = new Date(entry.timestamp);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return !entry.success && entryTime > oneHourAgo;
    });

    if (recentFailures.length > 5) {
      issues.push(`${recentFailures.length} credential access failures in the last hour`);
      recommendations.push('Investigate repeated access failures');
    }

    // Check encryption strength
    if (this.encryptionKey.length < 32) {
      issues.push('Weak encryption key detected');
      recommendations.push('Use a 256-bit encryption key');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    };
  }

  // Detect potential security breaches
  detectSuspiciousActivity(): {
    suspicious: boolean;
    alerts: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      timestamp: string;
    }>;
  } {
    const alerts: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      timestamp: string;
    }> = [];

    // Check for unusual access patterns
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentAccesses = this.auditLog.filter(entry => 
      entry.action === 'access' && new Date(entry.timestamp) > oneHourAgo
    );

    // High frequency access
    if (recentAccesses.length > 100) {
      alerts.push({
        type: 'high_frequency_access',
        description: `${recentAccesses.length} credential accesses in the last hour`,
        severity: 'medium',
        timestamp: now.toISOString()
      });
    }

    // Multiple failed accesses for same key
    const failedAccessesByKey = new Map<string, number>();
    this.auditLog.filter(entry => 
      !entry.success && 
      entry.action === 'access' && 
      new Date(entry.timestamp) > oneHourAgo
    ).forEach(entry => {
      const count = failedAccessesByKey.get(entry.key) || 0;
      failedAccessesByKey.set(entry.key, count + 1);
    });

    for (const [key, count] of failedAccessesByKey.entries()) {
      if (count >= 5) {
        alerts.push({
          type: 'brute_force_attempt',
          description: `${count} failed access attempts for key '${key}'`,
          severity: 'high',
          timestamp: now.toISOString()
        });
      }
    }

    // Cross-environment access
    const crossEnvAccess = new Map<string, Set<string>>();
    recentAccesses.forEach(entry => {
      if (!crossEnvAccess.has(entry.key)) {
        crossEnvAccess.set(entry.key, new Set());
      }
      crossEnvAccess.get(entry.key)!.add(entry.environment);
    });

    for (const [key, environments] of crossEnvAccess.entries()) {
      if (environments.size > 1) {
        alerts.push({
          type: 'cross_environment_access',
          description: `Key '${key}' accessed across ${environments.size} environments`,
          severity: 'low',
          timestamp: now.toISOString()
        });
      }
    }

    return {
      suspicious: alerts.length > 0,
      alerts
    };
  }

  // Clear audit log (for testing)
  clearAuditLog() {
    this.auditLog = [];
  }

  // Get statistics for monitoring
  getStatistics() {
    return {
      totalCredentials: this.credentials.size,
      auditLogEntries: this.auditLog.length,
      credentialsNeedingRotation: this.getCredentialsNeedingRotation().length,
      environmentIsolation: this.verifyEnvironmentIsolation(),
      securityHealth: this.performSecurityHealthCheck()
    };
  }
}