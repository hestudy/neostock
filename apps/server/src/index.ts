import "dotenv/config";
import { validateEnv } from "./lib/env";
import { trpcServer } from "@hono/trpc-server";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";
import { auth } from "./lib/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { handleOpenApiRequest, openApiDocument } from "./openapi/handler";
import { performanceMiddleware } from "./lib/performance-middleware";

// Validate environment variables at startup
validateEnv();

const app = new Hono();

app.use(logger());
app.use("/*", performanceMiddleware());
app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

app.get("/", (c) => {
	return c.text("OK");
});

app.get("/api/openapi.json", (c) => {
	return c.json(openApiDocument);
});

app.get("/api/docs", (c) => {
	const html = `
<!DOCTYPE html>
<html>
<head>
	<title>NeoStock API Documentation</title>
	<link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
	<script>
		const ui = SwaggerUIBundle({
			url: '/api/openapi.json',
			dom_id: '#swagger-ui',
			presets: [
				SwaggerUIBundle.presets.apis,
				SwaggerUIBundle.presets.standalone
			],
			layout: 'StandaloneLayout'
		});
	</script>
</body>
</html>`;
	return c.html(html);
});

app.all("/api/health-check", handleOpenApiRequest);
app.all("/api/private-data", handleOpenApiRequest);
// Performance monitoring API endpoints
app.all("/api/performance.metrics", handleOpenApiRequest);
app.all("/api/performance.benchmarks", handleOpenApiRequest);
app.all("/api/performance.history", handleOpenApiRequest);
app.all("/api/performance.alerts", handleOpenApiRequest);

export default app;
