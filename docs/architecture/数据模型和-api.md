# 数据模型和 API

## 数据模型

当前数据模型仅包含认证相关表，位于 `apps/server/src/db/schema/auth.ts`:

- **user 表**: 用户基本信息（id, name, email, emailVerified, image, createdAt, updatedAt）
- **session 表**: 用户会话（id, expiresAt, token, userId, ipAddress, userAgent）
- **account 表**: 第三方账户关联（支持多种认证提供商）
- **verification 表**: 验证码和令牌管理

## API 规范

当前 API 包含基础认证功能和完整的性能监控系统，位于 `apps/server/src/routers/`:

### 核心端点 (`index.ts`)
- **healthCheck**: 公开的健康检查端点 (`GET /health-check`)
- **privateData**: 需要认证的示例端点，返回用户信息 (`GET /private-data`)

### 性能监控端点 (`performance.ts`)
- **performance.metrics**: 获取当前性能指标 (`GET /performance/metrics`)
- **performance.benchmarks**: 获取性能基准对比 (`GET /performance/benchmarks`)
- **performance.history**: 获取性能历史数据 (`GET /performance/history`)
- **performance.alerts**: 获取当前告警状态 (`GET /performance/alerts`)
- **performance.reset**: 重置性能计数器 (`POST /performance/reset`)

### 技术特性
- **类型安全**: 通过 `AppRouter` 类型导出，前端自动获得完整类型支持
- **OpenAPI 集成**: 所有端点都包含完整的 OpenAPI 元数据
- **性能监控**: 内置性能指标收集和基准对比功能
- **自动文档验证**: 通过 `docs:validate` 脚本确保文档与代码同步
