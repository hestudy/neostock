# DevOps操作程序手册

## 部署程序

### 生产部署检查清单
- [ ] 所有测试通过(单元测试、集成测试、E2E测试)
- [ ] 代码安全扫描通过(零高危漏洞)
- [ ] 性能基准测试通过
- [ ] 数据库迁移脚本验证
- [ ] 回滚计划确认
- [ ] 监控告警配置验证
- [ ] 负载均衡器健康检查配置

### 自动化部署流程
```bash
# 1. 预部署验证
./scripts/pre-deploy-check.sh

# 2. 蓝绿部署
./scripts/blue-green-deploy.sh

# 3. 健康检查
./scripts/health-check.sh

# 4. 流量切换
./scripts/switch-traffic.sh
```

### 详细回滚程序

#### 自动化回滚触发器
以下条件将自动触发回滚机制：

1. **错误率阈值**: >5%持续60秒
2. **响应时间阈值**: P99>5秒持续120秒
3. **认证失败率**: >10%持续30秒
4. **数据拉取失败率**: >20%持续180秒

#### 手动回滚程序
```bash
#!/bin/bash
# scripts/rollback.sh - 手动回滚脚本

ROLLBACK_VERSION=$1
ROLLBACK_REASON=$2

echo "开始回滚到版本: $ROLLBACK_VERSION"
echo "回滚原因: $ROLLBACK_REASON"

# 1. 验证目标版本
if ! git rev-parse --verify $ROLLBACK_VERSION; then
    echo "错误: 无效的版本 $ROLLBACK_VERSION"
    exit 1
fi

# 2. 数据库回滚
echo "执行数据库回滚..."
cd apps/server
bun db:rollback --to=$ROLLBACK_VERSION

# 3. 应用程序回滚
echo "执行应用回滚..."
git checkout $ROLLBACK_VERSION
bun install
bun build

# 4. 重启服务
echo "重启服务..."
pm2 restart neostock-server
pm2 restart neostock-web

# 5. 健康检查
echo "执行健康检查..."
timeout 60 bash -c 'until curl -f http://localhost:3000/health; do sleep 2; done'

if [ $? -eq 0 ]; then
    echo "✅ 回滚成功完成"
    # 发送成功通知
    curl -X POST $SLACK_WEBHOOK -d '{"text":"🔄 应用已成功回滚到版本 '$ROLLBACK_VERSION'"}'
else
    echo "❌ 回滚后健康检查失败"
    # 发送失败告警
    curl -X POST $SLACK_WEBHOOK -d '{"text":"🚨 应用回滚失败，需要立即人工干预"}'
    exit 1
fi
```

## 监控和告警

### 关键指标监控
- **错误率**: >5%触发告警
- **响应时间**: P99>5s触发告警  
- **认证失败率**: >10%触发告警
- **数据拉取失败率**: >20%触发告警
- **系统资源**: CPU>80%, 内存>85%触发告警

### 告警响应程序
1. **Level 1 - 警告**: 自动记录，5分钟内自动恢复
2. **Level 2 - 错误**: 立即通知开发团队，15分钟内响应
3. **Level 3 - 严重**: 立即通知所有相关人员，触发应急响应

### 告警通知配置
```yaml
# monitoring/alerting-config.yml
alerts:
  error_rate:
    threshold: 0.05
    duration: 60s
    severity: critical
    channels: [slack, email, pagerduty]
    
  response_time:
    threshold: 5000ms
    percentile: 99
    duration: 120s
    severity: warning
    channels: [slack, email]
    
  auth_failure:
    threshold: 0.10
    duration: 30s
    severity: critical
    channels: [slack, email, pagerduty]
    
  data_fetch_failure:
    threshold: 0.20
    duration: 180s
    severity: error
    channels: [slack, email]
```

## 测试程序

### 集成测试 - 现有功能验证
确保新功能不破坏现有系统：

```bash
# 运行完整的现有功能回归测试
bun test apps/server/src/__tests__/integration/existing-features.test.ts

# 验证Better Auth功能
bun test apps/server/src/__tests__/integration/auth-regression.test.ts

# 验证tRPC API兼容性
bun test apps/server/src/__tests__/integration/api-compatibility.test.ts
```

### 性能基准测试
```bash
# API响应时间基准测试
bun test apps/server/src/__tests__/performance/response-time.test.ts

# 并发请求处理能力测试
bun test apps/server/src/__tests__/performance/concurrency.test.ts

# 数据库查询性能测试
bun test apps/server/src/__tests__/performance/database.test.ts
```

### E2E测试自动化
```bash
# 关键用户流程测试
npx playwright test tests/e2e/user-journeys.spec.ts

# 现有功能回归测试
npx playwright test tests/e2e/existing-features.spec.ts

# 移动端兼容性测试
npx playwright test tests/e2e/mobile-compatibility.spec.ts
```

## 安全程序

### 安全扫描检查清单
- [ ] 静态代码安全分析(SAST)
- [ ] 依赖漏洞扫描(SCA)
- [ ] Docker镜像安全扫描
- [ ] API安全测试
- [ ] 认证机制验证
- [ ] 数据加密验证

### 凭据管理程序
```bash
# API密钥轮换(每90天执行)
./scripts/rotate-api-keys.sh

# 验证环境变量安全性
./scripts/verify-secrets.sh

# 审计API调用日志
./scripts/audit-api-calls.sh
```

### 合规检查
- **数据保护**: 用户数据加密存储和传输
- **访问控制**: 基于角色的权限管理
- **审计日志**: 所有敏感操作记录
- **备份策略**: 数据备份和恢复测试

## 故障恢复

### 灾难恢复检查清单
- [ ] 识别故障范围和影响
- [ ] 评估数据完整性
- [ ] 选择恢复策略(回滚vs修复)
- [ ] 执行恢复程序
- [ ] 验证系统功能
- [ ] 通知用户和利益相关者
- [ ] 进行故障分析和预防措施

### RTO/RPO目标
- **恢复时间目标(RTO)**: <1小时
- **恢复点目标(RPO)**: <15分钟
- **数据备份频率**: 每4小时增量备份，每日全量备份

### 备份和恢复程序
```bash
# 数据库备份
./scripts/backup-database.sh

# 数据恢复验证
./scripts/verify-backup.sh

# 灾难恢复演练
./scripts/disaster-recovery-drill.sh
```

## 维护程序

### 定期维护任务
- **每日**: 系统健康检查、日志审查
- **每周**: 性能报告分析、安全扫描
- **每月**: 备份恢复测试、容量规划审查
- **每季度**: 灾难恢复演练、安全审计

### 容量规划
- **CPU使用率**: 目标<70%平均负载
- **内存使用率**: 目标<80%峰值使用
- **存储空间**: 预留30%增长空间
- **网络带宽**: 监控峰值流量趋势

### 日志管理
```bash
# 日志轮转配置
logrotate /etc/logrotate.d/neostock

# 日志分析
./scripts/analyze-logs.sh

# 错误日志聚合
./scripts/aggregate-errors.sh
```

## 文档维护

### 文档更新程序
- **架构变更**: 更新架构决策记录(ADR)
- **API变更**: 自动生成API文档
- **配置变更**: 更新配置文档和环境变量说明
- **程序变更**: 更新操作手册和故障排除指南

### 知识转移
- **定期培训**: 新团队成员操作培训
- **文档审查**: 季度文档准确性审查
- **最佳实践**: 经验教训文档化
- **应急联系**: 维护应急响应联系人列表