import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { z } from "zod";
import { performanceRouter } from "./performance";

export const appRouter = router({
	healthCheck: publicProcedure
		.meta({ 
			openapi: { 
				method: 'GET', 
				path: '/health-check',
				summary: 'Health check endpoint',
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
});
export type AppRouter = typeof appRouter;
