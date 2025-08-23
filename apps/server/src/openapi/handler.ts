import type { Context as HonoContext } from "hono";
import { appRouter } from "../routers/index";
import { createContext } from "../lib/context";
import { generateOpenApiDocument } from "trpc-to-openapi";

export async function handleOpenApiRequest(c: HonoContext) {
	const path = c.req.path.replace('/api', '');
	const method = c.req.method;
	
	const ctx = await createContext({ context: c });
	
	try {
		const caller = appRouter.createCaller(ctx);
		
		if (path === '/health-check' && method === 'GET') {
			const result = await caller.healthCheck();
			return c.json({ greeting: result });
		}
		
		if (path === '/private-data' && method === 'GET') {
			const result = await caller.privateData();
			return c.json(result);
		}
		
		return c.json({ error: "Endpoint not found" }, 404);
	} catch (error) {
		if (error instanceof Error) {
			return c.json({ error: error.message }, 500);
		}
		return c.json({ error: "Internal server error" }, 500);
	}
}

export const openApiDocument = generateOpenApiDocument(appRouter, {
	title: "NeoStock API",
	description: "NeoStock API documentation generated from tRPC procedures",
	version: "1.0.0",
	baseUrl: process.env.NODE_ENV === "production" 
		? "https://api.neostock.app" 
		: "http://localhost:3000",
	tags: ["Health", "Auth", "User", "Data"],
	securitySchemes: {
		bearerAuth: {
			type: "http",
			scheme: "bearer",
			bearerFormat: "JWT",
		},
	},
});