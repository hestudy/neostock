import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { rateLimitMiddleware, createCallerFactory, t } from '../../lib/trpc';
const router = t.router;

// 构建一个带速率限制的简单路由，用于验证中间件
const testRouter = router({
  ping: t.procedure
    .use(rateLimitMiddleware(1000, 2)) // 1秒内最多2次
    .input(z.void())
    .output(z.string())
    .query(() => 'pong'),
});

const createCaller = createCallerFactory(testRouter);

describe('RateLimit Middleware', () => {
  it('should allow requests within the limit and block when exceeded', async () => {
    const caller = createCaller({ clientIP: '127.0.0.1', session: null } as any);

    // 前两次应通过
    await expect(caller.ping()).resolves.toBe('pong');
    await expect(caller.ping()).resolves.toBe('pong');

    // 第三次应被限流，校验错误code
    try {
      await caller.ping();
      throw new Error('Expected rate limit to trigger');
    } catch (e) {
      const err = e as TRPCError;
      expect(err.code).toBe('TOO_MANY_REQUESTS');
    }
  });
});
