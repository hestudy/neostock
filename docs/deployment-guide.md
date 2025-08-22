# neostock 部署运维手册

## 概述

本文档提供 neostock 中国股票分析平台的完整部署和运维指南，基于 PO 主清单验证要求，确保生产环境的高可用性和可维护性。

## 环境配置

### 生产环境要求

#### 计算资源
- **Web服务器**: 2x t3.medium (4 vCPU, 8GB RAM)
- **数据库服务器**: 1x t3.small (2 vCPU, 4GB RAM) 
- **负载均衡**: Application Load Balancer
- **存储**: EBS gp3, 100GB (数据) + 20GB (日志)

#### 网络配置
- **VPC**: 专用虚拟私有云
- **子网**: 公有子网(ALB) + 私有子网(应用服务器)
- **安全组**: 严格的入站规则配置
- **CDN**: CloudFront分发静态资源

#### 监控和备份
- **监控**: CloudWatch + DataDog APM
- **日志**: CloudWatch Logs + ELK Stack
- **备份**: 自动化数据库备份(增量+全量)
- **告警**: 多级告警策略配置

### 基础设施即代码 (IaC)

#### Terraform主配置
```hcl
# terraform/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "neostock-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-west-2"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "neostock"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# VPC配置
module "vpc" {
  source = "./modules/vpc"
  
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  
  tags = local.common_tags
}

# 应用服务器
module "app_servers" {
  source = "./modules/ec2"
  
  instance_type        = var.app_instance_type
  min_size            = var.app_min_size
  max_size            = var.app_max_size
  desired_capacity    = var.app_desired_capacity
  
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  security_group_ids  = [module.security_groups.app_sg_id]
  
  user_data = base64encode(templatefile("${path.module}/user-data/app-server.sh", {
    environment = var.environment
  }))
  
  tags = local.common_tags
}

# 数据库
module "database" {
  source = "./modules/rds"
  
  engine                = "sqlite" # 或 "postgres" for future
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  security_group_ids    = [module.security_groups.db_sg_id]
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  tags = local.common_tags
}

# 负载均衡
module "load_balancer" {
  source = "./modules/alb"
  
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  security_group_ids = [module.security_groups.alb_sg_id]
  
  target_group_arn = module.app_servers.target_group_arn
  
  ssl_certificate_arn = var.ssl_certificate_arn
  
  tags = local.common_tags
}
```

#### 应用服务器配置
```hcl
# terraform/modules/ec2/main.tf
resource "aws_launch_template" "app" {
  name_prefix   = "${var.app_name}-"
  image_id      = data.aws_ami.app.id
  instance_type = var.instance_type
  
  vpc_security_group_ids = var.security_group_ids
  
  user_data = var.user_data
  
  tag_specifications {
    resource_type = "instance"
    tags = merge(var.tags, {
      Name = "${var.app_name}-app"
      Type = "application"
    })
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "app" {
  name                = "${var.app_name}-asg"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [aws_lb_target_group.app.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 300
  
  min_size         = var.min_size
  max_size         = var.max_size
  desired_capacity = var.desired_capacity
  
  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }
  
  tag {
    key                 = "Name"
    value               = "${var.app_name}-asg"
    propagate_at_launch = false
  }
}
```

### 环境变量配置

#### 生产环境变量
```bash
# .env.production
NODE_ENV=production
PORT=3000

# 数据库配置
DATABASE_URL=sqlite:///var/lib/neostock/production.db
DATABASE_POOL_SIZE=10
DATABASE_TIMEOUT=30000

# 认证配置
BETTER_AUTH_SECRET=super-secure-secret-key-production
BETTER_AUTH_URL=https://api.neostock.com
CORS_ORIGIN=https://neostock.com

# 数据源配置
TUSHARE_API_TOKEN=your-production-tushare-token
TUSHARE_API_URL=https://api.tushare.pro
BACKUP_DATA_SOURCES=sina,netease,yahoo
DATA_FETCH_SCHEDULE=0 17 * * *
DATA_FETCH_TIMEOUT=300000

# 缓存配置
REDIS_URL=redis://elasticache-cluster:6379
CACHE_TTL=3600
CACHE_MAX_SIZE=1000

# 监控配置
DATADOG_API_KEY=your-datadog-api-key
NEW_RELIC_LICENSE_KEY=your-newrelic-license-key
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info

# 安全配置
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000
SESSION_SECRET=production-session-secret
ENCRYPTION_KEY=production-encryption-key

# 文件存储
S3_BUCKET=neostock-production-assets
S3_REGION=us-west-2
CDN_BASE_URL=https://cdn.neostock.com

# 通知配置
SMTP_HOST=smtp.amazonses.com
SMTP_PORT=587
SMTP_USER=your-ses-user
SMTP_PASS=your-ses-password
SLACK_WEBHOOK_URL=your-slack-webhook-url
```

## 部署流程

### 自动化部署脚本

#### 主部署脚本
```bash
#!/bin/bash
# scripts/deploy.sh

set -euo pipefail

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}
BLUE_GREEN=${3:-false}

echo "🚀 开始部署 neostock 到 $ENVIRONMENT 环境"
echo "版本: $VERSION"
echo "蓝绿部署: $BLUE_GREEN"

# 检查先决条件
check_prerequisites() {
    echo "📋 检查部署先决条件..."
    
    # 检查必需的环境变量
    required_vars=(
        "AWS_ACCOUNT_ID"
        "AWS_REGION" 
        "ECR_REPOSITORY"
        "ECS_CLUSTER"
        "ECS_SERVICE"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            echo "❌ 环境变量 $var 未设置"
            exit 1
        fi
    done
    
    # 检查AWS CLI
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI 未安装"
        exit 1
    fi
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker 未安装"
        exit 1
    fi
    
    echo "✅ 先决条件检查通过"
}

# 构建和推送Docker镜像
build_and_push() {
    echo "🔨 构建Docker镜像..."
    
    # 登录ECR
    aws ecr get-login-password --region $AWS_REGION | \
        docker login --username AWS --password-stdin \
        $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    
    # 构建镜像
    docker build -t neostock:$VERSION .
    docker tag neostock:$VERSION \
        $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$VERSION
    
    # 推送镜像
    docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$VERSION
    
    echo "✅ 镜像构建和推送完成"
}

# 数据库迁移
run_migrations() {
    echo "🗄️ 运行数据库迁移..."
    
    # 创建迁移任务定义
    MIGRATION_TASK_DEF=$(aws ecs register-task-definition \
        --family neostock-migration \
        --task-role-arn $ECS_TASK_ROLE \
        --execution-role-arn $ECS_EXECUTION_ROLE \
        --network-mode awsvpc \
        --requires-compatibilities FARGATE \
        --cpu 256 \
        --memory 512 \
        --container-definitions '[{
            "name": "migration",
            "image": "'$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$VERSION'",
            "command": ["bun", "run", "db:migrate"],
            "environment": [
                {"name": "NODE_ENV", "value": "'$ENVIRONMENT'"},
                {"name": "DATABASE_URL", "value": "'$DATABASE_URL'"}
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/neostock-migration",
                    "awslogs-region": "'$AWS_REGION'",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        }]' \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    # 运行迁移任务
    MIGRATION_TASK=$(aws ecs run-task \
        --cluster $ECS_CLUSTER \
        --task-definition $MIGRATION_TASK_DEF \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={
            subnets=[$PRIVATE_SUBNET_IDS],
            securityGroups=[$MIGRATION_SECURITY_GROUP],
            assignPublicIp=DISABLED
        }" \
        --query 'tasks[0].taskArn' \
        --output text)
    
    # 等待迁移完成
    echo "等待数据库迁移完成..."
    aws ecs wait tasks-stopped \
        --cluster $ECS_CLUSTER \
        --tasks $MIGRATION_TASK
    
    # 检查迁移结果
    EXIT_CODE=$(aws ecs describe-tasks \
        --cluster $ECS_CLUSTER \
        --tasks $MIGRATION_TASK \
        --query 'tasks[0].containers[0].exitCode' \
        --output text)
    
    if [[ "$EXIT_CODE" != "0" ]]; then
        echo "❌ 数据库迁移失败"
        exit 1
    fi
    
    echo "✅ 数据库迁移完成"
}

# 蓝绿部署
blue_green_deploy() {
    echo "🔄 执行蓝绿部署..."
    
    # 获取当前服务状态
    CURRENT_TASK_DEF=$(aws ecs describe-services \
        --cluster $ECS_CLUSTER \
        --services $ECS_SERVICE \
        --query 'services[0].taskDefinition' \
        --output text)
    
    # 创建新的任务定义
    NEW_TASK_DEF=$(aws ecs register-task-definition \
        --family neostock-app \
        --task-role-arn $ECS_TASK_ROLE \
        --execution-role-arn $ECS_EXECUTION_ROLE \
        --network-mode awsvpc \
        --requires-compatibilities FARGATE \
        --cpu 1024 \
        --memory 2048 \
        --container-definitions file://task-definition.json \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    # 更新服务
    aws ecs update-service \
        --cluster $ECS_CLUSTER \
        --service $ECS_SERVICE \
        --task-definition $NEW_TASK_DEF
    
    # 等待部署完成
    echo "等待新版本部署完成..."
    aws ecs wait services-stable \
        --cluster $ECS_CLUSTER \
        --services $ECS_SERVICE
    
    echo "✅ 蓝绿部署完成"
}

# 健康检查
health_check() {
    echo "🏥 执行健康检查..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s https://api.neostock.com/health > /dev/null; then
            echo "✅ 健康检查通过"
            return 0
        fi
        
        echo "⏳ 健康检查失败，重试 $attempt/$max_attempts"
        sleep 10
        ((attempt++))
    done
    
    echo "❌ 健康检查失败"
    return 1
}

# 回滚函数
rollback() {
    echo "🔙 执行回滚..."
    
    if [[ -n "${CURRENT_TASK_DEF:-}" ]]; then
        aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --task-definition $CURRENT_TASK_DEF
        
        aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services $ECS_SERVICE
        
        echo "✅ 回滚完成"
    else
        echo "❌ 无法回滚：未找到前一个任务定义"
        exit 1
    fi
}

# 主部署流程
main() {
    trap 'echo "❌ 部署失败"; rollback; exit 1' ERR
    
    check_prerequisites
    build_and_push
    run_migrations
    
    if [[ "$BLUE_GREEN" == "true" ]]; then
        blue_green_deploy
    else
        # 滚动更新
        aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment
    fi
    
    if ! health_check; then
        rollback
        exit 1
    fi
    
    echo "🎉 部署成功完成!"
}

# 执行主流程
main "$@"
```

#### 健康检查脚本
```bash
#!/bin/bash
# scripts/health-check.sh

set -euo pipefail

ENDPOINT=${1:-"https://api.neostock.com"}
TIMEOUT=${2:-30}

echo "🏥 执行全面健康检查..."

# API健康检查
check_api_health() {
    echo "📡 检查API健康状态..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response "$ENDPOINT/health")
    
    if [[ "$response" == "200" ]]; then
        echo "✅ API健康检查通过"
        return 0
    else
        echo "❌ API健康检查失败: HTTP $response"
        cat /tmp/health_response
        return 1
    fi
}

# 数据库连接检查
check_database() {
    echo "🗄️ 检查数据库连接..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/db_response "$ENDPOINT/health/database")
    
    if [[ "$response" == "200" ]]; then
        echo "✅ 数据库连接正常"
        return 0
    else
        echo "❌ 数据库连接失败: HTTP $response"
        return 1
    fi
}

# 外部服务检查
check_external_services() {
    echo "🔗 检查外部服务连接..."
    
    # Tushare API检查
    local response=$(curl -s -w "%{http_code}" -o /tmp/tushare_response "$ENDPOINT/health/tushare")
    
    if [[ "$response" == "200" ]]; then
        echo "✅ Tushare API连接正常"
    else
        echo "⚠️ Tushare API连接异常: HTTP $response"
    fi
    
    return 0
}

# 性能检查
check_performance() {
    echo "⚡ 检查API性能..."
    
    local start_time=$(date +%s%N)
    curl -s "$ENDPOINT/api/stocks/list" > /dev/null
    local end_time=$(date +%s%N)
    
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    if [[ $duration -lt 2000 ]]; then
        echo "✅ API响应时间正常: ${duration}ms"
        return 0
    else
        echo "⚠️ API响应时间过慢: ${duration}ms"
        return 1
    fi
}

# 主检查流程
main() {
    local failed_checks=0
    
    check_api_health || ((failed_checks++))
    check_database || ((failed_checks++))
    check_external_services || ((failed_checks++))
    check_performance || ((failed_checks++))
    
    if [[ $failed_checks -eq 0 ]]; then
        echo "🎉 所有健康检查通过!"
        exit 0
    else
        echo "❌ $failed_checks 项检查失败"
        exit 1
    fi
}

main "$@"
```

### 监控配置

#### DataDog监控配置
```yaml
# monitoring/datadog.yml
api_key: ${DATADOG_API_KEY}
site: datadoghq.com
dd_url: https://app.datadoghq.com

# 日志配置
logs_enabled: true
logs_config:
  container_collect_all: true
  
# APM配置
apm_config:
  enabled: true
  env: production
  
# 进程监控
process_config:
  enabled: true
  
# 网络监控
network_config:
  enabled: true

# 自定义检查
init_config:

instances:
  - name: neostock_api
    url: https://api.neostock.com/health
    timeout: 30
    method: GET
    expected_code: 200
    
  - name: neostock_database
    url: https://api.neostock.com/health/database
    timeout: 30
    method: GET
    expected_code: 200
```

#### 告警规则配置
```yaml
# monitoring/alerts.yml
alerts:
  - name: "高错误率告警"
    type: "metric alert"
    query: "avg(last_5m):avg:neostock.api.error_rate{env:production} > 0.05"
    message: |
      API错误率超过5%
      
      请检查:
      1. 应用日志
      2. 数据库连接
      3. 外部服务状态
      
      @slack-alerts @pagerduty
    tags:
      - "service:neostock"
      - "env:production"
      - "severity:critical"
    
  - name: "API响应时间告警"
    type: "metric alert"
    query: "avg(last_5m):avg:neostock.api.response_time{env:production} > 5000"
    message: |
      API平均响应时间超过5秒
      
      @slack-alerts
    tags:
      - "service:neostock"
      - "env:production"
      - "severity:warning"
    
  - name: "数据拉取失败告警"
    type: "metric alert"
    query: "sum(last_15m):sum:neostock.data.fetch_failures{env:production} > 3"
    message: |
      数据拉取连续失败超过3次
      
      请检查:
      1. Tushare API状态
      2. 网络连接
      3. API限额
      
      @slack-alerts @oncall
    tags:
      - "service:neostock"
      - "env:production"
      - "severity:critical"
      
  - name: "磁盘空间告警"
    type: "metric alert"
    query: "avg(last_5m):avg:system.disk.in_use{env:production,device:/dev/xvda1} > 0.85"
    message: |
      磁盘使用率超过85%
      
      @slack-alerts
    tags:
      - "service:neostock"
      - "env:production"
      - "severity:warning"
```

### 灾难恢复

#### 自动备份策略
```bash
#!/bin/bash
# scripts/backup.sh

set -euo pipefail

BACKUP_TYPE=${1:-"incremental"}
S3_BUCKET="neostock-backups"
RETENTION_DAYS=30

echo "📦 开始执行 $BACKUP_TYPE 备份..."

# 数据库备份
backup_database() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="neostock_${BACKUP_TYPE}_${timestamp}.db"
    
    if [[ "$BACKUP_TYPE" == "full" ]]; then
        # 全量备份
        sqlite3 /var/lib/neostock/production.db ".backup /tmp/$backup_file"
    else
        # 增量备份 (通过WAL文件)
        cp /var/lib/neostock/production.db-wal "/tmp/$backup_file"
    fi
    
    # 压缩备份文件
    gzip "/tmp/$backup_file"
    
    # 上传到S3
    aws s3 cp "/tmp/${backup_file}.gz" \
        "s3://$S3_BUCKET/database/$BACKUP_TYPE/" \
        --storage-class STANDARD_IA
    
    # 清理本地文件
    rm "/tmp/${backup_file}.gz"
    
    echo "✅ 数据库备份完成: ${backup_file}.gz"
}

# 配置备份
backup_config() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local config_file="config_${timestamp}.tar.gz"
    
    # 打包配置文件
    tar -czf "/tmp/$config_file" \
        /etc/neostock/ \
        /var/lib/neostock/*.env \
        /opt/neostock/config/
    
    # 上传到S3
    aws s3 cp "/tmp/$config_file" \
        "s3://$S3_BUCKET/config/" \
        --storage-class STANDARD_IA
    
    # 清理本地文件
    rm "/tmp/$config_file"
    
    echo "✅ 配置备份完成: $config_file"
}

# 清理旧备份
cleanup_old_backups() {
    echo "🧹 清理超过 $RETENTION_DAYS 天的旧备份..."
    
    # 删除旧的数据库备份
    aws s3 ls "s3://$S3_BUCKET/database/" --recursive | \
        awk '{print $4}' | \
        while read file; do
            local file_date=$(echo "$file" | grep -oE '[0-9]{8}' | head -1)
            if [[ -n "$file_date" ]]; then
                local days_old=$(( ($(date +%s) - $(date -d "$file_date" +%s)) / 86400 ))
                if [[ $days_old -gt $RETENTION_DAYS ]]; then
                    aws s3 rm "s3://$S3_BUCKET/$file"
                    echo "删除旧备份: $file"
                fi
            fi
        done
    
    echo "✅ 备份清理完成"
}

# 主备份流程
main() {
    backup_database
    backup_config
    cleanup_old_backups
    
    echo "🎉 备份任务完成!"
}

main "$@"
```

#### 灾难恢复程序
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

set -euo pipefail

RECOVERY_TYPE=${1:-"latest"}
S3_BUCKET="neostock-backups"

echo "🚨 开始灾难恢复程序..."
echo "恢复类型: $RECOVERY_TYPE"

# 停止应用服务
stop_services() {
    echo "⏹️ 停止应用服务..."
    
    systemctl stop neostock-app
    systemctl stop neostock-worker
    
    echo "✅ 服务已停止"
}

# 恢复数据库
restore_database() {
    echo "🗄️ 恢复数据库..."
    
    local backup_file
    if [[ "$RECOVERY_TYPE" == "latest" ]]; then
        # 获取最新的全量备份
        backup_file=$(aws s3 ls "s3://$S3_BUCKET/database/full/" | \
            sort | tail -1 | awk '{print $4}')
    else
        # 使用指定的备份文件
        backup_file="$RECOVERY_TYPE"
    fi
    
    if [[ -z "$backup_file" ]]; then
        echo "❌ 未找到备份文件"
        exit 1
    fi
    
    echo "使用备份文件: $backup_file"
    
    # 备份当前数据库
    if [[ -f /var/lib/neostock/production.db ]]; then
        mv /var/lib/neostock/production.db \
           /var/lib/neostock/production.db.recovery_backup
    fi
    
    # 下载并恢复备份
    aws s3 cp "s3://$S3_BUCKET/database/full/$backup_file" /tmp/
    gunzip "/tmp/$backup_file"
    
    local db_file=$(basename "$backup_file" .gz)
    mv "/tmp/$db_file" /var/lib/neostock/production.db
    
    # 设置正确的权限
    chown neostock:neostock /var/lib/neostock/production.db
    chmod 644 /var/lib/neostock/production.db
    
    echo "✅ 数据库恢复完成"
}

# 验证数据完整性
verify_data_integrity() {
    echo "🔍 验证数据完整性..."
    
    # SQLite完整性检查
    sqlite3 /var/lib/neostock/production.db "PRAGMA integrity_check;" | \
        grep -q "ok" || {
            echo "❌ 数据库完整性检查失败"
            exit 1
        }
    
    # 检查关键表
    local table_count=$(sqlite3 /var/lib/neostock/production.db \
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
    
    if [[ $table_count -lt 5 ]]; then
        echo "❌ 数据库表数量异常: $table_count"
        exit 1
    fi
    
    echo "✅ 数据完整性验证通过"
}

# 启动服务并验证
start_and_verify() {
    echo "🚀 启动服务..."
    
    systemctl start neostock-app
    systemctl start neostock-worker
    
    # 等待服务启动
    sleep 30
    
    # 健康检查
    if curl -f -s http://localhost:3000/health > /dev/null; then
        echo "✅ 服务启动成功"
    else
        echo "❌ 服务启动失败"
        exit 1
    fi
}

# 发送通知
send_notification() {
    local status=$1
    local message="灾难恢复 $status\n\n"
    message+="恢复类型: $RECOVERY_TYPE\n"
    message+="时间: $(date)\n"
    message+="服务器: $(hostname)"
    
    # Slack通知
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$message\"}" \
        "$SLACK_WEBHOOK_URL"
    
    # 邮件通知
    echo "$message" | mail -s "neostock 灾难恢复 $status" \
        ops@neostock.com
}

# 主恢复流程
main() {
    trap 'send_notification "失败"; exit 1' ERR
    
    stop_services
    restore_database
    verify_data_integrity
    start_and_verify
    
    send_notification "成功"
    echo "🎉 灾难恢复完成!"
}

main "$@"
```

## 监控和维护

### 性能监控

#### 关键指标
- **API响应时间**: 平均 < 1s, 95th percentile < 3s
- **错误率**: < 1%
- **数据库查询时间**: 平均 < 100ms
- **内存使用率**: < 80%
- **CPU使用率**: < 70%
- **磁盘使用率**: < 85%

#### 业务指标
- **用户活跃度**: DAU, MAU
- **功能使用率**: 搜索、回测、分析功能使用统计
- **数据质量**: 数据拉取成功率、数据完整性
- **用户满意度**: API响应时间分布、错误影响用户数

### 日常维护

#### 每日检查清单
```bash
#!/bin/bash
# scripts/daily-check.sh

echo "📅 执行每日系统检查..."

# 检查系统资源
echo "💾 系统资源状态:"
df -h | grep -v tmpfs
free -h
top -bn1 | head -5

# 检查服务状态
echo "🔧 服务状态:"
systemctl status neostock-app --no-pager -l
systemctl status neostock-worker --no-pager -l

# 检查日志错误
echo "📋 最近24小时错误日志:"
journalctl -u neostock-app --since "24 hours ago" --no-pager | \
    grep -i error | tail -10

# 检查数据拉取状态
echo "📊 数据拉取状态:"
tail -20 /var/log/neostock/data-fetch.log

# 检查备份状态
echo "📦 备份状态:"
aws s3 ls s3://neostock-backups/database/incremental/ | tail -5

echo "✅ 每日检查完成"
```

#### 周维护任务
```bash
#!/bin/bash
# scripts/weekly-maintenance.sh

echo "📅 执行周维护任务..."

# 数据库优化
echo "🗄️ 数据库优化..."
sqlite3 /var/lib/neostock/production.db "VACUUM;"
sqlite3 /var/lib/neostock/production.db "ANALYZE;"

# 日志轮转
echo "📋 日志轮转..."
logrotate /etc/logrotate.d/neostock

# 清理临时文件
echo "🧹 清理临时文件..."
find /tmp -name "neostock*" -mtime +7 -delete
find /var/log/neostock -name "*.log.*" -mtime +30 -delete

# 更新系统包
echo "📦 更新系统包..."
apt update && apt upgrade -y

# 安全扫描
echo "🔒 安全扫描..."
rkhunter --check --skip-keypress
lynis audit system --quiet

echo "✅ 周维护任务完成"
```

## 故障排除

### 常见问题诊断

#### 应用无法启动
```bash
# 检查服务状态
systemctl status neostock-app

# 检查日志
journalctl -u neostock-app --no-pager -l

# 检查端口占用
netstat -tulpn | grep :3000

# 检查配置文件
cat /etc/neostock/production.env
```

#### 数据库连接问题
```bash
# 检查数据库文件权限
ls -la /var/lib/neostock/production.db

# 检查数据库完整性
sqlite3 /var/lib/neostock/production.db "PRAGMA integrity_check;"

# 检查数据库大小
du -sh /var/lib/neostock/

# 检查WAL文件
ls -la /var/lib/neostock/*.db-*
```

#### 性能问题
```bash
# 检查系统负载
uptime
iostat 1 5

# 检查内存使用
free -h
ps aux --sort=-%mem | head -10

# 检查数据库查询
sqlite3 /var/lib/neostock/production.db ".timer on" "SELECT COUNT(*) FROM stocks;"

# 检查网络连接
ss -tuln
netstat -i
```

### 紧急响应程序

#### 服务中断响应
1. **立即响应** (5分钟内)
   - 确认问题范围
   - 通知相关人员
   - 开始故障排查

2. **问题诊断** (15分钟内)
   - 检查监控数据
   - 分析错误日志
   - 确定根本原因

3. **临时修复** (30分钟内)
   - 实施临时解决方案
   - 恢复核心功能
   - 监控修复效果

4. **永久修复** (2小时内)
   - 实施永久解决方案
   - 完整测试验证
   - 更新文档和程序

5. **事后分析** (24小时内)
   - 撰写事故报告
   - 分析根本原因
   - 制定预防措施

这个部署运维手册提供了 neostock 项目完整的生产环境管理指南，确保系统的高可用性、可维护性和安全性。