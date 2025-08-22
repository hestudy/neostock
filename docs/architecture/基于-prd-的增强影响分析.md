# 基于 PRD 的增强影响分析

## 需要修改的文件

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

## 新增文件/模块需求

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
