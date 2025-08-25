import { router, publicProcedure } from '../lib/trpc';
import { HealthMonitor, PERFORMANCE_BENCHMARKS } from '../lib/monitoring';
import { z } from 'zod';

// Global health monitor instance
const healthMonitor = new HealthMonitor();

export const performanceRouter = router({
  // Get current performance metrics
  metrics: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/performance/metrics',
        summary: 'Get current performance metrics',
        description: 'Returns current performance metrics, benchmarks, and alert status',
        tags: ['Performance'],
        protect: false
      }
    })
    .input(z.void())
    .output(z.object({
      timestamp: z.string(),
      responseTime: z.object({
        current: z.number(),
        status: z.string(),
        benchmark: z.string(),
        thresholds: z.any()
      }),
      requests: z.object({
        total: z.number(),
        errors: z.number(),
        errorRate: z.number(),
        successRate: z.number()
      }),
      alerts: z.object({
        active: z.boolean(),
        reasons: z.array(z.string()),
        count: z.number()
      }),
      benchmarks: z.any()
    }))
    .query(async () => {
    const requestMetrics = healthMonitor.getRequestMetrics();
    const benchmarkStatus = healthMonitor.getPerformanceBenchmarkStatus();
    const alertStatus = healthMonitor.shouldAlert();

    return {
      timestamp: new Date().toISOString(),
      responseTime: {
        current: requestMetrics.averageResponseTime,
        status: benchmarkStatus.status,
        benchmark: benchmarkStatus.benchmark,
        thresholds: PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME
      },
      requests: {
        total: requestMetrics.total,
        errors: requestMetrics.errors,
        errorRate: requestMetrics.errorRate,
        successRate: 100 - requestMetrics.errorRate
      },
      alerts: {
        active: alertStatus.alert,
        reasons: alertStatus.reasons,
        count: alertStatus.reasons.length
      },
      benchmarks: PERFORMANCE_BENCHMARKS
    };
  }),

  // Get performance benchmark comparison
  benchmarks: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/performance/benchmarks',
        summary: 'Get performance benchmark comparison',
        description: 'Returns performance benchmark definitions and current status',
        tags: ['Performance'],
        protect: false
      }
    })
    .input(z.void())
    .output(z.object({
      current: z.any(),
      definitions: z.object({
        basic_operations: z.object({
          threshold: z.number(),
          description: z.string(),
          examples: z.array(z.string())
        }),
        complex_queries: z.object({
          threshold: z.number(),
          description: z.string(),
          examples: z.array(z.string())
        }),
        critical_threshold: z.object({
          threshold: z.number(),
          description: z.string(),
          action: z.string()
        })
      })
    }))
    .query(() => {
    const benchmarkStatus = healthMonitor.getPerformanceBenchmarkStatus();
    
    return {
      current: benchmarkStatus,
      definitions: {
        basic_operations: {
          threshold: PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME.BASIC_OPERATIONS,
          description: '基础操作 - 简单查询和CRUD操作',
          examples: ['用户登录', '获取个人信息', '简单股票列表']
        },
        complex_queries: {
          threshold: PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME.COMPLEX_QUERIES,
          description: '复杂查询 - 数据分析和复合查询',
          examples: ['股票分析报告', '历史数据查询', '复杂图表生成']
        },
        critical_threshold: {
          threshold: PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME.CRITICAL_THRESHOLD,
          description: '临界阈值 - 超过此值需要立即关注',
          action: '超过此阈值将触发告警和优化措施'
        }
      }
    };
  }),

  // Get performance history (last 100 requests)
  history: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/performance/history',
        summary: 'Get performance history',
        description: 'Returns performance history data with statistics and percentiles',
        tags: ['Performance'],
        protect: false
      }
    })
    .input(z.void())
    .output(z.object({
      responseTimes: z.array(z.number()),
      averageResponseTime: z.number(),
      requestCount: z.number(),
      errorCount: z.number(),
      timestamp: z.string(),
      statistics: z.object({
        count: z.number(),
        min: z.number(),
        max: z.number(),
        percentiles: z.object({
          p50: z.number(),
          p90: z.number(),
          p95: z.number(),
          p99: z.number()
        })
      })
    }))
    .query(() => {
    const history = healthMonitor.getPerformanceHistory();
    
    // Calculate percentiles from response times
    const responseTimes = [...history.responseTimes].sort((a, b) => a - b);
    const count = responseTimes.length;
    
    const percentiles = count > 0 ? {
      p50: responseTimes[Math.floor(count * 0.5)] || 0,
      p90: responseTimes[Math.floor(count * 0.9)] || 0,
      p95: responseTimes[Math.floor(count * 0.95)] || 0,
      p99: responseTimes[Math.floor(count * 0.99)] || 0
    } : {
      p50: 0, p90: 0, p95: 0, p99: 0
    };

    // Calculate average response time
    const averageResponseTime = count > 0 ? 
      responseTimes.reduce((sum, time) => sum + time, 0) / count : 0;

    return {
      responseTimes: history.responseTimes,
      averageResponseTime,
      requestCount: history.requestCount || 0,
      errorCount: history.errorCount || 0,
      timestamp: history.timestamp,
      statistics: {
        count,
        min: count > 0 ? Math.min(...responseTimes) : 0,
        max: count > 0 ? Math.max(...responseTimes) : 0,
        percentiles
      }
    };
  }),

  // Get current alert status
  alerts: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/performance/alerts',
        summary: 'Get current alert status',
        description: 'Returns current alert status and performance monitoring alerts',
        tags: ['Performance'],
        protect: false
      }
    })
    .input(z.void())
    .output(z.object({
      timestamp: z.string(),
      hasAlerts: z.boolean(),
      alertCount: z.number(),
      alerts: z.array(z.object({
        id: z.string(),
        severity: z.string(),
        message: z.string(),
        timestamp: z.string()
      })),
      performanceStatus: z.object({
        status: z.string(),
        message: z.string(),
        benchmark: z.string()
      })
    }))
    .query(() => {
    const alertStatus = healthMonitor.shouldAlert();
    const benchmarkStatus = healthMonitor.getPerformanceBenchmarkStatus();
    
    return {
      timestamp: new Date().toISOString(),
      hasAlerts: alertStatus.alert,
      alertCount: alertStatus.reasons.length,
      alerts: alertStatus.reasons.map((reason, index) => ({
        id: `alert_${index}`,
        severity: alertStatus.reasons[index].includes('Critical') ? 'critical' : 
                 alertStatus.reasons[index].includes('High') ? 'high' : 'warning',
        message: reason,
        timestamp: new Date().toISOString()
      })),
      performanceStatus: {
        status: benchmarkStatus.status,
        message: `当前响应时间: ${benchmarkStatus.currentResponseTime.toFixed(2)}ms`,
        benchmark: benchmarkStatus.benchmark
      }
    };
  }),

  // Reset performance counters (for testing/admin use)
  reset: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/performance/reset',
        summary: 'Reset performance counters',
        description: 'Resets all performance counters and metrics (for testing/admin use)',
        tags: ['Performance'],
        protect: false
      }
    })
    .input(z.void())
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
      timestamp: z.string()
    }))
    .mutation(() => {
    healthMonitor.reset();
    return {
      success: true,
      message: 'Performance counters reset successfully',
      timestamp: new Date().toISOString()
    };
  })
});

// Export the health monitor instance for middleware use
export { healthMonitor };