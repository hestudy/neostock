import { TRPCError } from "@trpc/server";

// 数据库错误类型
interface DatabaseError extends Error {
  code?: string;
  errno?: number;
}

// 重试配置选项
interface RetryOptions {
  maxRetries: number;
  baseDelay: number; // 基础延迟时间（毫秒）
  maxDelay: number;  // 最大延迟时间（毫秒）
  retryableErrorCodes?: string[];
}

// 默认重试配置
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 100,
  maxDelay: 2000,
  retryableErrorCodes: [
    'SQLITE_BUSY',
    'SQLITE_LOCKED', 
    'SQLITE_PROTOCOL',
    'CONNECTION_REFUSED',
    'TIMEOUT',
    'NETWORK_ERROR'
  ]
};

// 指数退避延迟计算
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // 添加50%随机抖动
  return Math.min(jitteredDelay, maxDelay);
}

// 检查错误是否可重试
function isRetryableError(error: DatabaseError, retryableErrorCodes: string[]): boolean {
  // 检查错误码
  if (error.code && retryableErrorCodes.includes(error.code)) {
    return true;
  }
  
  // 检查错误消息中的关键词
  const errorMessage = error.message.toLowerCase();
  const retryableMessages = ['busy', 'locked', 'timeout', 'connection', 'network'];
  
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

// 异步延迟函数
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 数据库操作重试包装器
 * 使用指数退避算法处理临时数据库故障
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: DatabaseError | null = null;
  
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      // 执行数据库操作
      const result = await operation();
      
      // 如果成功且之前有重试，记录成功日志
      if (attempt > 1) {
        console.log(`Database operation succeeded after ${attempt - 1} retries`);
      }
      
      return result;
    } catch (error) {
      lastError = error as DatabaseError;
      
      // 如果这是最后一次尝试，抛出错误
      if (attempt > config.maxRetries) {
        console.error(`Database operation failed after ${config.maxRetries} retries:`, lastError);
        
        // 包装为 tRPC 错误
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database operation failed after retries',
          cause: lastError
        });
      }
      
      // 检查是否为可重试的错误
      if (!isRetryableError(lastError, config.retryableErrorCodes!)) {
        console.error('Non-retryable database error:', lastError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Database operation failed',
          cause: lastError
        });
      }
      
      // 计算延迟时间并等待
      const delay = calculateDelay(attempt, config.baseDelay, config.maxDelay);
      console.warn(`Database operation failed (attempt ${attempt}/${config.maxRetries}), retrying in ${delay}ms:`, lastError.message);
      
      await sleep(delay);
    }
  }
  
  // 这里应该永远不会执行到，但为了类型安全
  throw lastError || new Error('Unexpected error in database retry logic');
}

/**
 * 批量操作的重试包装器
 * 用于处理大量数据插入等批量操作
 */
export async function withBatchDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  // 批量操作使用更长的延迟和更多重试次数
  const batchConfig: Partial<RetryOptions> = {
    maxRetries: 5,
    baseDelay: 200,
    maxDelay: 5000,
    ...options
  };
  
  return withDatabaseRetry(operation, batchConfig);
}

/**
 * 事务操作的重试包装器
 * 用于处理需要事务一致性的操作
 */
export async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  // 事务操作使用较少的重试次数但较快的重试
  const transactionConfig: Partial<RetryOptions> = {
    maxRetries: 3,
    baseDelay: 50,
    maxDelay: 1000,
    ...options
  };
  
  return withDatabaseRetry(operation, transactionConfig);
}