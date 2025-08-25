import { router, publicProcedure } from '../lib/trpc';
import { HealthMonitor, PERFORMANCE_BENCHMARKS } from '../lib/monitoring';

// Global health monitor instance
const healthMonitor = new HealthMonitor();

export const performanceRouter = router({
  // Get current performance metrics
  metrics: publicProcedure.query(async () => {
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
  benchmarks: publicProcedure.query(() => {
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
  history: publicProcedure.query(() => {
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

    return {
      ...history,
      statistics: {
        count,
        min: count > 0 ? Math.min(...responseTimes) : 0,
        max: count > 0 ? Math.max(...responseTimes) : 0,
        percentiles
      }
    };
  }),

  // Get current alert status
  alerts: publicProcedure.query(() => {
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
  reset: publicProcedure.mutation(() => {
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