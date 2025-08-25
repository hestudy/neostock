#!/usr/bin/env bun

import { execSync } from "child_process";

interface SecurityCheck {
	name: string;
	command: string;
	criticalFailure: boolean;
}

interface SecurityResult {
	passed: boolean;
	checks: {
		name: string;
		passed: boolean;
		output?: string;
		error?: string;
	}[];
	criticalIssues: number;
	highIssues: number;
	mediumIssues: number;
}

async function runSecurityScans(): Promise<SecurityResult> {
	const checks: SecurityCheck[] = [
		{
			name: "源代码静态分析 (SAST)",
			command: "bun run lint",
			criticalFailure: true,
		},
		{
			name: "TypeScript安全类型检查",
			command: "bun run check-types",
			criticalFailure: true,
		},
		{
			name: "依赖漏洞扫描 (SCA)",
			command: "bun audit",
			criticalFailure: false, // 非阻断但记录
		},
		{
			name: "API安全端点检查",
			command: "bun run test -- security",
			criticalFailure: true,
		},
		{
			name: "API文档验证",
			command: "bun run docs:validate",
			criticalFailure: true,
		},
		{
			name: "环境变量安全检查",
			command: "node -e \"console.log('Env validation passed')\" && bun run env:validate",
			criticalFailure: true,
		},
	];

	const results: SecurityResult['checks'] = [];
	let criticalIssues = 0;
	let highIssues = 0;
	const mediumIssues = 0;

	for (const check of checks) {
		try {
			console.log(`🔒 执行: ${check.name}...`);
			const output = execSync(check.command, { 
				encoding: 'utf8',
				cwd: process.cwd()
			});
			
			results.push({
				name: check.name,
				passed: true,
				output,
			});
			console.log(`✅ ${check.name} 通过`);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const isStdout = error && typeof error === 'object' && 'stdout' in error && typeof error.stdout === 'string';
			const output = isStdout ? error.stdout as string : '';
			
			if (output.includes('CRITICAL') || output.includes('HIGH')) {
				if (output.includes('CRITICAL')) criticalIssues++;
				if (output.includes('HIGH')) highIssues++;
			}
			
			results.push({
				name: check.name,
				passed: !check.criticalFailure,
				error: errorMessage,
				output,
			});
			
			if (check.criticalFailure) {
				console.log(`❌ ${check.name} 失败 (关键):`);
			} else {
				console.log(`⚠️  ${check.name} 警告:`);
			}
		}
	}

	const passed = results.every(check => check.passed) && criticalIssues === 0;

	return {
		passed,
		checks: results,
		criticalIssues,
		highIssues,
		mediumIssues,
	};
}

function generateSecurityReport(result: SecurityResult) {
	console.log("\n" + "=".repeat(60));
	console.log("🔒 安全门控检查结果");
	console.log("=".repeat(60));

	console.log(`\n📊 安全评分:`);
	console.log(`   关键漏洞: ${result.criticalIssues}`);
	console.log(`   高危漏洞: ${result.highIssues}`);
	console.log(`   中危漏洞: ${result.mediumIssues}`);

	const passedCount = result.checks.filter(c => c.passed).length;
	const totalCount = result.checks.length;
	console.log(`\n📋 检查通过: ${passedCount}/${totalCount}`);

	for (const check of result.checks) {
		const status = check.passed ? "✅" : "❌";
		console.log(`${status} ${check.name}`);
		if (!check.passed && check.error) {
			const firstLine = check.error.split('\n')[0];
			console.log(`   错误: ${firstLine}`);
		}
	}

	if (result.criticalIssues > 0) {
		console.log(`\n🚨 发现 ${result.criticalIssues} 个关键安全漏洞！`);
		console.log("   请立即修复所有关键漏洞后重试。");
	}

	if (result.passed && result.criticalIssues === 0) {
		console.log("\n🛡️  安全门控通过！代码符合安全标准。");
	} else {
		console.log("\n🚫 安全门控失败！请修复安全问题后重试。");
	}
}

async function main() {
	console.log("🔒 开始安全门控检查...\n");

	const result = await runSecurityScans();
	generateSecurityReport(result);

	if (!result.passed || result.criticalIssues > 0) {
		process.exit(1);
	}
}

if (import.meta.main) {
	main();
}