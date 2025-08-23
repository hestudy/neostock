# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

neostock 是一个中国股票分析平台，基于现代化的 TypeScript 全栈架构。项目使用 Turborepo monorepo 结构，包含前端 Web 应用和后端 API 服务。

## 核心技术栈

- **运行时**: Bun 1.2.18
- **构建系统**: Turborepo 2.5.4  
- **后端**: Hono + tRPC (类型安全 API)
- **数据库**: SQLite/Turso + Drizzle ORM
- **认证**: Better Auth
- **前端**: React 19 + TanStack Router + TailwindCSS + shadcn/ui
- **测试**: Vitest (单元测试) + Playwright (E2E)

## 常用开发命令

### 开发和启动
```bash
bun install                    # 安装依赖
bun dev                       # 启动所有应用 (web:3001, server:3000)
bun dev:web                   # 仅启动前端
bun dev:server                # 仅启动后端
```

### 数据库管理
```bash
cd apps/server && bun db:local  # 启动本地 SQLite 数据库
bun db:push                     # 推送 schema 变更到数据库
bun db:studio                   # 打开数据库可视化界面
bun db:migrate                  # 应用数据库迁移
```

### 代码质量检查
```bash
bun lint                      # 运行 ESLint
bun lint:fix                  # 自动修复 ESLint 问题
bun check-types               # 类型检查
bun test                      # 运行所有测试
bun test:coverage             # 运行测试并生成覆盖率报告
bun test:e2e                  # 运行端到端测试
```

### 质量门控 (在 apps/server 目录下)
```bash
bun run quality:gate          # 质量门控检查
bun run security:gate         # 安全门控检查
bun run pre-deploy           # 部署前验证
bun run docs:validate        # 文档验证
```

## 项目结构

```
neostock/
├── apps/
│   ├── web/          # React 前端应用 (端口 3001)
│   └── server/       # Hono API 服务器 (端口 3000)
├── docs/             # 项目文档和架构设计
├── tests/e2e/        # Playwright E2E 测试
└── qa/               # QA 评估和测试设计
```

## 关键架构特点

- **类型安全**: 前后端通过 tRPC 实现端到端类型安全
- **认证系统**: 使用 Better Auth 提供邮箱密码认证
- **数据层**: Drizzle ORM + SQLite，支持本地开发和 Turso 生产环境
- **组件库**: 基于 shadcn/ui 的可复用组件系统
- **样式**: TailwindCSS 实用优先的样式方案
- **状态管理**: TanStack Query 用于服务器状态管理

## 基础设施功能

项目包含完整的基础设施管理功能:
- 灾难恢复系统 (RTO<1小时，RPO<15分钟)
- 系统监控和告警
- 安全管理和API密钥管理
- 质量门控和自动化检查
- A股种子数据管理

## 开发工作流

1. 使用 `bun dev` 启动开发环境
2. 前端开发在 `apps/web/` 目录，访问 http://localhost:3001
3. 后端开发在 `apps/server/` 目录，API 访问 http://localhost:3000
4. 数据库变更通过 Drizzle 管理，使用 `bun db:push` 同步
5. 提交前运行 `bun lint` 和 `bun test` 确保代码质量
6. 使用质量门控脚本进行部署前检查

## 测试策略

- 单元测试: Vitest (覆盖率要求 >80%)
- 组件测试: Testing Library
- 端到端测试: Playwright
- API 测试: 包含在 server 测试套件中

## 重要提醒

- 始终保持类型安全，充分利用 TypeScript 和 tRPC
- 遵循现有的 shadcn/ui 组件模式
- 数据库变更必须通过 Drizzle 迁移系统
- 使用项目的质量门控确保代码质量
- API 变更需要更新相关文档