#!/usr/bin/env bun

import { execSync } from "child_process";

interface QualityGateResult {
	passed: boolean;
	checks: {
		name: string;
		passed: boolean;
		error?: string;
	}[];
}

async function runQualityChecks(): Promise<QualityGateResult> {
	const checks = [
		{
			name: "代码检查 (Lint)",
			command: "bun run lint",
		},
		{
			name: "类型检查 (TypeScript)",
			command: "bun run check-types",
		},
		{
			name: "单元测试",
			command: "bun run test",
		},
		{
			name: "API文档验证",
			command: "bun run docs:validate",
		},
	];

	const results: QualityGateResult['checks'] = [];

	for (const check of checks) {
		try {
			console.log(`🔍 执行: ${check.name}...`);
			execSync(check.command, { 
				stdio: 'pipe',
				cwd: process.cwd()
			});
			results.push({
				name: check.name,
				passed: true,
			});
			console.log(`✅ ${check.name} 通过`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			results.push({
				name: check.name,
				passed: false,
				error: errorMessage,
			});
			console.log(`❌ ${check.name} 失败: ${errorMessage}`);
		}
	}

	const passed = results.every(check => check.passed);

	return {
		passed,
		checks: results,
	};
}

function reportResults(result: QualityGateResult) {
	console.log("\n" + "=".repeat(50));
	console.log("🚪 质量门控检查结果");
	console.log("=".repeat(50));

	const passedCount = result.checks.filter(c => c.passed).length;
	const totalCount = result.checks.length;

	console.log(`\n📊 总览: ${passedCount}/${totalCount} 检查通过`);

	for (const check of result.checks) {
		const status = check.passed ? "✅" : "❌";
		console.log(`${status} ${check.name}`);
		if (!check.passed && check.error) {
			console.log(`   错误: ${check.error.split('\n')[0]}`);
		}
	}

	if (result.passed) {
		console.log("\n🎉 质量门控通过！代码可以合并。");
	} else {
		console.log("\n🚫 质量门控失败！请修复上述问题后重试。");
	}
}

async function main() {
	console.log("🚪 开始质量门控检查...\n");

	const result = await runQualityChecks();
	reportResults(result);

	if (!result.passed) {
		process.exit(1);
	}
}

if (import.meta.main) {
	main();
}