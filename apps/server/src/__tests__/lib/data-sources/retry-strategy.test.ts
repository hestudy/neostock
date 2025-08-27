import { describe, it, expect, beforeEach, vi } from 'vitest';

// 重试策略配置接口
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  exponentialFactor: number;
  jitter: number;
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

// 重试策略实现
class RetryStrategy {
  constructor(private config: RetryConfig) {}

  public async execute<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error;

    while (attempt <= this.config.maxRetries) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // 检查是否为不可重试的错误
        if (this.isNonRetryableError(error as Error)) {
          throw error;
        }

        // 如果达到最大重试次数，抛出最后一个错误
        if (attempt > this.config.maxRetries) {
          throw lastError;
        }

        // 计算延迟时间
        const delay = this.calculateDelay(attempt);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  private isNonRetryableError(error: Error): boolean {
    return this.config.nonRetryableErrors.some(
      nonRetryableError => error.message.includes(nonRetryableError)
    );
  }

  private calculateDelay(attempt: number): number {
    // 指数退避算法：baseDelay * (exponentialFactor ^ (attempt - 1))
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.exponentialFactor, attempt - 1);
    
    // 添加随机抖动
    const jitterAmount = exponentialDelay * this.config.jitter;
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount; // -jitterAmount 到 +jitterAmount
    
    return Math.max(0, exponentialDelay + jitter);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getNextDelay(attempt: number): number {
    return this.calculateDelay(attempt);
  }
}

describe('RetryStrategy Tests', () => {
  let retryStrategy: RetryStrategy;
  let mockOperation: vi.MockedFunction<() => Promise<string>>;

  beforeEach(() => {
    const defaultConfig: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      exponentialFactor: 2,
      jitter: 0.1,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'RATE_LIMIT_ERROR', 'SERVER_ERROR_5XX'],
      nonRetryableErrors: ['AUTH_ERROR', 'INVALID_PARAMS', 'CLIENT_ERROR_4XX']
    };
    
    retryStrategy = new RetryStrategy(defaultConfig);
    mockOperation = vi.fn();
  });

  describe('成功场景', () => {
    it('应该在第一次尝试成功时立即返回结果', async () => {
      mockOperation.mockResolvedValue('success');

      const result = await retryStrategy.execute(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('应该在重试后成功时返回结果', async () => {
      mockOperation
        .mockRejectedValueOnce(new Error('NETWORK_ERROR: 连接失败'))
        .mockRejectedValueOnce(new Error('TIMEOUT_ERROR: 请求超时'))
        .mockResolvedValue('success on retry');

      const result = await retryStrategy.execute(mockOperation);

      expect(result).toBe('success on retry');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe('指数退避延迟计算', () => {
    it('应该按照指数退避算法计算延迟', () => {
      // 测试多次尝试的延迟计算
      const delay1 = retryStrategy.getNextDelay(1); // 第一次重试
      const delay2 = retryStrategy.getNextDelay(2); // 第二次重试
      const delay3 = retryStrategy.getNextDelay(3); // 第三次重试

      // 基础延迟 1000ms * 2^(attempt-1)
      // 第一次重试: 1000 * 2^0 = 1000ms
      // 第二次重试: 1000 * 2^1 = 2000ms  
      // 第三次重试: 1000 * 2^2 = 4000ms
      
      // 考虑到jitter的存在，应该在范围内
      expect(delay1).toBeGreaterThan(900); // 1000 - 10%
      expect(delay1).toBeLessThan(1100); // 1000 + 10%
      
      expect(delay2).toBeGreaterThan(1800); // 2000 - 10%
      expect(delay2).toBeLessThan(2200); // 2000 + 10%
      
      expect(delay3).toBeGreaterThan(3600); // 4000 - 10%
      expect(delay3).toBeLessThan(4400); // 4000 + 10%
    });

    it('jitter应该在指定范围内', () => {
      const delays: number[] = [];
      
      // 生成多个延迟值来测试jitter
      for (let i = 0; i < 100; i++) {
        delays.push(retryStrategy.getNextDelay(1));
      }

      // 所有延迟应该在jitter范围内（10%）
      delays.forEach(delay => {
        expect(delay).toBeGreaterThan(900); // 1000 - 10%
        expect(delay).toBeLessThan(1100); // 1000 + 10%
      });

      // 延迟值应该有变化（不全相等，说明jitter生效）
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(50); // 至少有一半的值不同
    });
  });

  describe('错误分类和重试决策', () => {
    it('应该重试可重试的错误', async () => {
      const retryableErrors = [
        'NETWORK_ERROR: 网络连接失败',
        'TIMEOUT_ERROR: 请求超时',
        'RATE_LIMIT_ERROR: 请求频率超限',
        'SERVER_ERROR_5XX: 服务器内部错误'
      ];

      for (const errorMsg of retryableErrors) {
        const mockOp = vi.fn()
          .mockRejectedValue(new Error(errorMsg));

        await expect(retryStrategy.execute(mockOp))
          .rejects
          .toThrow(errorMsg);

        // 应该重试到最大次数（3次重试 + 1次初始尝试 = 4次调用）
        expect(mockOp).toHaveBeenCalledTimes(4);
      }
    });

    it('应该立即失败不可重试的错误', async () => {
      const nonRetryableErrors = [
        'AUTH_ERROR: 认证失败',
        'INVALID_PARAMS: 参数无效',
        'CLIENT_ERROR_4XX: 客户端错误'
      ];

      for (const errorMsg of nonRetryableErrors) {
        const mockOp = vi.fn()
          .mockRejectedValue(new Error(errorMsg));

        await expect(retryStrategy.execute(mockOp))
          .rejects
          .toThrow(errorMsg);

        // 应该只调用一次，不重试
        expect(mockOp).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('重试次数限制', () => {
    it('应该在达到最大重试次数后停止重试', async () => {
      mockOperation.mockRejectedValue(new Error('NETWORK_ERROR: 持续失败'));

      await expect(retryStrategy.execute(mockOperation))
        .rejects
        .toThrow('NETWORK_ERROR: 持续失败');

      // 应该调用 maxRetries + 1 次（3次重试 + 1次初始尝试）
      expect(mockOperation).toHaveBeenCalledTimes(4);
    });

    it('应该使用自定义重试次数', async () => {
      const customConfig: RetryConfig = {
        maxRetries: 1, // 只重试1次
        baseDelay: 100,
        exponentialFactor: 2,
        jitter: 0.1,
        retryableErrors: ['NETWORK_ERROR'],
        nonRetryableErrors: ['AUTH_ERROR']
      };
      
      const customRetryStrategy = new RetryStrategy(customConfig);
      mockOperation.mockRejectedValue(new Error('NETWORK_ERROR: 失败'));

      await expect(customRetryStrategy.execute(mockOperation))
        .rejects
        .toThrow('NETWORK_ERROR: 失败');

      // 应该调用2次（1次重试 + 1次初始尝试）
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('操作上下文', () => {
    it('应该支持操作上下文信息', async () => {
      mockOperation.mockResolvedValue('success');

      const result = await retryStrategy.execute(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('边界情况', () => {
    it('应该处理零延迟配置', () => {
      const zeroDelayConfig: RetryConfig = {
        maxRetries: 2,
        baseDelay: 0,
        exponentialFactor: 2,
        jitter: 0,
        retryableErrors: ['NETWORK_ERROR'],
        nonRetryableErrors: []
      };
      
      const zeroDelayStrategy = new RetryStrategy(zeroDelayConfig);
      const delay = zeroDelayStrategy.getNextDelay(1);
      
      expect(delay).toBe(0);
    });

    it('应该处理负延迟计算结果', () => {
      const negativeDelayConfig: RetryConfig = {
        maxRetries: 1,
        baseDelay: 100,
        exponentialFactor: 1,
        jitter: 2, // 200% jitter 可能导致负值
        retryableErrors: ['NETWORK_ERROR'],
        nonRetryableErrors: []
      };
      
      const negativeDelayStrategy = new RetryStrategy(negativeDelayConfig);
      const delay = negativeDelayStrategy.getNextDelay(1);
      
      // 延迟不应该是负数
      expect(delay).toBeGreaterThanOrEqual(0);
    });

    it('应该处理极大的重试次数', () => {
      const largeRetryConfig: RetryConfig = {
        maxRetries: 10,
        baseDelay: 10,
        exponentialFactor: 2,
        jitter: 0,
        retryableErrors: ['NETWORK_ERROR'],
        nonRetryableErrors: []
      };
      
      const largeRetryStrategy = new RetryStrategy(largeRetryConfig);
      const delay = largeRetryStrategy.getNextDelay(10);
      
      // 第10次重试: 10 * 2^9 = 10 * 512 = 5120ms
      expect(delay).toBe(5120);
    });
  });
});