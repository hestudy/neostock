# neostock Brownfield Architecture Document

## 介绍

本文档记录了 neostock 项目的当前状态，包括技术债务、工作流程和实际模式。它作为 AI 代理在增强功能时的参考，特别是为中国股票分析平台开发提供指导。

### 文档范围

基于 PRD 要求，重点关注与中国股票分析平台开发相关的区域：数据管理、API 扩展、前端组件集成和用户权限系统。

### 变更日志

| 日期 | 版本 | 描述 | 作者 |
|------|------|------|------|
| 2025-08-21 | 1.0 | 初始 brownfield 分析，针对股票分析平台增强 | AI 分析师 |

## 快速参考 - 关键文件和入口点

### 理解系统的关键文件

- **服务器入口**: `apps/server/src/index.ts` - Hono 应用主入口
- **客户端入口**: `apps/web/src/main.tsx` - React 应用启动
- **配置文件**: 
  - `apps/server/.env.example` - 服务器环境变量模板
  - `apps/web/.env.example` - 客户端环境变量模板
  - `turbo.json` - Turborepo 构建配置
- **核心业务逻辑**: 
  - `apps/server/src/routers/index.ts` - tRPC 路由定义
  - `apps/server/src/lib/auth.ts` - Better Auth 配置
- **数据库模型**: `apps/server/src/db/schema/auth.ts` - 认证相关表结构
- **API 类型定义**: `apps/server/src/routers/index.ts` - AppRouter 类型导出
- **前端路由**: `apps/web/src/routes/` - TanStack Router 文件路由

### PRD 增强影响区域

根据中国股票分析平台 PRD，以下文件/模块将受到影响：

**数据库 Schema 扩展**:
- `apps/server/src/db/schema/` - 需要新增股票、策略、回测相关表
- `apps/server/drizzle.config.ts` - 数据库配置

**API 路由扩展**:
- `apps/server/src/routers/index.ts` - 需要添加股票、回测、AI 分析路由
- 新增 `apps/server/src/routers/stocks.ts` - 股票数据 API
- 新增 `apps/server/src/routers/backtest.ts` - 回测 API
- 新增 `apps/server/src/routers/ai.ts` - AI 分析 API

**前端页面**:
- `apps/web/src/routes/dashboard.tsx` - 扩展为股票分析控制台
- 新增 `apps/web/src/routes/stocks/` - 股票相关页面目录
- 新增 `apps/web/src/routes/backtest/` - 回测相关页面目录

## 高级架构

### 技术概要

neostock 是一个基于 Better-T-Stack 的现代 TypeScript monorepo，使用 Turborepo 管理构建，Bun 作为运行时。项目采用类型安全的全栈架构，前后端通过 tRPC 实现端到端类型安全的 API 通信。

### 实际技术栈（来自 package.json）

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 运行时 | Bun | 1.2.18 | JavaScript/TypeScript 运行时，包管理器 |
| 构建系统 | Turborepo | 2.5.4 | Monorepo 构建和缓存管理 |
| 后端框架 | Hono | 4.8.2 | 轻量级 Web 框架 |
| API 层 | tRPC | 11.4.2 | 端到端类型安全 API |
| 数据库 | SQLite/Turso | - | 通过 Drizzle ORM 管理 |
| ORM | Drizzle | 0.44.2 | TypeScript-first ORM |
| 认证 | Better Auth | 1.3.4 | 现代认证解决方案 |
| 前端框架 | React | 19.0.0 | 用户界面库 |
| 路由 | TanStack Router | 1.114.25 | 类型安全的文件路由 |
| 状态管理 | TanStack Query | 5.80.5 | 服务器状态管理 |
| UI 组件 | shadcn/ui | - | 基于 Radix UI 的组件库 |
| 样式 | TailwindCSS | 4.0.15 | 实用优先的 CSS 框架 |
| 构建工具 | Vite | 6.2.2 | 前端构建工具 |

### 仓库结构现状

- **类型**: Monorepo（使用 Turborepo）
- **包管理器**: Bun（通过 packageManager 字段指定）
- **工作空间**: `apps/*` 和 `packages/*`（当前只有 apps）

## 源码树和模块组织

### 项目结构（实际）

```text
neostock/
├── apps/
│   ├── server/                 # 后端 Hono 应用
│   │   ├── src/
│   │   │   ├── index.ts        # 应用入口点
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts     # Better Auth 配置
│   │   │   │   ├── context.ts  # tRPC 上下文创建
│   │   │   │   └── trpc.ts     # tRPC 实例和中间件
│   │   │   ├── routers/
│   │   │   │   └── index.ts    # 主 tRPC 路由（目前只有健康检查）
│   │   │   └── db/
│   │   │       ├── index.ts    # 数据库连接
│   │   │       └── schema/
│   │   │           └── auth.ts # Better Auth 表结构
│   │   ├── drizzle.config.ts   # Drizzle Kit 配置
│   │   └── package.json
│   └── web/                    # 前端 React 应用
│       ├── src/
│       │   ├── main.tsx        # 应用入口
│       │   ├── components/     # React 组件
│       │   │   ├── ui/         # shadcn/ui 组件
│       │   │   ├── header.tsx  # 导航头部
│       │   │   └── ...         # 其他组件
│       │   ├── routes/         # TanStack Router 路由
│       │   │   ├── __root.tsx  # 根路由组件
│       │   │   ├── index.tsx   # 首页
│       │   │   ├── dashboard.tsx # 仪表板
│       │   │   └── login.tsx   # 登录页
│       │   ├── utils/
│       │   │   └── trpc.ts     # tRPC 客户端配置
│       │   └── index.css       # 全局样式
│       ├── vite.config.ts      # Vite 配置
│       └── package.json
├── web-bundles/                # BMAD 代理配置（不相关）
├── turbo.json                  # Turborepo 配置
├── package.json                # 根包配置
└── README.md
```

### 关键模块及其用途

- **认证系统**: `apps/server/src/lib/auth.ts` - 使用 Better Auth，支持邮箱密码认证
- **API 层**: `apps/server/src/routers/index.ts` - 目前只有健康检查和私有数据示例
- **数据库**: `apps/server/src/db/` - 使用 Drizzle ORM 和 SQLite/Turso
- **前端路由**: `apps/web/src/routes/` - 基于文件的路由系统
- **UI 组件**: `apps/web/src/components/` - shadcn/ui 组件和自定义组件
- **状态管理**: `apps/web/src/utils/trpc.ts` - tRPC + TanStack Query 集成

## 数据模型和 API

### 数据模型

当前数据模型仅包含认证相关表，位于 `apps/server/src/db/schema/auth.ts`:

- **user 表**: 用户基本信息（id, name, email, emailVerified, image, createdAt, updatedAt）
- **session 表**: 用户会话（id, expiresAt, token, userId, ipAddress, userAgent）
- **account 表**: 第三方账户关联（支持多种认证提供商）
- **verification 表**: 验证码和令牌管理

### API 规范

当前 API 非常简单，位于 `apps/server/src/routers/index.ts`:

- **healthCheck**: 公开的健康检查端点
- **privateData**: 需要认证的示例端点，返回用户信息

**类型安全**: 通过 `AppRouter` 类型导出，前端自动获得完整类型支持

## 技术债务和已知问题

### 当前系统状态

**优点**:
- 🟢 完整的 TypeScript 类型安全
- 🟢 现代化的技术栈选择
- 🟢 清晰的 monorepo 结构
- 🟢 良好的开发体验配置（热重载、DevTools）

**需要注意的限制**:
- 🟡 **最小化 API**: 目前只有演示性质的 API 端点
- 🟡 **SQLite 限制**: 对于万人级并发可能需要考虑扩展性
- 🟡 **缺少数据库迁移**: 目前没有生成的迁移文件
- 🟡 **环境配置**: 需要手动设置多个环境变量

### 架构约束

- **数据库**: 使用 SQLite/Turso，对于金融数据的并发写入能力有限制
- **认证**: 使用 Better Auth 的 SQLite 适配器，扩展订阅功能需要额外开发
- **构建**: Turborepo 缓存机制对于频繁变更的金融数据处理可能需要调整

## 集成点和外部依赖

### 当前集成

| 服务 | 用途 | 集成类型 | 关键文件 |
|------|------|----------|----------|
| Better Auth | 用户认证 | 内置库 | `apps/server/src/lib/auth.ts` |
| Turso | 数据库 | SQLite 兼容 | `apps/server/drizzle.config.ts` |

### 内部集成点

- **前后端通信**: tRPC over HTTP，端口 3000（服务器）到 3001（客户端）
- **认证流**: Better Auth 通过 `/api/auth/**` 路径处理
- **类型共享**: `AppRouter` 类型从服务器导入到客户端

## 开发和部署

### 本地开发设置

```bash
# 安装依赖
bun install

# 启动开发环境（并行启动前后端）
bun dev

# 仅启动特定应用
bun dev:web    # 前端 (端口 3001)
bun dev:server # 后端 (端口 3000)

# 数据库操作
cd apps/server
bun db:local   # 启动本地 SQLite 数据库
bun db:push    # 推送 schema 变更
bun db:studio  # 打开数据库管理界面
```

### 构建和部署

- **构建命令**: `bun build` (Turborepo 并行构建)
- **类型检查**: `bun check-types`
- **部署**: 目前没有配置自动化部署

### 环境变量要求

**服务器** (apps/server/.env):
```bash
CORS_ORIGIN=http://localhost:3001
BETTER_AUTH_SECRET=your-secret
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=file:local.db
```

**客户端** (apps/web/.env):
```bash
VITE_SERVER_URL=http://localhost:3000
```

## 基于 PRD 的增强影响分析

### 需要修改的文件

根据中国股票分析平台的增强需求，以下文件需要修改：

**数据库 Schema 扩展**:
- `apps/server/src/db/schema/auth.ts` - 扩展用户表添加订阅字段
- 新增 `apps/server/src/db/schema/stocks.ts` - 股票基础信息表
- 新增 `apps/server/src/db/schema/finance.ts` - 交易数据、策略、回测表
- `apps/server/src/db/index.ts` - 导出新的表结构

**API 路由扩展**:
- `apps/server/src/routers/index.ts` - 添加新路由到主 router
- 新增 `apps/server/src/routers/stocks.ts` - 股票数据 CRUD API
- 新增 `apps/server/src/routers/backtest.ts` - 回测计算和结果 API  
- 新增 `apps/server/src/routers/ai.ts` - AI 分析 API
- `apps/server/src/lib/context.ts` - 可能需要添加订阅状态到上下文

**业务逻辑模块**:
- 新增 `apps/server/src/lib/stock-data.ts` - tushare API 集成
- 新增 `apps/server/src/lib/backtest-engine.ts` - 回测算法实现
- 新增 `apps/server/src/lib/ai-analysis.ts` - AI 模型集成
- 新增 `apps/server/src/lib/scheduler.ts` - 定时任务管理

**前端路由和组件**:
- `apps/web/src/routes/dashboard.tsx` - 扩展为股票分析主控台
- 新增 `apps/web/src/routes/stocks/` - 股票相关页面目录
  - `index.tsx` - 股票搜索列表
  - `$stockCode.tsx` - 股票详情页
- 新增 `apps/web/src/routes/backtest/` - 回测相关页面
  - `index.tsx` - 策略管理
  - `$backtestId.tsx` - 回测结果页
- `apps/web/src/components/header.tsx` - 添加新的导航链接

**UI 组件扩展**:
- 新增 `apps/web/src/components/stock-chart.tsx` - K线图组件
- 新增 `apps/web/src/components/strategy-builder.tsx` - 策略构建器
- 新增 `apps/web/src/components/backtest-results.tsx` - 回测结果展示
- `apps/web/src/components/user-menu.tsx` - 添加订阅状态显示

### 新增文件/模块需求

**服务器端新增**:
```text
apps/server/src/
├── lib/
│   ├── stock-data.ts          # tushare API 包装器
│   ├── backtest-engine.ts     # 回测核心算法
│   ├── ai-analysis.ts         # AI 分析服务
│   └── scheduler.ts           # 定时任务管理
├── routers/
│   ├── stocks.ts              # 股票数据 API
│   ├── backtest.ts            # 回测 API
│   └── ai.ts                  # AI 分析 API
└── db/schema/
    ├── stocks.ts              # 股票相关表
    └── finance.ts             # 金融数据表
```

**客户端新增**:
```text
apps/web/src/
├── routes/
│   ├── stocks/
│   │   ├── index.tsx          # 股票列表页
│   │   └── $stockCode.tsx     # 股票详情页
│   └── backtest/
│       ├── index.tsx          # 策略管理页
│       └── $backtestId.tsx    # 回测结果页
└── components/
    ├── stock-chart.tsx        # K线图组件
    ├── strategy-builder.tsx   # 策略构建器
    └── backtest-results.tsx   # 回测结果组件
```

### 集成考虑事项

**与现有认证系统集成**:
- 扩展 Better Auth 用户模型添加订阅字段
- 在 tRPC 中间件中添加订阅状态验证
- 保持现有登录流程不变

**响应现有响应格式**:
- 遵循当前 tRPC 的错误处理模式
- 保持类型安全的 API 响应格式
- 使用现有的 TanStack Query 错误处理（toast 通知）

**UI 一致性**:
- 使用现有 shadcn/ui 组件库
- 保持当前的 TailwindCSS 主题系统
- 遵循现有的深色模式切换逻辑

## 附录 - 有用的命令和脚本

### 常用命令

```bash
# 开发
bun dev                 # 启动开发服务器（前后端并行）
bun build              # 构建所有应用
bun check-types        # 类型检查

# 数据库
bun db:push            # 推送 schema 变更
bun db:studio          # 打开数据库管理界面
bun db:generate        # 生成迁移文件
bun db:migrate         # 运行迁移

# 特定应用
bun dev:web            # 仅启动前端
bun dev:server         # 仅启动后端
```

### 调试和故障排除

**日志**: 使用 Hono 内置 logger 中间件，输出到控制台
**调试模式**: 通过浏览器 DevTools 和 TanStack DevTools
**常见问题**:
- CORS 配置：确保 `CORS_ORIGIN` 环境变量正确设置
- 认证问题：检查 `BETTER_AUTH_SECRET` 和 cookie 配置
- 数据库连接：确认 `DATABASE_URL` 路径和权限

### 开发最佳实践

**类型安全**:
- 所有 API 调用都通过 tRPC，确保类型安全
- 使用 Zod 验证外部数据输入
- 严格的 TypeScript 配置

**代码组织**:
- 业务逻辑放在 `lib/` 目录
- API 路由按功能模块分离
- 前端组件按用途分类

**性能优化**:
- 利用 Turborepo 缓存机制
- TanStack Query 自动缓存和重新验证
- Vite 的快速热重载

---

此文档为 AI 代理提供了实现中国股票分析平台增强功能所需的完整架构理解。关键重点是保持与现有系统的完全兼容性，同时逐步扩展功能以满足 PRD 要求。