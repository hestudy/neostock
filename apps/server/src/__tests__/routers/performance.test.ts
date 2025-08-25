import { describe, it, expect, beforeEach } from "vitest";
import { appRouter, type AppRouter } from '../../routers/index';

describe('Performance Router', () => {
  let caller: ReturnType<AppRouter['createCaller']>;

  beforeEach(() => {
    // Create a mock context
    const mockContext = {
      session: null,
      user: null
    };
    
    caller = appRouter.createCaller(mockContext);
  });

  it('should provide performance metrics endpoint', async () => {
    const result = await caller.performance.metrics();
    
    expect(result).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(result.responseTime).toBeDefined();
    expect(result.responseTime.thresholds).toBeDefined();
    expect(result.responseTime.thresholds.BASIC_OPERATIONS).toBe(200);
    expect(result.responseTime.thresholds.COMPLEX_QUERIES).toBe(500);
    expect(result.responseTime.thresholds.CRITICAL_THRESHOLD).toBe(1000);
  });

  it('should provide benchmark definitions', async () => {
    const result = await caller.performance.benchmarks();
    
    expect(result).toBeDefined();
    expect(result.current).toBeDefined();
    expect(result.definitions).toBeDefined();
    expect(result.definitions.basic_operations).toBeDefined();
    expect(result.definitions.complex_queries).toBeDefined();
    expect(result.definitions.critical_threshold).toBeDefined();
  });

  it('should provide performance history', async () => {
    const result = await caller.performance.history();
    
    expect(result).toBeDefined();
    expect(result.statistics).toBeDefined();
    expect(result.statistics.percentiles).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });

  it('should provide alert status', async () => {
    const result = await caller.performance.alerts();
    
    expect(result).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(result.hasAlerts).toBeDefined();
    expect(result.alertCount).toBeDefined();
    expect(result.alerts).toBeInstanceOf(Array);
    expect(result.performanceStatus).toBeDefined();
  });

  it('should allow reset of performance counters', async () => {
    const result = await caller.performance.reset();
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.message).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });
});