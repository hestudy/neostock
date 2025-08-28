export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  clientId?: string;
  action: string;
  resource: string;
  method: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditLogFilter {
  userId?: string;
  action?: string;
  resource?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private logs: AuditLogEntry[] = [];
  private maxLogSize = 10000; // 最多保存10000条日志
  private timeProvider: () => Date = () => new Date();

  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * 记录API访问日志
   */
  public logApiAccess(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: this.timeProvider(),
      ...entry,
    };

    this.addLog(logEntry);
  }

  /**
   * 记录数据源管理操作
   */
  public logDataSourceOperation(
    action: string,
    resource: string,
    userId: string,
    success: boolean,
    error?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logApiAccess({
      userId,
      action,
      resource,
      method: 'OPERATION',
      success,
      error,
      metadata,
    });
  }

  /**
   * 记录凭据管理操作
   */
  public logCredentialOperation(
    action: string,
    keyId: string,
    userId: string,
    success: boolean,
    error?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logApiAccess({
      userId,
      action,
      resource: `credential:${keyId}`,
      method: 'CREDENTIAL',
      success,
      error,
      metadata: {
        ...metadata,
        keyId,
      },
    });
  }

  /**
   * 记录认证相关操作
   */
  public logAuthOperation(
    action: string,
    success: boolean,
    userId?: string,
    error?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logApiAccess({
      userId,
      action,
      resource: 'authentication',
      method: 'AUTH',
      success,
      error,
      metadata,
    });
  }

  /**
   * 记录敏感数据访问
   */
  public logSensitiveDataAccess(
    resource: string,
    userId: string,
    action: string,
    success: boolean,
    error?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logApiAccess({
      userId,
      action,
      resource,
      method: 'SENSITIVE_DATA',
      success,
      error,
      metadata: {
        ...metadata,
        sensitiveData: true,
      },
    });
  }

  /**
   * 查询审计日志
   */
  public queryLogs(filter: AuditLogFilter = {}): AuditLogEntry[] {
    let filteredLogs = [...this.logs];

    // 按用户过滤
    if (filter.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filter.userId);
    }

    // 按操作过滤
    if (filter.action) {
      filteredLogs = filteredLogs.filter(log => log.action === filter.action);
    }

    // 按资源过滤
    if (filter.resource) {
      filteredLogs = filteredLogs.filter(log => log.resource === filter.resource);
    }

    // 按成功状态过滤
    if (filter.success !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.success === filter.success);
    }

    // 按日期范围过滤
    if (filter.startDate && filter.endDate) {
      // 当同时有开始和结束时间时，确保范围有效
      const startTime = filter.startDate.getTime();
      const endTime = filter.endDate.getTime();
      
      if (startTime <= endTime) {
        filteredLogs = filteredLogs.filter(log => {
          const logTime = log.timestamp.getTime();
          return logTime >= startTime && logTime <= endTime;
        });
      } else {
        // 如果开始时间晚于结束时间，返回空数组
        return [];
      }
    } else {
      // 单独处理开始时间或结束时间
      if (filter.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp.getTime() >= filter.startDate!.getTime());
      }
      if (filter.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp.getTime() <= filter.endDate!.getTime());
      }
    }

    // 按时间倒序排序
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 限制返回条数
    if (filter.limit) {
      filteredLogs = filteredLogs.slice(0, filter.limit);
    }

    return filteredLogs;
  }

  /**
   * 获取用户操作统计
   */
  public getUserOperationStats(userId: string, hours: number = 24): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    operationsByAction: Record<string, number>;
    operationsByResource: Record<string, number>;
    lastOperation?: Date;
  } {
    const cutoffTime = new Date(this.timeProvider().getTime() - hours * 60 * 60 * 1000);
    const userLogs = this.logs.filter(
      log => log.userId === userId && log.timestamp >= cutoffTime
    );

    const stats = {
      totalOperations: userLogs.length,
      successfulOperations: userLogs.filter(log => log.success).length,
      failedOperations: userLogs.filter(log => !log.success).length,
      operationsByAction: {} as Record<string, number>,
      operationsByResource: {} as Record<string, number>,
      lastOperation: userLogs.length > 0 ? new Date(Math.max(...userLogs.map(log => log.timestamp.getTime()))) : undefined,
    };

    // 统计按操作类型
    userLogs.forEach(log => {
      stats.operationsByAction[log.action] = (stats.operationsByAction[log.action] || 0) + 1;
      stats.operationsByResource[log.resource] = (stats.operationsByResource[log.resource] || 0) + 1;
    });

    return stats;
  }

  /**
   * 检测异常访问模式
   */
  public detectAnomalousActivity(): {
    suspiciousUsers: Array<{
      userId: string;
      reason: string;
      failureRate: number;
      operationCount: number;
    }>;
    frequentErrors: Array<{
      error: string;
      count: number;
      affectedUsers: number;
    }>;
  } {
    const recentLogs = this.logs.filter(
      log => log.timestamp >= new Date(this.timeProvider().getTime() - 60 * 60 * 1000) // 最近1小时
    );

    const suspiciousUsers: Array<{
      userId: string;
      reason: string;
      failureRate: number;
      operationCount: number;
    }> = [];

    const frequentErrors: Array<{
      error: string;
      count: number;
      affectedUsers: number;
    }> = [];

    // 按用户分组统计
    const userStats = new Map<string, { total: number; failures: number; errors: string[] }>();
    
    recentLogs.forEach(log => {
      if (!log.userId) return;
      
      const stats = userStats.get(log.userId) || { total: 0, failures: 0, errors: [] };
      stats.total++;
      
      if (!log.success) {
        stats.failures++;
        if (log.error) {
          stats.errors.push(log.error);
        }
      }
      
      userStats.set(log.userId, stats);
    });

    // 识别可疑用户
    userStats.forEach((stats, userId) => {
      const failureRate = stats.failures / stats.total;
      
      // 高失败率用户
      if (failureRate > 0.5 && stats.total > 10) {
        suspiciousUsers.push({
          userId,
          reason: '高失败率访问',
          failureRate,
          operationCount: stats.total,
        });
      }
      
      // 过于频繁的用户
      if (stats.total > 200) {
        suspiciousUsers.push({
          userId,
          reason: '异常高频访问',
          failureRate,
          operationCount: stats.total,
        });
      }
    });

    // 统计频繁错误
    const errorCount = new Map<string, Set<string>>();
    
    recentLogs.forEach(log => {
      if (log.error && log.userId) {
        if (!errorCount.has(log.error)) {
          errorCount.set(log.error, new Set());
        }
        errorCount.get(log.error)!.add(log.userId);
      }
    });

    errorCount.forEach((users, error) => {
      if (users.size >= 3) { // 影响3个或更多用户
        frequentErrors.push({
          error,
          count: recentLogs.filter(log => log.error === error).length,
          affectedUsers: users.size,
        });
      }
    });

    return { suspiciousUsers, frequentErrors };
  }

  /**
   * 清理旧日志
   */
  public cleanupOldLogs(maxAge: number = 30 * 24 * 60 * 60 * 1000): number {
    const cutoffTime = new Date(this.timeProvider().getTime() - maxAge);
    const initialCount = this.logs.length;
    
    this.logs = this.logs.filter(log => log.timestamp >= cutoffTime);
    
    return initialCount - this.logs.length;
  }

  /**
   * 获取审计日志总量统计
   */
  public getLogStats(): {
    totalLogs: number;
    logsToday: number;
    successRate: number;
    topActions: Array<{ action: string; count: number }>;
    topResources: Array<{ resource: string; count: number }>;
  } {
    const today = new Date(this.timeProvider().getTime());
    today.setHours(0, 0, 0, 0);
    
    const logsToday = this.logs.filter(log => log.timestamp >= today);
    const successfulLogs = this.logs.filter(log => log.success);
    
    // 统计操作类型
    const actionCount = new Map<string, number>();
    const resourceCount = new Map<string, number>();
    
    this.logs.forEach(log => {
      actionCount.set(log.action, (actionCount.get(log.action) || 0) + 1);
      resourceCount.set(log.resource, (resourceCount.get(log.resource) || 0) + 1);
    });

    // 排序并取前5
    const topActions = Array.from(actionCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));

    const topResources = Array.from(resourceCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([resource, count]) => ({ resource, count }));

    return {
      totalLogs: this.logs.length,
      logsToday: logsToday.length,
      successRate: this.logs.length > 0 ? successfulLogs.length / this.logs.length : 1,
      topActions,
      topResources,
    };
  }

  /**
   * 导出审计日志
   */
  public exportLogs(filter: AuditLogFilter = {}): string {
    const logs = this.queryLogs(filter);
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'Client ID',
      'Action',
      'Resource',
      'Method',
      'Success',
      'Error',
      'IP Address',
      'Session ID'
    ];

    const csvLines = [headers.join(',')];
    
    logs.forEach(log => {
      const row = [
        log.id,
        log.timestamp.toISOString(),
        log.userId || '',
        log.clientId || '',
        log.action,
        log.resource,
        log.method,
        log.success.toString(),
        log.error || '',
        log.ipAddress || '',
        log.sessionId || ''
      ];
      csvLines.push(row.map(field => `"${field}"`).join(','));
    });

    return csvLines.join('\n');
  }

  /**
   * 清除所有日志（仅用于测试）
   */
  public clearLogs(): void {
    this.logs = [];
  }

  /**
   * 获取日志总数（用于测试）
   */
  public getLogCount(): number {
    return this.logs.length;
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

  private addLog(entry: AuditLogEntry): void {
    this.logs.push(entry);
    
    // 保持日志数量在限制内
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出单例实例
export const auditLogger = AuditLogger.getInstance();