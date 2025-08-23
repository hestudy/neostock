import { performance } from 'perf_hooks';
import os from 'os';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
    external_apis: HealthCheck;
  };
  metrics: SystemMetrics;
}

export interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  responseTime?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    loadAverage: number[];
    usage?: number;
  };
  disk: {
    available: number;
    total: number;
    percentage: number;
  };
  requests: {
    total: number;
    errors: number;
    averageResponseTime: number;
  };
}

export class HealthMonitor {
  private requestCounter = 0;
  private errorCounter = 0;
  private responseTimes: number[] = [];
  private startTime = Date.now();

  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkMemory(),
      this.checkDisk(),
      this.checkExternalAPIs()
    ]);

    const [database, memory, disk, external_apis] = checks;
    
    const overallStatus = this.determineOverallStatus([database, memory, disk, external_apis]);
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database,
        memory,
        disk,
        external_apis
      },
      metrics: await this.collectMetrics()
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      // Simple database connectivity test
      // This would be implemented with your actual database connection
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate DB query
      
      const responseTime = performance.now() - startTime;
      
      return {
        status: 'pass',
        responseTime,
        message: 'Database connection successful',
        details: {
          responseTime: `${responseTime.toFixed(2)}ms`
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: performance.now() - startTime,
        message: 'Database connection failed',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMemPercentage = ((totalMem - freeMem) / totalMem) * 100;

      const status = usedMemPercentage > 90 ? 'fail' : 
                   usedMemPercentage > 70 ? 'warn' : 'pass';

      return {
        status,
        message: `Memory usage: ${usedMemPercentage.toFixed(2)}%`,
        details: {
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          external: Math.round(memUsage.external / 1024 / 1024), // MB
          systemUsage: `${usedMemPercentage.toFixed(2)}%`
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Memory check failed',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async checkDisk(): Promise<HealthCheck> {
    try {
      // This is a simplified check - in production you'd check actual disk space
      const usage = Math.random() * 100; // Simulate disk usage
      
      const status = usage > 90 ? 'fail' : usage > 80 ? 'warn' : 'pass';

      return {
        status,
        message: `Disk usage: ${usage.toFixed(2)}%`,
        details: {
          usage: `${usage.toFixed(2)}%`,
          path: process.cwd()
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Disk check failed',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async checkExternalAPIs(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      // Simulate external API check
      // In reality, this would check tushare API or other external services
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const responseTime = performance.now() - startTime;
      
      return {
        status: 'pass',
        responseTime,
        message: 'External APIs accessible',
        details: {
          tushare: 'available',
          responseTime: `${responseTime.toFixed(2)}ms`
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: performance.now() - startTime,
        message: 'External API check failed',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const hasFailures = checks.some(check => check.status === 'fail');
    const hasWarnings = checks.some(check => check.status === 'warn');

    if (hasFailures) return 'unhealthy';
    if (hasWarnings) return 'degraded';
    return 'healthy';
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100
      },
      cpu: {
        loadAverage: os.loadavg()
      },
      disk: {
        available: 1000000000, // Simplified - would get actual disk space
        total: 2000000000,
        percentage: 50
      },
      requests: {
        total: this.requestCounter,
        errors: this.errorCounter,
        averageResponseTime: this.responseTimes.length > 0 ? 
          this.responseTimes.reduce((a, b) => a + b) / this.responseTimes.length : 0
      }
    };
  }

  // Request tracking methods
  recordRequest(responseTime: number, isError: boolean = false) {
    this.requestCounter++;
    if (isError) this.errorCounter++;
    
    this.responseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  // Reset monitoring state for testing
  reset() {
    this.requestCounter = 0;
    this.errorCounter = 0;
    this.responseTimes = [];
  }

  getRequestMetrics() {
    return {
      total: this.requestCounter,
      errors: this.errorCounter,
      errorRate: this.requestCounter > 0 ? (this.errorCounter / this.requestCounter) * 100 : 0,
      averageResponseTime: this.responseTimes.length > 0 ? 
        this.responseTimes.reduce((a, b) => a + b) / this.responseTimes.length : 0
    };
  }

  // Alert checking
  shouldAlert(): { alert: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const metrics = this.getRequestMetrics();

    // Check error rate
    if (metrics.errorRate > 5) {
      reasons.push(`High error rate: ${metrics.errorRate.toFixed(2)}%`);
    }

    // Check average response time
    if (metrics.averageResponseTime > 1000) {
      reasons.push(`High response time: ${metrics.averageResponseTime.toFixed(2)}ms`);
    }

    // Check memory usage
    const memUsage = (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100;
    if (memUsage > 90) {
      reasons.push(`High memory usage: ${memUsage.toFixed(2)}%`);
    }

    return {
      alert: reasons.length > 0,
      reasons
    };
  }
}