import { describe, it, expect, beforeEach } from 'bun:test';
import { TushareAPIMock, FailureScenario } from '../../mocks/tushare-api-mock';

describe('Tushare API Mock System', () => {
  let mockApi: TushareAPIMock;

  beforeEach(() => {
    mockApi = new TushareAPIMock();
  });

  describe('Basic API Functionality', () => {
    it('should return stock basic information', async () => {
      const response = await mockApi.stockBasic();

      expect(response.code).toBe(0);
      expect(response.msg).toBe('Success');
      expect(response.data.fields).toContain('ts_code');
      expect(response.data.fields).toContain('name');
      expect(response.data.items.length).toBeGreaterThan(0);
    });

    it('should filter stocks by ts_code', async () => {
      const response = await mockApi.stockBasic({ ts_code: '000001.SZ' });

      expect(response.code).toBe(0);
      expect(response.data.items.length).toBe(1);
      expect(response.data.items[0][0]).toBe('000001.SZ');
    });

    it('should filter stocks by name', async () => {
      const response = await mockApi.stockBasic({ name: '银行' });

      expect(response.code).toBe(0);
      expect(response.data.items.length).toBeGreaterThan(0);
      
      // All results should contain '银行' in the name
      const nameIndex = response.data.fields.indexOf('name');
      response.data.items.forEach(item => {
        expect(item[nameIndex]).toContain('银行');
      });
    });

    it('should return daily data for specific stock', async () => {
      const response = await mockApi.daily({ ts_code: '000001.SZ' });

      expect(response.code).toBe(0);
      expect(response.data.fields).toContain('trade_date');
      expect(response.data.fields).toContain('close');
      expect(response.data.items.length).toBeGreaterThan(0);
    });

    it('should require ts_code for daily data', async () => {
      const response = await mockApi.daily({});

      expect(response.code).toBe(-2004);
      expect(response.msg).toContain('ts_code is required');
    });
  });

  describe('Failure Scenario Simulation', () => {
    it('should simulate network error', async () => {
      mockApi.setFailureMode(FailureScenario.NETWORK_ERROR);

      await expect(mockApi.stockBasic()).rejects.toThrow('Network connection failed');
    });

    it('should simulate API limit exceeded', async () => {
      mockApi.setFailureMode(FailureScenario.API_LIMIT_EXCEEDED);
      
      const response = await mockApi.stockBasic();
      expect(response.code).toBe(-2001);
      expect(response.msg).toContain('API daily limit exceeded');
    });

    it('should simulate invalid token', async () => {
      mockApi.setFailureMode(FailureScenario.INVALID_TOKEN);
      
      const response = await mockApi.stockBasic();
      expect(response.code).toBe(-2002);
      expect(response.msg).toContain('Invalid token');
    });

    it('should simulate service unavailable', async () => {
      mockApi.setFailureMode(FailureScenario.SERVICE_UNAVAILABLE);
      
      const response = await mockApi.stockBasic();
      expect(response.code).toBe(-2003);
      expect(response.msg).toContain('Service temporarily unavailable');
    });

    it('should simulate invalid parameters', async () => {
      mockApi.setFailureMode(FailureScenario.INVALID_PARAMS);
      
      const response = await mockApi.stockBasic();
      expect(response.code).toBe(-2004);
      expect(response.msg).toContain('Invalid parameters');
    });

    it('should simulate timeout', async () => {
      mockApi.setFailureMode(FailureScenario.TIMEOUT);

      // 在CI环境中使用更长的超时时间
      const isCI = process.env.CI === 'true';
      const timeoutMs = isCI ? 2000 : 1000; // CI环境使用2秒，本地使用1秒
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), timeoutMs);
      });

      await expect(Promise.race([
        mockApi.stockBasic(),
        timeoutPromise
      ])).rejects.toThrow('Test timeout');
    }, 10000); // 增加测试超时时间到10秒
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting per endpoint', async () => {
      // Make many requests quickly to trigger rate limit
      const requests = Array(105).fill(null).map(() => mockApi.stockBasic());
      const results = await Promise.all(requests);

      // Some requests should be rate limited
      const rateLimitedRequests = results.filter(r => r.code === -2005);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });

    it('should track request count', async () => {
      const initialCount = mockApi.getRequestCount();
      
      await mockApi.stockBasic();
      await mockApi.daily({ ts_code: '000001.SZ' });
      
      expect(mockApi.getRequestCount()).toBe(initialCount + 2);
    });

    it('should reset request count', async () => {
      await mockApi.stockBasic();
      expect(mockApi.getRequestCount()).toBeGreaterThan(0);
      
      mockApi.resetRequestCount();
      expect(mockApi.getRequestCount()).toBe(0);
    });

    it('should enforce daily limit', async () => {
      mockApi.setDailyLimit(5);
      mockApi.resetRequestCount();

      // Make 6 requests to exceed daily limit
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(await mockApi.stockBasic());
      }

      // The 6th request should be rejected due to daily limit
      const lastRequest = requests[requests.length - 1];
      expect(lastRequest.code).toBe(-2001);
      expect(lastRequest.msg).toContain('Daily limit exceeded');
    });
  });

  describe('Response Delay Simulation', () => {
    it('should add configurable response delay', async () => {
      const delay = 100; // 100ms
      mockApi.setResponseDelay(delay);

      const startTime = Date.now();
      await mockApi.stockBasic();
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(delay - 10); // Allow 10ms tolerance
    });

    it('should work without delay by default', async () => {
      const startTime = Date.now();
      await mockApi.stockBasic();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50); // Should be very fast without delay
    });
  });

  describe('Data Quality Validation', () => {
    it('should validate successful response structure', async () => {
      const response = await mockApi.stockBasic();
      const validation = mockApi.validateDataQuality(response);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect invalid data format', () => {
      const invalidData = null;
      const validation = mockApi.validateDataQuality(invalidData);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Invalid data format');
    });

    it('should detect API error responses', () => {
      const errorResponse = {
        code: -2001,
        msg: 'API limit exceeded',
        data: { fields: [], items: [] }
      };
      const validation = mockApi.validateDataQuality(errorResponse);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('API error: API limit exceeded');
    });

    it('should detect invalid data structure', () => {
      const invalidStructure = {
        code: 0,
        msg: 'Success',
        data: null
      };
      const validation = mockApi.validateDataQuality(invalidStructure);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Invalid data structure');
    });

    it('should detect field mismatch', () => {
      const mismatchedData = {
        code: 0,
        msg: 'Success',
        data: {
          fields: ['field1', 'field2'],
          items: [['value1'], ['value1', 'value2', 'value3']] // Mismatched lengths
        }
      };
      const validation = mockApi.validateDataQuality(mismatchedData);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Data field mismatch');
    });

    it('should detect missing required stock information', () => {
      const incompleteData = {
        code: 0,
        msg: 'Success',
        data: {
          fields: ['ts_code', 'name'],
          items: [['000001.SZ', ''], [null, '平安银行']] // Missing required data
        }
      };
      const validation = mockApi.validateDataQuality(incompleteData);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Missing required stock information');
    });
  });

  describe('Data Source Switching', () => {
    it('should simulate backup source switching', async () => {
      mockApi.setFailureMode(FailureScenario.NETWORK_ERROR);
      
      const switchResult = await mockApi.switchToBackupSource();
      
      // Should succeed most of the time (90% success rate)
      if (switchResult) {
        // After successful switch, failure mode should be cleared
        const stats = mockApi.getMockStatistics();
        expect(stats.failureMode).toBeNull();
      }
    });

    it('should handle backup source failure', async () => {
      // Test a few attempts to simulate occasional backup failures
      const attempts = [];
      for (let i = 0; i < 3; i++) {
        attempts.push(await mockApi.switchToBackupSource());
      }

      // Should complete within reasonable time
      expect(attempts.length).toBe(3);
      
      // Results should be boolean
      attempts.forEach(result => {
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('Mock Statistics and Monitoring', () => {
    it('should provide comprehensive mock statistics', async () => {
      await mockApi.stockBasic();
      mockApi.setResponseDelay(100);
      mockApi.setFailureMode(FailureScenario.API_LIMIT_EXCEEDED);

      const stats = mockApi.getMockStatistics();

      expect(stats).toHaveProperty('requestCount');
      expect(stats).toHaveProperty('dailyLimit');
      expect(stats).toHaveProperty('failureMode');
      expect(stats).toHaveProperty('responseDelay');
      expect(stats).toHaveProperty('stockCount');
      expect(stats).toHaveProperty('rateLimitStatus');

      expect(stats.requestCount).toBeGreaterThan(0);
      expect(stats.failureMode).toBe(FailureScenario.API_LIMIT_EXCEEDED);
      expect(stats.responseDelay).toBe(100);
      expect(stats.stockCount).toBeGreaterThan(0);
    });

    it('should track different endpoint usage', async () => {
      await mockApi.stockBasic();
      await mockApi.daily({ ts_code: '000001.SZ' });

      const stats = mockApi.getMockStatistics();
      expect(stats.requestCount).toBe(2);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = Array(concurrentRequests).fill(null).map(() => 
        mockApi.stockBasic()
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('data');
      });
    });

    it('should maintain performance under load', async () => {
      const loadTestCount = 50;
      const startTime = Date.now();
      
      const promises = Array(loadTestCount).fill(null).map(() => 
        mockApi.stockBasic()
      );
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      const averageTime = duration / loadTestCount;
      
      // Should handle 50 requests in reasonable time
      expect(averageTime).toBeLessThan(100); // Average less than 100ms per request
    });

    it('should generate consistent daily data', async () => {
      const response1 = await mockApi.daily({ ts_code: '000001.SZ' });
      const response2 = await mockApi.daily({ ts_code: '000001.SZ' });

      expect(response1.data.items).toEqual(response2.data.items);
    });
  });
});