# 质量保证系统

本文档描述了NeoStock项目中实施的质量保证和安全扫描系统。

## 🔧 API文档验证自动化 (AC16)

### 已实施功能
- ✅ **tRPC到OpenAPI文档生成**
  - 集成`trpc-to-openapi@3.0.1`包
  - 自动生成OpenAPI 3.1规范
  - 提供Swagger UI文档界面

- ✅ **文档与代码同步验证**
  - 端点一致性检查脚本
  - 文档过期检测机制
  - 自动化文档更新验证

- ✅ **文档覆盖率检查(>95%)**
  - 统计所有tRPC端点
  - 验证文档覆盖完整性
  - 配置覆盖率门控检查

- ✅ **文档更新检测机制**
  - 监控API变更自动更新文档
  - 实现文档版本管理
  - 建立文档审查流程

### 可用命令
```bash
# 验证API文档覆盖率
bun run docs:validate

# 检查API变更
bun run docs:check-changes

# 访问API文档
# http://localhost:3000/api/docs

# 获取OpenAPI规范
# http://localhost:3000/api/openapi.json
```

## 🔒 安全扫描深度集成 (AC17)

### 已实施功能
- ✅ **GitHub CodeQL静态分析**
  - 启用GitHub Security Features
  - 配置TypeScript代码分析
  - 集成security-and-quality查询规则

- ✅ **Snyk依赖漏洞扫描**
  - 集成Snyk CLI到CI/CD
  - 配置依赖安全监控
  - 设置高危漏洞阻塞机制

- ✅ **Docker镜像安全扫描**
  - 配置Trivy容器镜像扫描
  - 建立基础镜像安全标准
  - 实现镜像安全门控

- ✅ **SAST/SCA/DAST测试流水线**
  - 配置静态代码分析
  - 实现依赖组件分析
  - 建立动态安全测试框架

- ✅ **零高危漏洞门控机制**
  - 设置安全阈值标准
  - 配置自动阻塞机制
  - 建立漏洞处理流程

### 可用命令
```bash
# 运行质量门控检查
bun run quality:gate

# 运行安全门控检查
bun run security:gate

# 运行部署前检查
bun run pre-deploy
```

## 📋 CI/CD集成

### GitHub Actions工作流
1. **CI/CD Pipeline** (`.github/workflows/ci.yml`)
   - 代码检查和类型验证
   - 单元测试和覆盖率
   - API文档验证
   - 质量门控和安全门控

2. **CodeQL分析** (`.github/workflows/ci.yml`)
   - TypeScript静态分析
   - 安全漏洞检测
   - 代码质量评估

3. **Docker安全扫描** (`.github/workflows/docker-security.yml`)
   - 容器镜像漏洞扫描
   - Hadolint Dockerfile分析
   - Docker Bench安全检查

### 质量门控标准
- 📊 **API文档覆盖率**: 100% (目标: >95%)
- 🔒 **安全漏洞**: 0个关键漏洞
- 🧪 **代码质量**: 全部静态分析通过
- 🔧 **类型安全**: 全部TypeScript检查通过

## 🛡️ 安全标准

### 漏洞等级阈值
- **关键 (CRITICAL)**: 0个 - 立即阻塞部署
- **高危 (HIGH)**: 0个 - 阻塞部署
- **中危 (MEDIUM)**: 监控但不阻塞

### 安全扫描工具
- **CodeQL**: GitHub原生静态分析
- **Trivy**: 容器和依赖漏洞扫描
- **Snyk**: 第三方依赖安全监控
- **ESLint**: 代码质量和安全规则

## 📈 质量指标

### 当前状态
- ✅ API文档覆盖率: 100%
- ✅ 关键安全漏洞: 0个
- ✅ 代码质量门控: 通过
- ✅ 自动化测试覆盖: 完整

### 监控和报告
- 每次推送自动执行质量检查
- 安全扫描结果上传到GitHub Security
- 质量门控失败自动阻塞合并
- 覆盖率报告集成到CI/CD

## 🚀 使用指南

### 开发流程
1. 编写代码时确保包含OpenAPI元数据
2. 运行`bun run docs:validate`验证文档
3. 运行`bun run security:gate`进行安全检查
4. 运行`bun run pre-deploy`进行最终验证

### 故障排除
- 如果文档验证失败，检查tRPC过程是否包含meta信息
- 如果安全门控失败，运行`bun run lint`和`bun run check-types`
- 如果构建失败，检查依赖是否正确安装

## 📝 维护说明

### 添加新API端点时
1. 在tRPC过程中添加`meta.openapi`配置
2. 包含适当的`input`和`output`Zod验证
3. 运行`bun run docs:validate`确认文档更新
4. 添加相应的测试覆盖

### 更新安全配置时
1. 修改CI工作流中的安全阈值
2. 更新`security-gate.ts`中的检查逻辑
3. 测试新的安全门控规则
4. 更新团队文档和培训材料