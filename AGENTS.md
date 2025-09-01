# Repository Guidelines

## 项目结构与模块组织
- 根目录使用 Turborepo + Bun 工作区；主要代码在 `apps/`。
- `apps/web`：React + TanStack Router 前端（`src/components`、`src/routes`）。
- `apps/server`：Hono + tRPC API（`src/lib`、`src/db`、`src/__tests__`）。
- 测试：单元/集成位于 `apps/**/src/**/__tests__`；E2E 位于 `e2e-tests/`。
- 配置：`vitest.config.ts`、`playwright.config.ts`、`turbo.json`、`.env.example`。

## 构建、测试与本地开发
- `bun install`：安装依赖。
- `bun dev`：启动所有应用（Turborepo 管线）。
- `bun dev:web` / `bun dev:server`：仅启动对应应用。
- `bun build`：构建到 `dist/`。
- `bun check-types`：TypeScript 类型检查。
- `bun test` / `bun test:coverage`：运行 Vitest（含覆盖率）。
- `bun test:e2e`：运行 Playwright E2E（目录 `e2e-tests/`）。
- 数据库（server）：`bun db:push`、`bun db:migrate`、`bun db:generate`、`bun db:studio`；本地 SQLite：`cd apps/server && bun db:local`。

## 编码风格与命名
- TypeScript，2 空格缩进；前端 `.tsx`，服务端 `.ts`。
- Lint：ESLint（见 `apps/web/eslint.config.js`）。提交前运行 `bun lint` / `bun lint:fix`。
- 文件名 kebab-case（如 `stock-search.tsx`）；组件导出用 PascalCase；优先使用具名导出。

## 测试规范
- 框架：Vitest（单元/集成）、Playwright（E2E）。
- 约定：`*.test.ts(x)` 与 `__tests__/` 目录（例如 `apps/server/src/__tests__`）。
- 运行：E2E 需先 `bun dev`，基址 `http://localhost:3001`。
- 覆盖率目标：80%（见 `codecov.yml`）；新/改代码需配套测试。

## 提交与 Pull Request
- 使用 Conventional Commits：如 `feat(server): 添加健康检查`、`fix(tests): 稳定计时`（参考 Git 历史）。
- PR 要求：清晰描述、关联 Issue、影响范围（web/server）、UI 截图（如有）、测试说明；确保 CI（lint/类型/单测/E2E）通过。

## 安全与配置
- 禁止提交密钥；按应用复制 `.env.example` 为 `.env`。
- 环境校验：进入 `apps/server` 运行 `bun env:validate`（如需）。
- 迁移与同步：对 DB 变更使用 Drizzle 脚本进行生成/推送/迁移与验证。

## 沟通与语言约定
- 所有机器人与贡献者在仓库沟通与回复中应始终使用中文。
