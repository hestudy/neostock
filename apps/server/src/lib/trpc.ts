import { initTRPC, TRPCError } from "@trpc/server";
import type { OpenApiMeta } from "trpc-to-openapi";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().meta<OpenApiMeta>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});

// 内存存储的速率限制计数器（生产环境建议使用Redis）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// 速率限制中间件
export const rateLimitMiddleware = (windowMs: number, maxRequests: number) =>
  t.middleware(async ({ ctx, next }) => {
    const clientId = ctx.clientIP || 'unknown';
    const now = Date.now();
    const key = clientId;
    
    // 获取或初始化计数器
    let counter = rateLimitStore.get(key);
    
    // 如果计数器不存在或者时间窗口已过期，重置计数器
    if (!counter || now > counter.resetTime) {
      counter = { count: 0, resetTime: now + windowMs };
    }
    
    // 增加请求计数
    counter.count++;
    rateLimitStore.set(key, counter);
    
    // 检查是否超出速率限制
    if (counter.count > maxRequests) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs/1000} seconds.`,
      });
    }
    
    return next({ ctx });
  });

// 搜索专用的速率限制（每分钟120次）
export const searchRateLimitedProcedure = publicProcedure.use(rateLimitMiddleware(60 * 1000, 120));

// 收藏操作专用的速率限制（每分钟30次）
export const favoriteRateLimitedProcedure = protectedProcedure.use(rateLimitMiddleware(60 * 1000, 30));

// 列表查询速率限制（每分钟60次）
export const listRateLimitedProcedure = publicProcedure.use(rateLimitMiddleware(60 * 1000, 60));

export const createCallerFactory = t.createCallerFactory;
export type { Context };
