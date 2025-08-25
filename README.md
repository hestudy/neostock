# neostock

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, TRPC, and more.

## Features

### 核心技术栈
- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Hono** - Lightweight, performant server framework
- **tRPC** - End-to-end type-safe APIs
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **SQLite/Turso** - Database engine
- **Authentication** - Email & password authentication with Better Auth
- **Turborepo** - Optimized monorepo build system

### 基础设施功能
- **灾难恢复系统** - 完整的备份恢复策略，RTO<1小时，RPO<15分钟
- **监控系统** - 系统健康检查、性能指标监控、告警机制
- **安全管理** - API密钥管理、安全扫描、访问审计
- **基础设施即代码** - 环境配置管理、一键部署、版本化管理
- **质量门控** - 自动化测试、代码检查、部署验证
- **种子数据管理** - A股基础数据导入和验证

## Getting Started

First, install the dependencies:

```bash
bun install
```
## Database Setup

This project uses SQLite with Drizzle ORM.

1. Start the local SQLite database:
```bash
cd apps/server && bun db:local
```


2. Update your `.env` file in the `apps/server` directory with the appropriate connection details if needed.

3. Apply the schema to your database:
```bash
bun db:push
```


Then, run the development server:

```bash
bun dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).



## Project Structure

```
neostock/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Hono, TRPC)
```

## Available Scripts

### 开发和构建
- `bun dev`: Start all applications in development mode
- `bun build`: Build all applications
- `bun dev:web`: Start only the web application
- `bun dev:server`: Start only the server
- `bun check-types`: Check TypeScript types across all apps
- `bun test`: Run all tests
- `bun test:coverage`: Run tests with coverage report
- `bun test:e2e`: Run end-to-end tests with Playwright

### 数据库管理
- `bun db:push`: Push schema changes to database
- `bun db:studio`: Open database studio UI
- `bun db:generate`: Generate database migrations
- `bun db:migrate`: Apply database migrations
- `cd apps/server && bun db:local`: Start the local SQLite database

### 代码质量和测试
- `bun lint`: Run ESLint on all packages
- `bun lint:fix`: Fix auto-fixable ESLint issues
- `bun test:performance`: Run performance benchmark tests
- `bun test:e2e`: Run end-to-end tests with Playwright
- `bun test:e2e:ui`: Run E2E tests with UI mode
- `bun test:e2e:report`: Show Playwright test report

### 质量门控和部署
- `bun docs:validate`: Validate API documentation consistency
- `bun quality:gate`: Run comprehensive quality gate checks
- `bun security:gate`: Run security gate checks and scanning
- `bun pre-deploy`: Pre-deployment verification and validation
