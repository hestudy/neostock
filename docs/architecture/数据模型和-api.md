# 数据模型和 API

## 数据模型

当前数据模型仅包含认证相关表，位于 `apps/server/src/db/schema/auth.ts`:

- **user 表**: 用户基本信息（id, name, email, emailVerified, image, createdAt, updatedAt）
- **session 表**: 用户会话（id, expiresAt, token, userId, ipAddress, userAgent）
- **account 表**: 第三方账户关联（支持多种认证提供商）
- **verification 表**: 验证码和令牌管理

## API 规范

当前 API 非常简单，位于 `apps/server/src/routers/index.ts`:

- **healthCheck**: 公开的健康检查端点
- **privateData**: 需要认证的示例端点，返回用户信息

**类型安全**: 通过 `AppRouter` 类型导出，前端自动获得完整类型支持
