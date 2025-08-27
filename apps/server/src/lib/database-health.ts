import { sql } from 'drizzle-orm';
import { db, getConnectionPoolStatus, validateOptimization } from '../db/index';

export interface DatabaseHealthResult {
  status: 'pass' | 'warn' | 'fail';
  responseTime: number;
  message: string;
  details: {
    connectivity: {
      status: 'pass' | 'fail';
      responseTime: number;
    };
    pragmaConfig: {
      status: 'pass' | 'warn' | 'fail';
      settings: Record<string, string | number>;
      issues: string[];
    };
    connectionPool: {
      status: 'pass' | 'warn' | 'fail';
      active: number;
      max: number;
      utilization: number;
    };
    performance: {
      status: 'pass' | 'warn' | 'fail';
      averageQueryTime: number;
      slowQueries: number;
    };
    diskSpace: {
      status: 'pass' | 'warn' | 'fail';
      info: string;
    };
  };
}

export class DatabaseHealthChecker {
  private readonly thresholds = {
    connectivityTimeout: 5000, // 5秒连接超时
    queryPerformance: {
      good: 50,     // <50ms为良好
      acceptable: 200, // <200ms为可接受
      critical: 1000,  // >1000ms为严重
    },
    connectionPool: {
      utilization: {
        warning: 0.8,  // 80%使用率警告
        critical: 0.95, // 95%使用率严重
      },
    },
  };

  async performHealthCheck(): Promise<DatabaseHealthResult> {
    const startTime = performance.now();
    
    try {
      const [
        connectivity,
        pragmaConfig,
        connectionPool,
        performanceCheck,
        diskSpace
      ] = await Promise.all([
        this.checkConnectivity(),
        this.checkPragmaConfiguration(),
        this.checkConnectionPool(),
        this.checkPerformance(),
        this.checkDiskSpace(),
      ]);

      const totalResponseTime = performance.now() - startTime;
      
      // 确定整体状态
      const overallStatus = this.determineOverallStatus([
        connectivity.status,
        pragmaConfig.status,
        connectionPool.status,
        performanceCheck.status,
        diskSpace.status,
      ]);

      // 生成状态消息
      const message = this.generateStatusMessage(overallStatus, {
        connectivity,
        pragmaConfig,
        connectionPool,
        performance: performanceCheck,
        diskSpace,
      });

      return {
        status: overallStatus,
        responseTime: totalResponseTime,
        message,
        details: {
          connectivity,
          pragmaConfig,
          connectionPool,
          performance: performanceCheck,
          diskSpace,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const totalResponseTime = performance.now() - startTime;
      
      return {
        status: 'fail',
        responseTime: totalResponseTime,
        message: `数据库健康检查失败: ${errorMessage}`,
        details: {
          connectivity: { status: 'fail', responseTime: totalResponseTime },
          pragmaConfig: { status: 'fail', settings: {}, issues: [errorMessage] },
          connectionPool: { status: 'fail', active: 0, max: 0, utilization: 0 },
          performance: { status: 'fail', averageQueryTime: 0, slowQueries: 0 },
          diskSpace: { status: 'fail', info: 'Unable to check disk space' },
        },
      };
    }
  }

  private async checkConnectivity(): Promise<{ status: 'pass' | 'fail'; responseTime: number }> {
    const startTime = performance.now();
    
    try {
      // 执行简单的连接测试查询
      await db.all(sql`SELECT 1 as test`);
      
      const responseTime = performance.now() - startTime;
      
      // 检查响应时间是否在可接受范围内
      if (responseTime > this.thresholds.connectivityTimeout) {
        return { status: 'fail', responseTime };
      }
      
      return { status: 'pass', responseTime };
    } catch {
      const responseTime = performance.now() - startTime;
      return { status: 'fail', responseTime };
    }
  }

  private async checkPragmaConfiguration(): Promise<{
    status: 'pass' | 'warn' | 'fail';
    settings: Record<string, string | number>;
    issues: string[];
  }> {
    try {
      const settings = await validateOptimization();
      const issues: string[] = [];
      
      // 验证关键PRAGMA设置
      if (settings.foreign_keys !== 1) {
        issues.push('外键约束未启用');
      }
      
      // 在生产环境中检查WAL模式
      if (process.env.NODE_ENV !== 'test' && settings.journal_mode.toLowerCase() !== 'wal') {
        issues.push('未使用WAL模式，并发性能可能受影响');
      }
      
      // 检查缓存大小设置
      if (Math.abs(settings.cache_size as number) < 1000) {
        issues.push('缓存大小可能过小，影响查询性能');
      }
      
      // 检查临时存储模式
      if (settings.temp_store !== 'memory' && Number(settings.temp_store) !== 2) {
        issues.push('临时存储未使用内存模式');
      }
      
      const status = issues.length === 0 ? 'pass' : 
                   issues.length <= 2 ? 'warn' : 'fail';
      
      return {
        status,
        settings,
        issues,
      };
    } catch (error) {
      return {
        status: 'fail',
        settings: {},
        issues: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  private async checkConnectionPool(): Promise<{
    status: 'pass' | 'warn' | 'fail';
    active: number;
    max: number;
    utilization: number;
  }> {
    try {
      const poolStatus = await getConnectionPoolStatus();
      const utilization = poolStatus.active_connections / poolStatus.max_connections;
      
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      
      if (utilization >= this.thresholds.connectionPool.utilization.critical) {
        status = 'fail';
      } else if (utilization >= this.thresholds.connectionPool.utilization.warning) {
        status = 'warn';
      }
      
      return {
        status,
        active: poolStatus.active_connections,
        max: poolStatus.max_connections,
        utilization,
      };
    } catch {
      return {
        status: 'fail',
        active: 0,
        max: 0,
        utilization: 0,
      };
    }
  }

  private async checkPerformance(): Promise<{
    status: 'pass' | 'warn' | 'fail';
    averageQueryTime: number;
    slowQueries: number;
  }> {
    const sampleQueries = [
      sql`SELECT COUNT(*) FROM sqlite_master WHERE type='table'`,
      sql`SELECT datetime('now') as current_time`,
      sql`SELECT 1 as test_query`,
      sql`PRAGMA quick_check`,
    ];
    
    const queryTimes: number[] = [];
    let slowQueries = 0;
    
    try {
      for (const query of sampleQueries) {
        const startTime = performance.now();
        await db.all(query);
        const queryTime = performance.now() - startTime;
        
        queryTimes.push(queryTime);
        
        if (queryTime > this.thresholds.queryPerformance.acceptable) {
          slowQueries++;
        }
      }
      
      const averageQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      
      if (averageQueryTime > this.thresholds.queryPerformance.critical) {
        status = 'fail';
      } else if (averageQueryTime > this.thresholds.queryPerformance.acceptable || slowQueries > 1) {
        status = 'warn';
      }
      
      return {
        status,
        averageQueryTime,
        slowQueries,
      };
    } catch {
      return {
        status: 'fail',
        averageQueryTime: 0,
        slowQueries: sampleQueries.length,
      };
    }
  }

  private async checkDiskSpace(): Promise<{
    status: 'pass' | 'warn' | 'fail';
    info: string;
  }> {
    try {
      // 检查数据库文件大小和可用空间
      // 在SQLite中，我们可以检查page_count和page_size
      const [pageCount, pageSize] = await Promise.all([
        db.all(sql`PRAGMA page_count`),
        db.all(sql`PRAGMA page_size`),
      ]);
      
      const dbSizeBytes = ((pageCount[0] as { page_count: number }).page_count) * ((pageSize[0] as { page_size: number }).page_size);
      const dbSizeMB = Math.round(dbSizeBytes / 1024 / 1024 * 100) / 100;
      
      // 简单的磁盘空间检查
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let info = `数据库大小: ${dbSizeMB}MB`;
      
      // 如果数据库大小超过100MB，给出警告
      if (dbSizeMB > 100) {
        status = 'warn';
        info += ' (数据库文件较大)';
      }
      
      // 如果数据库大小超过1GB，标记为失败
      if (dbSizeMB > 1000) {
        status = 'fail';
        info += ' (数据库文件过大)';
      }
      
      return { status, info };
    } catch {
      return {
        status: 'warn',
        info: '无法获取磁盘空间信息',
      };
    }
  }

  private determineOverallStatus(statuses: Array<'pass' | 'warn' | 'fail'>): 'pass' | 'warn' | 'fail' {
    if (statuses.includes('fail')) {
      return 'fail';
    }
    
    if (statuses.includes('warn')) {
      return 'warn';
    }
    
    return 'pass';
  }

  private generateStatusMessage(
    status: 'pass' | 'warn' | 'fail',
    details: DatabaseHealthResult['details']
  ): string {
    switch (status) {
      case 'pass':
        return '数据库健康状况良好';
        
      case 'warn': {
        const warnings: string[] = [];
        
        if (details.pragmaConfig.issues.length > 0) {
          warnings.push('配置问题');
        }
        
        if (details.connectionPool.status === 'warn') {
          warnings.push('连接池使用率高');
        }
        
        if (details.performance.status === 'warn') {
          warnings.push('查询性能慢');
        }
        
        if (details.diskSpace.status === 'warn') {
          warnings.push('存储空间');
        }
        
        return `数据库存在警告: ${warnings.join(', ')}`;
      }
        
      case 'fail': {
        const failures: string[] = [];
        
        if (details.connectivity.status === 'fail') {
          failures.push('连接失败');
        }
        
        if (details.pragmaConfig.status === 'fail') {
          failures.push('配置严重错误');
        }
        
        if (details.connectionPool.status === 'fail') {
          failures.push('连接池耗尽');
        }
        
        if (details.performance.status === 'fail') {
          failures.push('性能严重下降');
        }
        
        if (details.diskSpace.status === 'fail') {
          failures.push('存储空间不足');
        }
        
        return `数据库存在严重问题: ${failures.join(', ')}`;
      }
        
      default:
        return '数据库状态未知';
    }
  }
}

// 导出单例实例
export const databaseHealthChecker = new DatabaseHealthChecker();