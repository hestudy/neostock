import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { z } from "zod";
import { performanceRouter } from "./performance";
import { databaseHealthChecker } from "../lib/database-health";
import { dataSourcesRouter } from "./data-sources";

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
	
	// 详细的数据库健康检查端点
	databaseHealth: publicProcedure
		.meta({ 
			openapi: { 
				method: 'GET', 
				path: '/health/database',
				summary: 'Database health check endpoint',
				description: 'Returns detailed database health status including connectivity, performance, and configuration',
				tags: ['Health', 'Database'],
				protect: false
			} 
		})
		.input(z.void())
		.output(z.object({
			status: z.enum(['pass', 'warn', 'fail']),
			responseTime: z.number(),
			message: z.string(),
			timestamp: z.string(),
			details: z.object({
				connectivity: z.object({
					status: z.enum(['pass', 'fail']),
					responseTime: z.number()
				}),
				pragmaConfig: z.object({
					status: z.enum(['pass', 'warn', 'fail']),
					settings: z.record(z.string(), z.union([z.string(), z.number()])),
					issues: z.array(z.string())
				}),
				connectionPool: z.object({
					status: z.enum(['pass', 'warn', 'fail']),
					active: z.number(),
					max: z.number(),
					utilization: z.number()
				}),
				performance: z.object({
					status: z.enum(['pass', 'warn', 'fail']),
					averageQueryTime: z.number(),
					slowQueries: z.number()
				}),
				diskSpace: z.object({
					status: z.enum(['pass', 'warn', 'fail']),
					info: z.string()
				})
			})
		}))
		.query(async () => {
			const healthResult = await databaseHealthChecker.performHealthCheck();
			return {
				...healthResult,
				timestamp: new Date().toISOString()
			};
		}),
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
});
export type AppRouter = typeof appRouter;
