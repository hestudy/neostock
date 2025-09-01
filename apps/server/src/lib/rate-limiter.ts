import type { Context, MiddlewareHandler } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';

// 创建搜索接口专用的速率限制配置
export const searchRateLimiter: MiddlewareHandler = rateLimiter({
  windowMs: 60 * 1000, // 1分钟窗口期
  limit: 120, // 每分钟最多120次请求（平均每500ms一次，满足<100ms响应要求）
  standardHeaders: 'draft-6',
  message: {
    error: 'Too many search requests, please try again later',
    message: '搜索请求过于频繁，请稍后再试'
  },
  // 使用IP地址作为key
  keyGenerator: (c: Context) => {
    return c.env?.CF_CONNECTING_IP || 
           c.req.header('x-forwarded-for')?.split(',')[0] || 
           c.env?.REMOTE_ADDR || 
           'unknown';
  }
});

// 创建一般API接口的速率限制配置
export const generalRateLimiter: MiddlewareHandler = rateLimiter({
  windowMs: 60 * 1000, // 1分钟窗口期
  limit: 200, // 每分钟最多200次请求
  standardHeaders: 'draft-6',
  message: {
    error: 'Too many requests, please try again later',
    message: 'API请求过于频繁，请稍后再试'
  },
  keyGenerator: (c: Context) => {
    return c.env?.CF_CONNECTING_IP || 
           c.req.header('x-forwarded-for')?.split(',')[0] || 
           c.env?.REMOTE_ADDR || 
           'unknown';
  }
});

// 收藏功能的速率限制（更严格，防止恶意操作）
export const favoriteRateLimiter: MiddlewareHandler = rateLimiter({
  windowMs: 60 * 1000, // 1分钟窗口期
  limit: 30, // 每分钟最多30次收藏操作
  standardHeaders: 'draft-6', 
  message: {
    error: 'Too many favorite operations, please try again later',
    message: '收藏操作过于频繁，请稍后再试'
  },
  keyGenerator: (c: Context) => {
    // 对于认证用户，使用用户ID；否则使用IP
    const userId = c.get('user')?.id;
    return userId || 
           c.env?.CF_CONNECTING_IP || 
           c.req.header('x-forwarded-for')?.split(',')[0] || 
           c.env?.REMOTE_ADDR || 
           'unknown';
  }
});