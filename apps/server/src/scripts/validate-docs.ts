#!/usr/bin/env bun

import { appRouter } from "../routers/index";
import { openApiDocument } from "../openapi/handler";

interface ValidationResult {
	success: boolean;
	errors: string[];
	coverage: {
		total: number;
		documented: number;
		percentage: number;
	};
}

function extractTrpcProcedures() {
	const procedures = new Set<string>();
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const routerDef = (appRouter as any)._def;
	
	if (routerDef?.procedures) {
		for (const key of Object.keys(routerDef.procedures)) {
			procedures.add(key);
		}
	}
	
	return Array.from(procedures);
}

function extractOpenApiEndpoints() {
	const endpoints = new Set<string>();
	
	if (openApiDocument.paths) {
		for (const path of Object.keys(openApiDocument.paths)) {
			const pathItem = openApiDocument.paths[path];
			if (pathItem) {
				for (const method of Object.keys(pathItem)) {
					if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
						const operation = pathItem[method as keyof typeof pathItem];
						if (operation && 'operationId' in operation) {
							endpoints.add(operation.operationId as string);
						}
					}
				}
			}
		}
	}
	
	return Array.from(endpoints);
}

function validateDocumentation(): ValidationResult {
	const errors: string[] = [];
	const trpcProcedures = extractTrpcProcedures();
	const openApiEndpoints = extractOpenApiEndpoints();
	
	console.log(`发现 ${trpcProcedures.length} 个 tRPC 过程`);
	console.log(`发现 ${openApiEndpoints.length} 个 OpenAPI 端点`);
	
	const undocumentedProcedures = trpcProcedures.filter(
		proc => !openApiEndpoints.includes(proc)
	);
	
	if (undocumentedProcedures.length > 0) {
		errors.push(`未文档化的过程: ${undocumentedProcedures.join(', ')}`);
	}
	
	const extraEndpoints = openApiEndpoints.filter(
		endpoint => !trpcProcedures.includes(endpoint)
	);
	
	if (extraEndpoints.length > 0) {
		errors.push(`多余的文档端点: ${extraEndpoints.join(', ')}`);
	}
	
	const documented = trpcProcedures.length - undocumentedProcedures.length;
	const coverage = {
		total: trpcProcedures.length,
		documented,
		percentage: trpcProcedures.length > 0 ? (documented / trpcProcedures.length) * 100 : 0
	};
	
	return {
		success: errors.length === 0,
		errors,
		coverage
	};
}

function main() {
	console.log("🔍 验证API文档...");
	
	const result = validateDocumentation();
	
	console.log(`\n📊 文档覆盖率: ${result.coverage.percentage.toFixed(1)}%`);
	console.log(`   总过程数: ${result.coverage.total}`);
	console.log(`   已文档化: ${result.coverage.documented}`);
	
	if (result.success) {
		console.log("\n✅ 文档验证通过！");
	} else {
		console.log("\n❌ 文档验证失败：");
		result.errors.forEach(error => console.log(`   - ${error}`));
	}
	
	if (result.coverage.percentage < 95) {
		console.log(`\n⚠️  文档覆盖率 ${result.coverage.percentage.toFixed(1)}% 低于目标 95%`);
		process.exit(1);
	}
	
	if (!result.success) {
		process.exit(1);
	}
	
	console.log("\n🎉 文档验证完成！");
}

if (import.meta.main) {
	main();
}