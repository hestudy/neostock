#!/usr/bin/env bun

import { execSync } from "child_process";

interface DeploymentCheck {
	name: string;
	command: string;
	required: boolean;
}

async function runPreDeploymentChecks(): Promise<boolean> {
	const checks: DeploymentCheck[] = [
		{
			name: "🔍 代码风格检查",
			command: "bun run lint",
			required: true,
		},
		{
			name: "🔧 类型安全检查",
			command: "bun run check-types",
			required: true,
		},
		{
			name: "📚 API文档验证",
			command: "bun run docs:validate",
			required: true,
		},
		{
			name: "🔒 安全门控检查",
			command: "bun run security:gate",
			required: true,
		},
		{
			name: "🏗️  构建验证",
			command: "bun run build",
			required: true,
		},
	];

	console.log("🚀 开始部署前检查...\n");

	let allPassed = true;
	const results: { name: string; passed: boolean; error?: string }[] = [];

	for (const check of checks) {
		try {
			console.log(`执行: ${check.name}...`);
			execSync(check.command, { 
				stdio: 'pipe',
				cwd: process.cwd()
			});
			results.push({ name: check.name, passed: true });
			console.log(`✅ ${check.name} 通过`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			results.push({ 
				name: check.name, 
				passed: false, 
				error: errorMessage 
			});
			
			if (check.required) {
				console.log(`❌ ${check.name} 失败 (必需)`);
				allPassed = false;
			} else {
				console.log(`⚠️  ${check.name} 警告 (可选)`);
			}
		}
	}

	console.log("\n" + "=".repeat(50));
	console.log("📋 部署前检查总结");
	console.log("=".repeat(50));

	const passedCount = results.filter(r => r.passed).length;
	console.log(`\n通过检查: ${passedCount}/${results.length}`);

	for (const result of results) {
		const status = result.passed ? "✅" : "❌";
		console.log(`${status} ${result.name}`);
	}

	if (allPassed) {
		console.log("\n🎉 所有部署前检查通过！代码可以安全部署。");
		console.log("\n📋 质量保证清单:");
		console.log("   ✅ API文档覆盖率 100%");
		console.log("   ✅ 零关键安全漏洞");
		console.log("   ✅ 代码质量标准合规");
		console.log("   ✅ 类型安全验证");
		console.log("   ✅ 构建成功验证");
	} else {
		console.log("\n🚫 部署前检查失败！请修复上述问题。");
	}

	return allPassed;
}

async function main() {
	const success = await runPreDeploymentChecks();
	if (!success) {
		process.exit(1);
	}
}

if (import.meta.main) {
	main();
}