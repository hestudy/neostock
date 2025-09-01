import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { z } from "zod";
import { performanceRouter } from "./performance";
import { dataSourcesRouter } from "./data-sources";
import { stocksRouter } from "./stocks";
import { healthRouter } from "./health";

export const appRouter = router({
	healthCheck: publicProcedure
		.meta({ 
			openapi: { 
				method: 'GET', 
				path: '/health-check',
				summary: 'Basic health check endpoint',
				description: 'Returns OK to indicate the service is running',
				tags: ['Health'],
				protect: false
			} 
		})
		.input(z.void())
		.output(z.string())
		.query(() => {
			return "OK";
		}),
	
	// 详细的数据库健康检查端点（已移至 health 路由器中，避免重复定义）
	privateData: protectedProcedure
		.meta({ 
			openapi: { 
				method: 'GET', 
				path: '/private-data',
				summary: 'Get private user data',
				description: 'Returns private data for authenticated users',
				tags: ['Auth', 'User'],
				protect: true
			} 
		})
		.input(z.void())
		.output(z.object({
			message: z.string(),
			user: z.object({
				id: z.string(),
				name: z.string(),
				email: z.string(),
			}),
		}))
		.query(({ ctx }) => {
			return {
				message: "This is private",
				user: ctx.session.user,
			};
		}),
	// Performance monitoring routes
	performance: performanceRouter,
	// Data sources management routes  
	dataSources: dataSourcesRouter,
	// Stock data management routes
	stocks: stocksRouter,
	// Enhanced health check routes
	health: healthRouter,
});
export type AppRouter = typeof appRouter;
