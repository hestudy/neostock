/**
 * API文档验证系统
 * 负责 tRPC 端点与 OpenAPI 规范的同步验证
 */

import type { OpenAPIV3 } from 'openapi-types';
import { generateOpenApiDocument } from 'trpc-to-openapi';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  coverage: number;
  endpoints: {
    total: number;
    documented: number;
    undocumented: string[];
  };
  outdated: string[];
}

export interface DocumentationStats {
  totalEndpoints: number;
  documentedEndpoints: number;
  coverage: number;
  missingDocs: string[];
  outdatedDocs: string[];
  validationErrors: string[];
}

export class APIDocValidator {
  private openApiPath: string;
  private generatedOpenApiPath: string;

  constructor(
    private appRouter: unknown,
    openApiPath = 'docs/api/openapi.json',
    generatedPath = 'docs/api/generated-openapi.json'
  ) {
    this.openApiPath = resolve(process.cwd(), openApiPath);
    this.generatedOpenApiPath = resolve(process.cwd(), generatedPath);
  }

  /**
   * 验证 tRPC 端点与 OpenAPI 文档的同步性
   */
  async validateTRPCOpenAPISync(): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      issues: [],
      coverage: 0,
      endpoints: {
        total: 0,
        documented: 0,
        undocumented: [],
      },
      outdated: [],
    };

    try {
      // 生成当前的 OpenAPI 文档
      const generatedSpec = this.generateOpenApiSpec();
      
      // 读取现有的 OpenAPI 文档
      const existingSpec = this.readExistingOpenApiSpec();

      // 分析端点覆盖率
      const endpointAnalysis = this.analyzeEndpoints(generatedSpec, existingSpec);
      result.endpoints = endpointAnalysis;
      result.coverage = this.calculateCoverage(endpointAnalysis);

      // 检查同步性
      const syncIssues = this.checkSynchronization(generatedSpec, existingSpec);
      result.issues.push(...syncIssues);

      // 查找过时的文档
      const outdatedEndpoints = this.findOutdatedEndpoints(generatedSpec, existingSpec);
      result.outdated = outdatedEndpoints;

      result.valid = result.issues.length === 0 && result.coverage >= 95;

      // 保存生成的规范以供比较
      this.saveGeneratedSpec(generatedSpec);

      return result;
    } catch (error) {
      result.valid = false;
      result.issues.push(`Validation failed: ${error}`);
      return result;
    }
  }

  /**
   * 生成 OpenAPI 规范
   */
  private generateOpenApiSpec(): any {
    try {
      return generateOpenApiDocument(this.appRouter as any, {
        title: 'NeoStock API',
        description: '中国股票分析平台 API',
        version: '1.0.0',
        baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
        docsUrl: '/api/docs',
        tags: ['stocks', 'auth', 'monitoring'],
      });
    } catch (error) {
      throw new Error(`Failed to generate OpenAPI spec: ${error}`);
    }
  }

  /**
   * 读取现有的 OpenAPI 规范
   */
  private readExistingOpenApiSpec(): OpenAPIV3.Document | null {
    if (!existsSync(this.openApiPath)) {
      return null;
    }

    try {
      const content = readFileSync(this.openApiPath, 'utf-8');
      return JSON.parse(content) as OpenAPIV3.Document;
    } catch (error) {
      throw new Error(`Failed to read existing OpenAPI spec: ${error}`);
    }
  }

  /**
   * 分析端点覆盖率
   */
  private analyzeEndpoints(generated: OpenAPIV3.Document, existing: OpenAPIV3.Document | null): {
    total: number;
    documented: number;
    undocumented: string[];
  } {
    const generatedPaths = Object.keys(generated.paths || {});
    const existingPaths = existing ? Object.keys(existing.paths || {}) : [];

    const undocumented = generatedPaths.filter(path => !existingPaths.includes(path));

    return {
      total: generatedPaths.length,
      documented: existingPaths.length,
      undocumented,
    };
  }

  /**
   * 计算文档覆盖率
   */
  private calculateCoverage(endpoints: { total: number; documented: number }): number {
    if (endpoints.total === 0) return 100;
    return Math.round((endpoints.documented / endpoints.total) * 100);
  }

  /**
   * 检查同步性问题
   */
  private checkSynchronization(generated: OpenAPIV3.Document, existing: OpenAPIV3.Document | null): string[] {
    const issues: string[] = [];

    if (!existing) {
      issues.push('No existing OpenAPI specification found');
      return issues;
    }

    // 检查版本差异
    if (generated.info.version !== existing.info.version) {
      issues.push(`Version mismatch: generated=${generated.info.version}, existing=${existing.info.version}`);
    }

    // 检查路径差异
    const generatedPaths = Object.keys(generated.paths || {});
    const existingPaths = Object.keys(existing.paths || {});

    const newPaths = generatedPaths.filter(path => !existingPaths.includes(path));
    const removedPaths = existingPaths.filter(path => !generatedPaths.includes(path));

    if (newPaths.length > 0) {
      issues.push(`New endpoints not in documentation: ${newPaths.join(', ')}`);
    }

    if (removedPaths.length > 0) {
      issues.push(`Endpoints removed from implementation: ${removedPaths.join(', ')}`);
    }

    // 检查端点定义差异
    for (const path of generatedPaths.filter(p => existingPaths.includes(p))) {
      const generatedPath = generated.paths?.[path];
      const existingPath = existing.paths?.[path];

      if (generatedPath && existingPath) {
        const pathIssues = this.comparePathDefinitions(path, generatedPath, existingPath);
        issues.push(...pathIssues);
      }
    }

    return issues;
  }

  /**
   * 比较路径定义
   */
  private comparePathDefinitions(
    path: string,
    generated: OpenAPIV3.PathItemObject,
    existing: OpenAPIV3.PathItemObject
  ): string[] {
    const issues: string[] = [];

    const generatedMethods = Object.keys(generated);
    const existingMethods = Object.keys(existing);

    const newMethods = generatedMethods.filter(method => !existingMethods.includes(method));
    const removedMethods = existingMethods.filter(method => !generatedMethods.includes(method));

    if (newMethods.length > 0) {
      issues.push(`${path}: New methods not documented: ${newMethods.join(', ')}`);
    }

    if (removedMethods.length > 0) {
      issues.push(`${path}: Methods removed from implementation: ${removedMethods.join(', ')}`);
    }

    return issues;
  }

  /**
   * 查找过时的端点
   */
  private findOutdatedEndpoints(generated: OpenAPIV3.Document, existing: OpenAPIV3.Document | null): string[] {
    if (!existing) return [];

    const generatedPaths = Object.keys(generated.paths || {});
    const existingPaths = Object.keys(existing.paths || {});

    // 查找在现有文档中但不在生成的规范中的端点
    return existingPaths.filter(path => !generatedPaths.includes(path));
  }

  /**
   * 保存生成的规范
   */
  private saveGeneratedSpec(spec: OpenAPIV3.Document): void {
    try {
      writeFileSync(this.generatedOpenApiPath, JSON.stringify(spec, null, 2));
    } catch (error) {
      console.warn(`Failed to save generated OpenAPI spec: ${error}`);
    }
  }

  /**
   * 检查文档覆盖率
   */
  async checkDocumentationCoverage(): Promise<number> {
    const validation = await this.validateTRPCOpenAPISync();
    return validation.coverage;
  }

  /**
   * 生成文档覆盖率报告
   */
  async generateCoverageReport(): Promise<DocumentationStats> {
    const validation = await this.validateTRPCOpenAPISync();

    return {
      totalEndpoints: validation.endpoints.total,
      documentedEndpoints: validation.endpoints.documented,
      coverage: validation.coverage,
      missingDocs: validation.endpoints.undocumented,
      outdatedDocs: validation.outdated,
      validationErrors: validation.issues,
    };
  }

  /**
   * 验证端点一致性
   */
  async validateEndpointConsistency(): Promise<{
    consistent: boolean;
    inconsistencies: string[];
  }> {
    const validation = await this.validateTRPCOpenAPISync();

    return {
      consistent: validation.valid,
      inconsistencies: validation.issues,
    };
  }

  /**
   * 获取未文档化的端点列表
   */
  async getUndocumentedEndpoints(): Promise<string[]> {
    const validation = await this.validateTRPCOpenAPISync();
    return validation.endpoints.undocumented;
  }

  /**
   * 同步文档 - 自动更新 OpenAPI 规范
   */
  async syncDocumentation(): Promise<{
    success: boolean;
    updated: boolean;
    message: string;
  }> {
    try {
      const generated = this.generateOpenApiSpec();
      const existing = this.readExistingOpenApiSpec();

      if (!existing || JSON.stringify(generated) !== JSON.stringify(existing)) {
        writeFileSync(this.openApiPath, JSON.stringify(generated, null, 2));
        return {
          success: true,
          updated: true,
          message: 'OpenAPI specification updated successfully',
        };
      }

      return {
        success: true,
        updated: false,
        message: 'OpenAPI specification is already up to date',
      };
    } catch (error) {
      return {
        success: false,
        updated: false,
        message: `Failed to sync documentation: ${error}`,
      };
    }
  }
}

/**
 * 创建默认的文档验证器实例
 */
export function createDocValidator(appRouter: unknown): APIDocValidator {
  return new APIDocValidator(appRouter);
}

/**
 * 验证文档覆盖率是否达到要求
 */
export async function validateDocumentationRequirements(
  validator: APIDocValidator,
  minimumCoverage = 95
): Promise<{
  passed: boolean;
  coverage: number;
  required: number;
  issues: string[];
}> {
  const coverage = await validator.checkDocumentationCoverage();
  const validation = await validator.validateTRPCOpenAPISync();

  return {
    passed: coverage >= minimumCoverage && validation.valid,
    coverage,
    required: minimumCoverage,
    issues: validation.issues,
  };
}