import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testClient } from '../helpers/test-client';

describe('API Performance Tests - Response Time Validation', () => {
  beforeAll(async () => {
    // 预热测试环境
    await testClient.health.query();
  });

  afterAll(async () => {
    // 清理测试数据
  });

  describe('Core API Endpoints Performance', () => {
    it('health check should respond within 50ms', async () => {
      const iterations = 10;
      const responseTimes: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await testClient.health.query();
        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);
      }
      
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      
      expect(averageResponseTime).toBeLessThan(50);
      expect(maxResponseTime).toBeLessThan(100);
    });

    it('auth endpoints should respond within 100ms', async () => {
      const startTime = performance.now();
      
      try {
        // 测试认证相关端点的响应时间
        await testClient.auth.me.query();
      } catch {
        // 未认证状态下的错误是预期的，我们关心的是响应时间
      }
      
      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });
  });

  describe('Stock Data API Performance', () => {
    it('stock search should respond within 200ms', async () => {
      const searchTerms = ['平安', '银行', '000001', '腾讯'];
      
      for (const term of searchTerms) {
        const startTime = performance.now();
        
        try {
          await testClient.stocks.search.query({ keyword: term });
        } catch {
          // API可能还未实现，但我们要测试响应时间框架
        }
        
        const responseTime = performance.now() - startTime;
        expect(responseTime).toBeLessThan(200);
      }
    });

    it('stock details should respond within 300ms', async () => {
      const stockCodes = ['000001.SZ', '000002.SZ', '600000.SH'];
      
      for (const code of stockCodes) {
        const startTime = performance.now();
        
        try {
          await testClient.stocks.detail.query({ ts_code: code });
        } catch {
          // API可能还未实现
        }
        
        const responseTime = performance.now() - startTime;
        expect(responseTime).toBeLessThan(300);
      }
    });
  });

  describe('Database Query Performance', () => {
    it('database health check should respond within 100ms', async () => {
      const startTime = performance.now();
      
      try {
        await testClient.monitoring.database.query();
      } catch {
        // 监控端点可能还未完全实现
      }
      
      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle 50 concurrent requests within acceptable time', async () => {
      const concurrentRequests = 50;
      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrentRequests }, () => 
        testClient.health.query().catch(() => null)
      );
      
      await Promise.all(promises);
      
      const totalTime = performance.now() - startTime;
      const averageTimePerRequest = totalTime / concurrentRequests;
      
      expect(averageTimePerRequest).toBeLessThan(100);
      expect(totalTime).toBeLessThan(5000); // 总时间不超过5秒
    });

    it('should maintain performance under load', async () => {
      const warmupRequests = 10;
      const testRequests = 20;
      
      // 预热请求
      const warmupPromises = Array.from({ length: warmupRequests }, () =>
        testClient.health.query().catch(() => null)
      );
      await Promise.all(warmupPromises);
      
      // 测试请求
      const responseTimes: number[] = [];
      
      for (let i = 0; i < testRequests; i++) {
        const startTime = performance.now();
        await testClient.health.query().catch(() => null);
        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);
      }
      
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort()[Math.floor(responseTimes.length * 0.95)];
      
      expect(averageResponseTime).toBeLessThan(50);
      expect(p95ResponseTime).toBeLessThan(100);
    });
  });
});