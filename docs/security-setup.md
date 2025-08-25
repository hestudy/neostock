# 安全扫描工具配置指南

本文档说明如何配置项目中的安全扫描工具，包括 GitHub Security Features、Snyk 和其他安全工具。

## 必需的 GitHub Secrets 配置

在 GitHub 仓库的 Settings -> Secrets and Variables -> Actions 中配置以下 secrets：

### 1. SNYK_TOKEN
Snyk 漏洞扫描工具的 API 令牌。

**获取步骤：**
1. 注册/登录 [Snyk](https://snyk.io)
2. 前往 Account Settings -> API Token
3. 生成新的 API Token
4. 在 GitHub 中添加为 `SNYK_TOKEN`

**用途：** CI/CD 流水线中的依赖漏洞扫描

### 2. CODECOV_TOKEN (可选)
代码覆盖率报告上传令牌。

**获取步骤：**
1. 注册/登录 [Codecov](https://codecov.io)
2. 添加 GitHub 仓库
3. 获取 Repository Upload Token
4. 在 GitHub 中添加为 `CODECOV_TOKEN`

**用途：** 测试覆盖率报告自动上传

## GitHub Security Features

### CodeQL 分析
已在 CI/CD 流水线中配置，无需额外配置。会自动：
- 扫描 TypeScript 代码
- 检测安全漏洞和代码质量问题
- 上传结果到 GitHub Security 标签

### Dependabot
在 `.github/dependabot.yml` 中配置（如果需要）：

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/apps/server"
    schedule:
      interval: "weekly"  
  - package-ecosystem: "npm"
    directory: "/apps/web"
    schedule:
      interval: "weekly"
```

## 安全扫描流水线验证

### 本地验证
```bash
# 运行完整安全门控
cd apps/server
bun run security:gate

# 验证依赖扫描
bun audit

# 运行安全相关测试
bun run test -- security
```

### CI/CD 验证
安全扫描集成在以下 CI jobs 中：
- `codeql-analysis`: CodeQL 静态分析
- `security-scan`: Snyk + Trivy 扫描
- `test`: 安全门控脚本验证

## 安全基线要求

### 漏洞等级门控
- **CRITICAL**: 阻断部署，必须修复
- **HIGH**: 阻断部署，必须修复  
- **MEDIUM**: 警告但不阻断，建议修复
- **LOW**: 仅记录，不影响部署

### 零高危漏洞政策
- 所有 CRITICAL 和 HIGH 级别漏洞必须在部署前修复
- 安全门控会阻止包含高危漏洞的代码合并

## 故障排除

### Snyk Token 问题
如果遇到 `SNYK_TOKEN` 相关错误：
1. 验证 token 在 GitHub Secrets 中正确设置
2. 确认 token 有效且未过期
3. 检查 Snyk 账户权限

### CodeQL 分析失败
如果 CodeQL 分析失败：
1. 检查代码是否能正常构建
2. 确认 TypeScript 配置正确
3. 查看 GitHub Actions 日志中的具体错误

### 安全门控超时
如果安全扫描超时：
1. 检查 CI 环境网络连接
2. 考虑增加 timeout 设置
3. 优化扫描性能（见性能优化部分）

## 性能优化

安全扫描已优化为：
- 并行执行检查项
- 合理的 timeout 设置
- 缓存依赖和构建结果
- 智能跳过不必要的扫描

目标执行时间：<5 分钟（完整安全门控）