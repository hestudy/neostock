#!/usr/bin/env bun

import { spawn } from "child_process";

interface QualityCheck {
	name: string;
	command: string;
	parallel: boolean;
}

interface QualityCheckResult {
	name: string;
	passed: boolean;
	error?: string;
	duration: number;
}

interface QualityGateResult {
	passed: boolean;
	checks: QualityCheckResult[];
	totalDuration: number;
}

async function executeCheck(check: QualityCheck): Promise<QualityCheckResult> {
	const startTime = Date.now();
	const timeout = 300000; // 5分钟超时
	
	return new Promise((resolve) => {
		console.log(`🔍 执行: ${check.name}...`);
		
		const [command, ...args] = check.command.split(' ');
		const child = spawn(command, args, {
			cwd: process.cwd(),
			stdio: ['ignore', 'pipe', 'pipe']
		});
		
		let stdout = '';
		let stderr = '';
		// 设置超时
		const timeoutId = setTimeout(() => {
			child.kill('SIGTERM');
			const duration = Date.now() - startTime;
			console.log(`⏰ ${check.name} 超时 (${duration}ms)`);
			resolve({
				name: check.name,
				passed: false,
				error: `Command timed out after ${timeout}ms`,
				duration,
			});
		}, timeout);
		
		child.stdout?.on('data', (data) => {
			stdout += data.toString();
		});
		
		child.stderr?.on('data', (data) => {
			stderr += data.toString();
		});
		
		child.on('close', (code) => {
			clearTimeout(timeoutId);
			const duration = Date.now() - startTime;
			
			if (code === 0) {
				console.log(`✅ ${check.name} 通过 (${duration}ms)`);
				resolve({
					name: check.name,
					passed: true,
					duration,
				});
			} else {
				// 优化错误消息，只显示关键信息
				const error = extractKeyError(stderr || stdout || `Command failed with exit code ${code}`);
				console.log(`❌ ${check.name} 失败 (${duration}ms): ${error}`);
				resolve({
					name: check.name,
					passed: false,
					error,
					duration,
				});
			}
		});
		
		child.on('error', (error) => {
			clearTimeout(timeoutId);
			const duration = Date.now() - startTime;
			console.log(`❌ ${check.name} 错误 (${duration}ms): ${error.message}`);
			resolve({
				name: check.name,
				passed: false,
				error: error.message,
				duration,
			});
		});
	});
}

function extractKeyError(fullError: string): string {
	// 提取关键错误信息，避免冗长的输出
	const lines = fullError.split('\n');
	
	// 查找包含 "error" 或 "Error" 的行
	for (const line of lines) {
		if (line.toLowerCase().includes('error') && line.trim().length > 0) {
			return line.trim();
		}
	}
	
	// 如果没有找到错误行，返回前几行或原始消息的摘要
	const summary = lines.slice(0, 3).join(' ').trim();
	return summary.length > 100 ? summary.substring(0, 100) + '...' : summary;
}

async function runQualityChecks(): Promise<QualityGateResult> {
	const startTime = Date.now();
	const isCI = process.env.CI === 'true';
	
	// 将检查分为并行和顺序执行两组
	// 优化：更多检查可以并行执行
	const parallelChecks: QualityCheck[] = [
		{
			name: "代码检查 (Lint)",
			command: "bun run lint",
			parallel: true,
		},
		{
			name: "类型检查 (TypeScript)",
			command: "bun run check-types",
			parallel: true,
		},
		{
			name: "API文档验证", 
			command: "bun run docs:validate",
			parallel: true, // 文档验证可以与其他检查并行
		},
	];
	
	const sequentialChecks: QualityCheck[] = [
		{
			name: "单元测试",
			command: isCI 
				? "vitest run --reporter=basic --passWithNoTests --no-threads" // 在CI中禁用多线程避免资源争用
				: "vitest run --reporter=basic --passWithNoTests",
			parallel: false,
		},
	];

	console.log("🚀 开始并行质量检查...\n");
	
	// 并行执行可并行的检查
	const parallelResults = await Promise.all(
		parallelChecks.map(check => executeCheck(check))
	);
	
	console.log("\n📋 开始顺序质量检查...\n");
	
	// 顺序执行需要顺序的检查
	const sequentialResults: QualityCheckResult[] = [];
	for (const check of sequentialChecks) {
		const result = await executeCheck(check);
		sequentialResults.push(result);
	}
	
	const allResults = [...parallelResults, ...sequentialResults];
	const passed = allResults.every(check => check.passed);
	const totalDuration = Date.now() - startTime;

	return {
		passed,
		checks: allResults,
		totalDuration,
	};
}

function reportResults(result: QualityGateResult) {
	console.log("\n" + "=".repeat(60));
	console.log("🚪 质量门控检查结果");
	console.log("=".repeat(60));

	const passedCount = result.checks.filter(c => c.passed).length;
	const totalCount = result.checks.length;
	const totalDurationSec = (result.totalDuration / 1000).toFixed(2);

	console.log(`\n📊 总览: ${passedCount}/${totalCount} 检查通过`);
	console.log(`⏱️  总执行时间: ${totalDurationSec}s`);
	
	console.log(`\n📋 详细结果:`);
	for (const check of result.checks) {
		const status = check.passed ? "✅" : "❌";
		const duration = `(${check.duration}ms)`;
		console.log(`${status} ${check.name.padEnd(25)} ${duration}`);
		if (!check.passed && check.error) {
			console.log(`   错误: ${check.error.split('\n')[0]}`);
		}
	}

	// 性能分析
	const slowestCheck = result.checks.reduce((prev, current) => 
		(prev.duration > current.duration) ? prev : current
	);
	
	console.log(`\n⚡ 性能分析:`);
	console.log(`   最慢检查: ${slowestCheck.name} (${slowestCheck.duration}ms)`);
	
	if (result.totalDuration > 120000) { // 超过2分钟
		console.log(`   ⚠️  总执行时间超过2分钟，建议优化`);
	} else if (result.totalDuration < 90000) { // 小于90秒
		console.log(`   ✨ 执行时间良好 (<90s)`);
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