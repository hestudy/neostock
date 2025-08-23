#!/usr/bin/env bun

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface ApiChange {
	type: 'added' | 'modified' | 'removed';
	procedure: string;
	file: string;
}

function getModifiedTrpcFiles(): string[] {
	try {
		const result = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' });
		return result
			.split('\n')
			.filter(file => file.trim())
			.filter(file => 
				file.includes('routers/') || 
				file.includes('trpc') ||
				file.endsWith('.ts') && !file.includes('test')
			);
	} catch {
		console.log("⚠️  无法获取git差异，使用当前工作目录状态");
		return [];
	}
}

function extractProceduresFromFile(filePath: string): string[] {
	try {
		const content = fs.readFileSync(filePath, 'utf8');
		const procedures: string[] = [];
		
		const procedureRegex = /(\w+):\s*[a-zA-Z]+Procedure/g;
		let match;
		
		while ((match = procedureRegex.exec(content)) !== null) {
			procedures.push(match[1]);
		}
		
		return procedures;
	} catch {
		return [];
	}
}

function analyzeApiChanges(): ApiChange[] {
	const changes: ApiChange[] = [];
	const modifiedFiles = getModifiedTrpcFiles();
	
	console.log(`📁 检查到 ${modifiedFiles.length} 个可能包含API变更的文件`);
	
	for (const file of modifiedFiles) {
		const fullPath = path.resolve(file);
		if (fs.existsSync(fullPath)) {
			const procedures = extractProceduresFromFile(fullPath);
			console.log(`   ${file}: 发现 ${procedures.length} 个过程`);
			
			for (const procedure of procedures) {
				changes.push({
					type: 'modified',
					procedure,
					file
				});
			}
		}
	}
	
	return changes;
}

function generateDocumentationUpdateReminder(changes: ApiChange[]): string {
	if (changes.length === 0) {
		return "✅ 没有检测到API变更";
	}
	
	let reminder = "📚 检测到API变更，请验证文档更新：\n\n";
	
	const groupedChanges = changes.reduce((acc, change) => {
		if (!acc[change.file]) acc[change.file] = [];
		acc[change.file].push(change);
		return acc;
	}, {} as Record<string, ApiChange[]>);
	
	for (const [file, fileChanges] of Object.entries(groupedChanges)) {
		reminder += `📄 ${file}:\n`;
		for (const change of fileChanges) {
			reminder += `   - ${change.type}: ${change.procedure}\n`;
		}
		reminder += "\n";
	}
	
	reminder += "🔧 验证步骤：\n";
	reminder += "   1. 运行 `bun run docs:validate` 检查文档覆盖率\n";
	reminder += "   2. 访问 http://localhost:3000/api/docs 查看生成的文档\n";
	reminder += "   3. 确认新端点的OpenAPI元数据正确\n";
	
	return reminder;
}

function main() {
	console.log("🔍 检查API变更...");
	
	const changes = analyzeApiChanges();
	const reminder = generateDocumentationUpdateReminder(changes);
	
	console.log(reminder);
	
	if (changes.length > 0) {
		console.log("\n⚠️  建议运行文档验证：bun run docs:validate");
		console.log("⚠️  请确保更新相关的OpenAPI元数据");
	}
}

if (import.meta.main) {
	main();
}