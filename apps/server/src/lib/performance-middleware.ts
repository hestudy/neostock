import type { Context } from 'hono';
import { healthMonitor } from '../routers/performance';
import { PERFORMANCE_BENCHMARKS } from './monitoring';

export interface PerformanceAlert {
  id: string;
  severity: 'warning' | 'high' | 'critical';
  type: 'response_time' | 'error_rate' | 'system_health';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Simple in-memory alert storage (in production, you'd use a proper storage/queue)
class AlertManager {
  private alerts: PerformanceAlert[] = [];
  private lastCheckTime = Date.now();
  private checkInterval = PERFORMANCE_BENCHMARKS.MONITORING_INTERVALS.ALERT_CHECK * 1000;

  constructor() {
    // Set up periodic alert checking
    setInterval(() => {
      this.checkAndTriggerAlerts();
    }, this.checkInterval);
  }

  private checkAndTriggerAlerts() {
    const alertStatus = healthMonitor.shouldAlert();
    
    if (alertStatus.alert && alertStatus.reasons.length > 0) {
      for (const reason of alertStatus.reasons) {
        this.createAlert({
          severity: this.determineSeverity(reason),
          type: this.determineType(reason),
          message: reason
        });
      }
    }

    this.lastCheckTime = Date.now();
  }

  private determineSeverity(reason: string): 'warning' | 'high' | 'critical' {
    if (reason.includes('Critical')) return 'critical';
    if (reason.includes('High')) return 'high';
    return 'warning';
  }

  private determineType(reason: string): 'response_time' | 'error_rate' | 'system_health' {
    if (reason.includes('response time')) return 'response_time';
    if (reason.includes('error rate')) return 'error_rate';
    return 'system_health';
  }

  private createAlert(params: Omit<PerformanceAlert, 'id' | 'timestamp'>) {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...params
    };

    this.alerts.unshift(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }

    // In production, you would send this to external alerting systems
    this.sendAlert(alert);
  }

  private sendAlert(alert: PerformanceAlert) {
    // Log the alert (in production, send to Slack, email, etc.)
    console.warn(`🚨 Performance Alert [${alert.severity.toUpperCase()}]:`, {
      type: alert.type,
      message: alert.message,
      timestamp: alert.timestamp,
      id: alert.id
    });

    // Here you would integrate with external alerting services:
    // - Slack webhooks
    // - Email notifications
    // - PagerDuty/Opsgenie
    // - Discord webhooks
    // - Teams webhooks
  }

  getRecentAlerts(limit: number = 10): PerformanceAlert[] {
    return this.alerts.slice(0, limit);
  }

  getAlertStats() {
    const now = Date.now();
    const lastHour = now - (60 * 60 * 1000);
    const last24Hours = now - (24 * 60 * 60 * 1000);

    const recentAlerts = this.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > lastHour
    );

    const dailyAlerts = this.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > last24Hours
    );

    return {
      total: this.alerts.length,
      lastHour: recentAlerts.length,
      last24Hours: dailyAlerts.length,
      bySeverity: {
        critical: this.alerts.filter(a => a.severity === 'critical').length,
        high: this.alerts.filter(a => a.severity === 'high').length,
        warning: this.alerts.filter(a => a.severity === 'warning').length
      },
      byType: {
        response_time: this.alerts.filter(a => a.type === 'response_time').length,
        error_rate: this.alerts.filter(a => a.type === 'error_rate').length,
        system_health: this.alerts.filter(a => a.type === 'system_health').length
      }
    };
  }

  clearAlerts() {
    this.alerts = [];
  }
}

// Global alert manager instance
export const alertManager = new AlertManager();

// Performance tracking middleware
export function performanceMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const startTime = Date.now();
    let isError = false;

    try {
      await next();
    } catch (error) {
      isError = true;
      throw error;
    } finally {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Record the request in our health monitor
      healthMonitor.recordRequest(responseTime, isError);

      // Add performance headers for debugging
      c.header('X-Response-Time', `${responseTime}ms`);
      c.header('X-Performance-Status', getPerformanceStatus(responseTime));

      // Log slow requests
      if (responseTime > PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME.CRITICAL_THRESHOLD) {
        console.warn(`🐌 Slow request detected:`, {
          path: c.req.path,
          method: c.req.method,
          responseTime: `${responseTime}ms`,
          userAgent: c.req.header('User-Agent'),
          timestamp: new Date().toISOString()
        });
      }
    }
  };
}

function getPerformanceStatus(responseTime: number): string {
  if (responseTime <= PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME.BASIC_OPERATIONS) {
    return 'excellent';
  } else if (responseTime <= PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME.COMPLEX_QUERIES) {
    return 'good';
  } else if (responseTime <= PERFORMANCE_BENCHMARKS.API_RESPONSE_TIME.CRITICAL_THRESHOLD) {
    return 'warning';
  } else {
    return 'critical';
  }
}

// Alert configuration for external services (to be used in production)
export interface AlertConfig {
  slack?: {
    webhook: string;
    channel?: string;
  };
  email?: {
    smtp: {
      host: string;
      port: number;
      user: string;
      password: string;
    };
    recipients: string[];
  };
  discord?: {
    webhook: string;
  };
  pagerduty?: {
    apiKey: string;
    serviceKey: string;
  };
}

// This would be configured via environment variables in production
export const ALERT_CONFIG: Partial<AlertConfig> = {
  // slack: {
  //   webhook: process.env.SLACK_WEBHOOK_URL || '',
  //   channel: process.env.SLACK_CHANNEL || '#alerts'
  // }
};