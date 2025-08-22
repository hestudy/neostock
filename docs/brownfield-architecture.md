# neostock Brownfield Architecture Document

## 介绍

本文档记录了 neostock 项目的当前状态，包括技术债务、工作流程和实际模式。它作为 AI 代理在增强功能时的参考，特别是为中国股票分析平台开发提供指导。

### 文档范围

基于 PRD 要求，重点关注与中国股票分析平台开发相关的区域：数据管理、API 扩展、前端组件集成和用户权限系统。

### 变更日志

| 日期 | 版本 | 描述 | 作者 |
|------|------|------|------|
| 2025-08-21 | 1.0 | 初始 brownfield 分析，针对股票分析平台增强 | AI 分析师 |
| 2025-08-22 | 1.1 | 基于Sprint变更提案优化架构策略 | Winston (Architect) |
| 2025-08-22 | 1.2 | 集成课程纠正结果，确认基础设施架构强化 | Sarah (PO Agent) |

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
- `apps/server/src/routers/index.ts` - 需要添加股票、回测路由
- 新增 `apps/server/src/routers/stocks.ts` - 股票数据 API
- 新增 `apps/server/src/routers/backtest.ts` - 回测 API
- ~~新增 `apps/server/src/routers/ai.ts` - AI 分析 API~~ [移至Phase 2]

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
- 🟢 **SQLite 优化**: 当前百人级并发需求下SQLite性能充足，已规划优化策略
- 🟡 **缺少数据库迁移**: 目前没有生成的迁移文件
- 🟡 **环境配置**: 需要手动设置多个环境变量
- 🟡 **数据源单点**: 需要实现备用数据源策略

### 架构约束

- **数据库**: 使用 SQLite/Turso，经过优化后支持百人级并发，为未来扩展保留迁移路径
- **认证**: 使用 Better Auth 的 SQLite 适配器，扩展订阅功能需要额外开发
- **构建**: Turborepo 缓存机制对于频繁变更的金融数据处理可能需要调整
- **数据源**: 当前依赖单一tushare数据源，需要实现备用策略保证可靠性

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

# 数据源配置
TUSHARE_API_TOKEN=your-tushare-token
TUSHARE_API_URL=https://api.tushare.pro
BACKUP_DATA_SOURCES=sina,netease
DATA_FETCH_SCHEDULE=0 17 * * *  # 每日下午5点

# 监控配置
MONITORING_ENABLED=true
ALERT_THRESHOLD_ERROR_RATE=0.05
ALERT_WEBHOOK_URL=your-webhook-url
```

**客户端** (apps/web/.env):
```bash
VITE_SERVER_URL=http://localhost:3000
```

## 基于Sprint变更的架构优化策略

### 📋 课程纠正架构更新状态: ✅ 已批准并实施

**更新日期**: 2025-08-22  
**变更来源**: PO主检查清单验证 + 课程纠正分析  
**架构影响**: 基础设施层强化，应用层架构保持不变  
**实施优先级**: 关键 - 必须在Story 1.1开始前完成  

### CI/CD和DevOps架构

基于PO验证要求和课程纠正分析，实现生产就绪的CI/CD流水线架构：

#### CI/CD流水线设计
```yaml
# .github/workflows/main.yml
name: 生产CI/CD流水线
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - 代码质量检查 (ESLint, TypeScript, Prettier)
      - 安全扫描 (CodeQL, Snyk)
      - 单元测试 (>80%覆盖率)
      - 集成测试 (API端点验证)
  
  build-and-test:
    needs: quality-gate
    runs-on: ubuntu-latest
    steps:
      - 应用构建 (前端+后端)
      - Docker镜像构建和扫描
      - E2E测试 (关键用户流程)
      - 性能基准测试
  
  deploy:
    needs: build-and-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - 蓝绿部署到生产环境
      - 健康检查验证
      - 自动回滚机制(失败时)
```

#### 基础设施即代码架构
```hcl
# terraform/main.tf - 示例IaC结构
module "app_infrastructure" {
  source = "./modules/app"
  
  environment = var.environment
  app_name    = "neostock"
  
  # 计算资源
  instance_type = "t3.medium"
  min_capacity  = 2
  max_capacity  = 10
  
  # 数据库
  db_instance_class = "db.t3.micro"
  backup_retention  = 7
  
  # 监控
  enable_monitoring = true
  log_retention     = 30
}
```

#### 监控和可观测性架构
- **应用监控**: New Relic或DataDog APM
- **基础设施监控**: CloudWatch或Prometheus+Grafana  
- **日志聚合**: ELK Stack或CloudWatch Logs
- **告警策略**: 分层告警(警告、错误、严重)
- **仪表板**: 实时系统健康和业务指标

#### 生产安全架构强化

基于PO验证的安全要求扩展：

##### DevSecOps集成
```typescript
// apps/server/src/lib/security-scanner.ts
class SecurityScanner {
  async scanDependencies(): Promise<VulnerabilityReport> {
    // Snyk或OWASP依赖检查
  }
  
  async scanCode(): Promise<CodeSecurityReport> {
    // 静态代码安全分析
  }
  
  async scanInfrastructure(): Promise<InfraSecurityReport> {
    // 基础设施安全配置检查
  }
}
```

##### 合规自动化
- **SOC 2 Type II准备**: 访问控制、数据保护、可用性监控
- **数据隐私合规**: 用户数据加密、访问审计、数据保留策略
- **安全事件响应**: 自动化事件检测、响应流程、恢复程序

### SQLite性能优化架构

基于PO验证结果，我们采用SQLite优化策略而非数据库迁移，以支持百人级并发需求：

#### 连接池和查询优化
```typescript
// apps/server/src/lib/database-pool.ts
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

class SQLiteConnectionPool {
  private connections: Database[] = [];
  private readonly maxConnections = 10;
  
  async getConnection(): Promise<Database> {
    // 连接池管理逻辑
  }
  
  async executeWithOptimization<T>(query: string): Promise<T> {
    // 查询优化和缓存
  }
}
```

#### 索引策略
- **股票代码索引**: `CREATE INDEX idx_stock_code ON stocks(code)`
- **日期范围索引**: `CREATE INDEX idx_daily_data_date ON daily_data(date)`
- **用户关联索引**: `CREATE INDEX idx_user_stocks ON user_stocks(user_id, stock_id)`
- **复合索引**: 针对常用查询模式的复合索引

#### 数据分区和压缩
```sql
-- 历史数据表分区（按年度）
CREATE TABLE daily_data_2024 AS SELECT * FROM daily_data WHERE date >= '2024-01-01';
CREATE TABLE daily_data_2023 AS SELECT * FROM daily_data WHERE date >= '2023-01-01' AND date < '2024-01-01';

-- 数据压缩策略
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
```

### 主备数据源架构

实现tushare主数据源和免费API备用数据源的自动切换架构：

#### 数据源抽象层
```typescript
// apps/server/src/lib/data-source-manager.ts
interface StockDataSource {
  name: string;
  priority: number;
  healthCheck(): Promise<boolean>;
  getStockData(symbol: string): Promise<StockData>;
  getDailyData(symbol: string, date: string): Promise<DailyData>;
}

class DataSourceManager {
  private sources: StockDataSource[] = [
    new TushareDataSource(),      // 主数据源
    new SinaFinanceDataSource(),  // 备用数据源1  
    new NetEaseDataSource()       // 备用数据源2
  ];
  
  async fetchWithFallback<T>(operation: string, params: any): Promise<T> {
    // 主备切换逻辑
  }
}
```

#### 数据质量验证
```typescript
// apps/server/src/lib/data-validator.ts
class DataQualityValidator {
  validateStockData(data: StockData): ValidationResult {
    // 格式验证、范围检查、一致性验证
  }
  
  detectAnomalies(data: DailyData[]): AnomalyReport {
    // 异常值检测
  }
  
  crossSourceValidation(primary: Data, backup: Data): boolean {
    // 跨数据源一致性检查
  }
}
```

### 监控和错误处理架构

#### 系统监控组件
```typescript
// apps/server/src/lib/monitoring.ts
class SystemMonitor {
  private metrics = new Map<string, number>();
  
  trackAPIResponse(endpoint: string, duration: number, success: boolean) {
    // API性能监控
  }
  
  trackDataQuality(source: string, quality: number) {
    // 数据质量监控
  }
  
  checkSystemHealth(): HealthReport {
    // 系统健康检查
  }
}
```

#### 告警机制
```typescript
// apps/server/src/lib/alerting.ts
class AlertManager {
  async sendAlert(type: AlertType, message: string) {
    // 错误告警通知
  }
  
  checkThresholds() {
    // 阈值监控（API错误率>5%等）
  }
}
```

### 基础设施架构设计

#### 测试架构
- **测试分层**: 单元测试(unit) → 集成测试(integration) → E2E测试
- **测试工具**: Vitest + Bun:test + Playwright
- **覆盖率目标**: 核心逻辑 >80%, 关键路径 100%

```typescript
// 测试目录结构
apps/
├── server/
│   ├── src/
│   │   └── __tests__/
│   │       ├── unit/           # 单元测试
│   │       ├── integration/    # 集成测试
│   │       └── helpers/        # 测试工具
└── web/
    ├── src/
    │   └── __tests__/
    │       ├── components/     # 组件测试
    │       ├── utils/          # 工具函数测试
    │       └── e2e/           # E2E测试
```

#### CI/CD架构  
- **构建流水线**: 代码检查 → 测试执行 → 构建验证 → 部署
- **环境管理**: 开发环境(本地) → 测试环境(自动) → 生产环境(手动)
- **质量门槛**: 所有测试通过 + 代码检查通过 + 构建成功

```yaml
# .github/workflows/main.yml
name: CI/CD Pipeline
on: [push, pull_request]
jobs:
  test:
    - 代码检查 (ESLint, TypeScript)
    - 单元测试执行
    - 集成测试执行
    - 构建验证
  deploy:
    - 自动部署到测试环境
    - 数据库迁移执行
    - 健康检查验证
```

#### 监控架构
- **指标收集**: API性能 + 错误率 + 数据质量 + 系统健康
- **告警策略**: 错误率>5% + API响应>5s + 数据拉取失败
- **日志管理**: 结构化日志 + 错误跟踪 + 性能分析

```typescript
// apps/server/src/lib/monitoring.ts
class MonitoringService {
  trackAPIMetrics(endpoint: string, duration: number, status: number)
  trackDataQuality(source: string, metrics: QualityMetrics)
  checkSystemHealth(): HealthStatus
  sendAlert(type: AlertType, message: string)
}
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
- ~~新增 `apps/server/src/routers/ai.ts` - AI 分析 API~~ [Phase 2]
- `apps/server/src/lib/context.ts` - 可能需要添加订阅状态到上下文

**业务逻辑模块**:
- 新增 `apps/server/src/lib/stock-data.ts` - tushare API 集成和备用数据源管理
- 新增 `apps/server/src/lib/backtest-engine.ts` - 回测算法实现
- ~~新增 `apps/server/src/lib/ai-analysis.ts` - AI 模型集成~~ [Phase 2]
- 新增 `apps/server/src/lib/scheduler.ts` - 定时任务管理
- 新增 `apps/server/src/lib/monitoring.ts` - 系统监控和错误处理

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
│   ├── stock-data.ts          # tushare API和备用数据源包装器
│   ├── backtest-engine.ts     # 回测核心算法
│   ├── monitoring.ts          # 系统监控和错误处理
│   └── scheduler.ts           # 定时任务管理
├── routers/
│   ├── stocks.ts              # 股票数据 API
│   └── backtest.ts            # 回测 API
└── db/schema/
    ├── stocks.ts              # 股票相关表
    └── finance.ts             # 金融数据表

# Phase 2 (未来增强):
├── lib/
│   └── ai-analysis.ts         # AI 分析服务
└── routers/
    └── ai.ts                  # AI 分析 API
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

## 架构决策记录 (ADR)

### ADR-001: SQLite优化策略 vs 数据库迁移
**决策日期**: 2025-08-22  
**状态**: 已接受  

**背景**: PO验证发现数据库扩展性风险，需要在SQLite优化和数据库迁移之间选择。

**决策**: 采用SQLite优化策略，支持百人级并发，为未来迁移保留路径。

**理由**:
- 降低开发复杂度和风险
- 当前百人级需求下SQLite性能充足
- 保持现有技术栈的一致性
- 为未来扩展保留架构灵活性

**后果**:
- ✅ 减少开发时间2周
- ✅ 降低数据迁移风险
- ✅ 保持系统稳定性
- ⚠️ 需要在用户增长时重新评估

### ADR-002: 主备数据源架构
**决策日期**: 2025-08-22  
**状态**: 已接受  

**背景**: 单一tushare数据源存在可靠性风险。

**决策**: 实现主备数据源自动切换架构，包含tushare主源和免费API备源。

**理由**:
- 提高系统可靠性
- 降低外部依赖风险
- 保证数据连续性
- 支持数据质量验证

### ADR-003: AI功能Phase 2推迟
**决策日期**: 2025-08-22  
**状态**: 已接受  

**背景**: AI功能复杂度高，可能影响MVP交付。

**决策**: 将AI分析功能推迟到Phase 2实施。

**理由**:
- 聚焦MVP核心价值
- 降低技术复杂度
- 确保基础架构稳定
- 为AI功能预留良好基础

### ADR-004: Story 1.0基础设施强化策略
**决策日期**: 2025-08-22  
**状态**: 已接受并实施  

**背景**: PO主检查清单验证发现4个关键阻塞问题，83%就绪率需要提升。

**决策**: 将Story 1.0从2周扩展到4周，添加15个详细验收标准，包含完整的CI/CD、测试、监控和安全基础设施。

**理由**:
- 降低项目风险从中高风险到低中风险
- 建立生产就绪的基础设施
- 确保后续开发在坚实基础上进行
- 提高项目成功概率

**后果**:
- ✅ 项目总时长从14周增至20周
- ✅ 风险等级显著降低
- ✅ 为所有后续Story提供稳定基础
- ✅ 提升整体项目质量和可维护性

**实施要求**:
- Week 1: CI/CD流水线、测试框架、安全凭据管理
- Week 2: 数据库迁移框架、API Mock系统、性能基准
- Week 3: 监控系统、架构文档、安全扫描
- Week 4: 生产就绪验证、IaC、灾难恢复

---

此文档为 AI 代理提供了实现中国股票分析平台增强功能所需的完整架构理解。关键重点是保持与现有系统的完全兼容性，采用风险优先的开发策略，确保系统稳定性的同时为未来扩展留出空间。