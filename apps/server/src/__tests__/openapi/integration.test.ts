import { describe, it, expect } from "bun:test";
import { openApiDocument } from "../../openapi/handler";

describe("OpenAPI Integration", () => {
	it("should generate valid OpenAPI document", () => {
		expect(openApiDocument).toBeDefined();
		expect(openApiDocument.openapi).toBe("3.1.0");
		expect(openApiDocument.info.title).toBe("NeoStock API");
	});

	it("should include all tRPC procedures as endpoints", () => {
		expect(openApiDocument.paths).toBeDefined();
		expect(openApiDocument.paths?.["/health-check"]).toBeDefined();
		expect(openApiDocument.paths?.["/private-data"]).toBeDefined();
	});

	it("should have proper security configuration", () => {
		expect(openApiDocument.components?.securitySchemes?.bearerAuth).toBeDefined();
		expect(openApiDocument.components?.securitySchemes?.bearerAuth).toEqual({
			type: "http",
			scheme: "bearer",
			bearerFormat: "JWT",
		});
	});

	it("should have proper endpoint documentation", () => {
		const healthCheck = openApiDocument.paths?.["/health-check"]?.get;
		expect(healthCheck?.summary).toBe("Health check endpoint");
		expect(healthCheck?.description).toBe("Returns OK to indicate the service is running");
		expect(healthCheck?.tags).toContain("Health");

		const privateData = openApiDocument.paths?.["/private-data"]?.get;
		expect(privateData?.summary).toBe("Get private user data");
		expect(privateData?.security).toEqual([{ bearerAuth: [] }]);
	});
});