# NeoStock API 文档

## 概述

NeoStock API 是基于 tRPC 构建的类型安全 API，提供端到端的类型安全保障。所有端点都支持 OpenAPI 规范，并通过自动化工具确保文档与代码同步。

## API 端点

### 核心功能

#### 健康检查
- **端点**: `GET /health-check`
- **描述**: 系统健康状态检查
- **认证**: 无需认证
- **返回**: 字符串 "OK"

#### 用户数据
- **端点**: `GET /private-data`  
- **描述**: 获取认证用户的私有数据
- **认证**: 需要认证
- **返回**: 用户信息对象

### 性能监控

#### 性能指标
- **端点**: `GET /performance/metrics`
- **描述**: 获取当前系统性能指标
- **返回**: 响应时间、请求统计、告警状态等

#### 性能基准
- **端点**: `GET /performance/benchmarks`
- **描述**: 获取性能基准定义和当前状态
- **返回**: 基准阈值和当前性能对比

#### 性能历史
- **端点**: `GET /performance/history`
- **描述**: 获取性能历史数据和统计信息
- **返回**: 响应时间历史、百分位数统计

#### 告警状态
- **端点**: `GET /performance/alerts`
- **描述**: 获取当前系统告警状态
- **返回**: 告警列表和性能状态

#### 重置计数器
- **端点**: `POST /performance/reset`
- **描述**: 重置性能监控计数器（用于测试）
- **返回**: 重置确认消息

## 技术规范

### 类型安全
- 所有端点通过 tRPC 提供完整的类型安全
- TypeScript 类型通过 `AppRouter` 自动导出
- 前端自动获得类型提示和验证

### OpenAPI 集成
- 所有端点包含完整的 OpenAPI 3.1 元数据
- 支持自动生成 API 文档
- 通过 `bun docs:validate` 确保文档同步

### 性能监控
- 内置请求响应时间监控
- 支持性能基准对比
- 提供实时告警机制
- 历史数据统计分析

### 认证机制
- 基于 Better Auth 的 session 认证
- 支持 `protectedProcedure` 和 `publicProcedure`
- 自动处理认证状态和用户信息

## 开发指南

### 添加新端点
1. 在相应的路由器文件中定义过程
2. 添加 OpenAPI 元数据到 `meta` 字段
3. 运行 `bun docs:validate` 验证文档同步
4. 更新本文档说明

### 测试 API
- 使用 `bun test` 运行 API 测试
- 通过 `apps/server/src/__tests__/routers/` 查看测试示例
- 使用 Playwright 进行端到端测试

### 文档维护
- OpenAPI 规范自动生成到 `generated-openapi.json`
- 手动维护的规范在 `openapi.json`  
- 通过文档验证脚本确保一致性

## 相关文件

- `/apps/server/src/routers/` - 路由器实现
- `/apps/server/src/lib/trpc.ts` - tRPC 配置
- `/docs/api/openapi.json` - API 规范
- `/docs/api/generated-openapi.json` - 自动生成规范