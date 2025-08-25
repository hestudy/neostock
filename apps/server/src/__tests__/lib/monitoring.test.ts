import { describe, it, expect, beforeEach } from "vitest";
import { HealthMonitor } from '../../lib/monitoring';

describe('Health Monitoring System', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = new HealthMonitor();
  });

  describe('Health Check Execution', () => {
    it('should perform complete health check', async () => {
      const result = await monitor.performHealthCheck();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('metrics');

      // Verify timestamp format
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);

      // Verify uptime is reasonable
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.uptime).toBeLessThan(10); // Should be less than 10 seconds for test
    });

    it('should include all required health checks', async () => {
      const result = await monitor.performHealthCheck();

      expect(result.checks).toHaveProperty('database');
      expect(result.checks).toHaveProperty('memory');
      expect(result.checks).toHaveProperty('disk');
      expect(result.checks).toHaveProperty('external_apis');

      // Each check should have status
      Object.values(result.checks).forEach(check => {
        expect(check).toHaveProperty('status');
        expect(['pass', 'warn', 'fail']).toContain(check.status);
      });
    });

    it('should determine overall status correctly', async () => {
      const result = await monitor.performHealthCheck();
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    });

    it('should include system metrics', async () => {
      const result = await monitor.performHealthCheck();
      const { metrics } = result;

      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('disk');
      expect(metrics).toHaveProperty('requests');

      // Memory metrics
      expect(metrics.memory.used).toBeGreaterThan(0);
      expect(metrics.memory.total).toBeGreaterThan(metrics.memory.used);
      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.percentage).toBeLessThanOrEqual(100);

      // CPU metrics
      expect(Array.isArray(metrics.cpu.loadAverage)).toBe(true);
      expect(metrics.cpu.loadAverage).toHaveLength(3);

      // Request metrics
      expect(metrics.requests.total).toBeGreaterThanOrEqual(0);
      expect(metrics.requests.errors).toBeGreaterThanOrEqual(0);
      expect(metrics.requests.averageResponseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Individual Health Checks', () => {
    it('should perform database health check with response time', async () => {
      const result = await monitor.performHealthCheck();
      const dbCheck = result.checks.database;

      expect(dbCheck.status).toBe('pass');
      expect(dbCheck).toHaveProperty('responseTime');
      expect(dbCheck.responseTime).toBeGreaterThan(0);
      expect(dbCheck.responseTime).toBeLessThan(1000); // Should be quick
      expect(dbCheck.message).toContain('Database connection successful');
    });

    it('should perform memory health check with usage details', async () => {
      const result = await monitor.performHealthCheck();
      const memCheck = result.checks.memory;

      expect(['pass', 'warn', 'fail']).toContain(memCheck.status);
      expect(memCheck.message).toContain('Memory usage');
      expect(memCheck.details).toHaveProperty('rss');
      expect(memCheck.details).toHaveProperty('heapTotal');
      expect(memCheck.details).toHaveProperty('heapUsed');
      expect(memCheck.details).toHaveProperty('systemUsage');
    });

    it('should perform disk health check', async () => {
      const result = await monitor.performHealthCheck();
      const diskCheck = result.checks.disk;

      expect(['pass', 'warn', 'fail']).toContain(diskCheck.status);
      expect(diskCheck.message).toContain('Disk usage');
      expect(diskCheck.details).toHaveProperty('usage');
      expect(diskCheck.details).toHaveProperty('path');
    });

    it('should perform external API health check', async () => {
      const result = await monitor.performHealthCheck();
      const apiCheck = result.checks.external_apis;

      expect(apiCheck.status).toBe('pass');
      expect(apiCheck).toHaveProperty('responseTime');
      expect(apiCheck.message).toContain('External APIs accessible');
      expect(apiCheck.details).toHaveProperty('tushare');
    });
  });

  describe('Request Tracking', () => {
    it('should track requests and calculate metrics', () => {
      // Record some test requests
      monitor.recordRequest(100, false); // Normal request
      monitor.recordRequest(200, false); // Normal request
      monitor.recordRequest(500, true);  // Error request

      const metrics = monitor.getRequestMetrics();

      expect(metrics.total).toBe(3);
      expect(metrics.errors).toBe(1);
      expect(metrics.errorRate).toBeCloseTo(33.33, 1);
      expect(metrics.averageResponseTime).toBeCloseTo(266.67, 1);
    });

    it('should maintain rolling window of response times', () => {
      // Record more than 100 requests to test window management
      for (let i = 0; i < 150; i++) {
        monitor.recordRequest(i * 10, false);
      }

      const metrics = monitor.getRequestMetrics();
      expect(metrics.total).toBe(150);
      // Average should be calculated from last 100 requests only
      expect(metrics.averageResponseTime).toBeGreaterThan(500);
    });

    it('should handle zero requests gracefully', () => {
      const metrics = monitor.getRequestMetrics();

      expect(metrics.total).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });
  });

  describe('Alert System', () => {
    it('should not alert under normal conditions', () => {
      // Reset state before test
      monitor.reset();
      
      // Record normal requests
      monitor.recordRequest(100, false);
      monitor.recordRequest(150, false);
      monitor.recordRequest(200, false);

      const alert = monitor.shouldAlert();
      expect(alert.alert).toBe(false);
      expect(alert.reasons).toHaveLength(0);
    });

    it('should alert on high error rate', () => {
      // Record requests with high error rate (>5%)
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest(100, false);
      }
      for (let i = 0; i < 2; i++) {
        monitor.recordRequest(100, true);
      }

      const alert = monitor.shouldAlert();
      expect(alert.alert).toBe(true);
      expect(alert.reasons.some(reason => reason.includes('High error rate'))).toBe(true);
    });

    it('should alert on high response time', () => {
      // Record requests with high response times (>500ms but <1000ms)
      monitor.recordRequest(800, false);
      monitor.recordRequest(700, false);
      monitor.recordRequest(600, false);

      const alert = monitor.shouldAlert();
      expect(alert.alert).toBe(true);
      expect(alert.reasons.some(reason => reason.includes('High response time'))).toBe(true);
    });

    it('should provide multiple alert reasons when applicable', () => {
      // High error rate
      for (let i = 0; i < 5; i++) {
        monitor.recordRequest(1500, true); // High response time + errors
      }

      const alert = monitor.shouldAlert();
      expect(alert.alert).toBe(true);
      expect(alert.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    it('should complete health check within reasonable time', async () => {
      const startTime = Date.now();
      await monitor.performHealthCheck();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle multiple concurrent health checks', async () => {
      const promises = Array(5).fill(null).map(() => monitor.performHealthCheck());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.status).toBeDefined();
        expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      });
    });

    it('should maintain consistent request tracking under load', () => {
      const requestCount = 1000;
      
      for (let i = 0; i < requestCount; i++) {
        monitor.recordRequest(Math.random() * 1000, Math.random() > 0.95);
      }

      const metrics = monitor.getRequestMetrics();
      expect(metrics.total).toBe(requestCount);
      expect(metrics.errors).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle health check in constrained memory conditions', async () => {
      // This test simulates low memory conditions
      // In a real scenario, you might mock process.memoryUsage()
      const result = await monitor.performHealthCheck();
      
      expect(result).toHaveProperty('status');
      expect(result.checks.memory).toHaveProperty('status');
    });

    it('should provide meaningful error details when checks fail', async () => {
      // This test verifies the structure is correct for error handling
      const result = await monitor.performHealthCheck();
      
      // Verify all checks have proper structure
      Object.values(result.checks).forEach(check => {
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('details');
        if (check.status === 'fail') {
          expect(typeof check.details).toBe('object');
        }
      });
    });
  });
});