# neostock 测试策略文档

## 概述

本文档定义了 neostock 中国股票分析平台的全面测试策略，基于 PO 主清单验证的要求，确保高质量的软件交付和生产稳定性。

## 测试架构

### 测试金字塔
- **单元测试**: 80% - 业务逻辑、工具函数、组件
- **集成测试**: 15% - API端点、数据库交互、外部服务
- **E2E测试**: 5% - 关键用户流程、回归测试

### 测试工具栈
- **后端**: Bun:test + Supertest
- **前端**: Vitest + Testing Library
- **E2E**: Playwright
- **覆盖率**: c8/nyc
- **Mock服务**: MSW (Mock Service Worker)

## 单元测试策略

### 后端单元测试
```typescript
// apps/server/src/__tests__/unit/stock-data.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { StockDataService } from '../../lib/stock-data';

describe('StockDataService', () => {
  let stockDataService: StockDataService;
  
  beforeEach(() => {
    stockDataService = new StockDataService();
  });
  
  it('should fetch stock data from tushare API', async () => {
    const stockData = await stockDataService.getStockData('000001.SZ');
    expect(stockData).toBeDefined();
    expect(stockData.code).toBe('000001.SZ');
  });
  
  it('should handle API failures gracefully', async () => {
    // 测试错误处理
  });
});
```

### 前端单元测试
```typescript
// apps/web/src/__tests__/components/stock-chart.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StockChart } from '../../components/stock-chart';

describe('StockChart', () => {
  it('renders stock chart with data', () => {
    const mockData = [
      { date: '2024-01-01', open: 100, close: 105, high: 108, low: 98 }
    ];
    
    render(<StockChart data={mockData} />);
    expect(screen.getByTestId('stock-chart')).toBeInTheDocument();
  });
});
```

## 集成测试策略

### API集成测试
```typescript
// apps/server/src/__tests__/integration/stocks-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { testClient } from '../helpers/test-client';

describe('Stocks API Integration', () => {
  beforeAll(async () => {
    // 启动测试数据库
    await setupTestDatabase();
  });
  
  afterAll(async () => {
    // 清理测试数据
    await cleanupTestDatabase();
  });
  
  it('should return stock list', async () => {
    const response = await testClient.stocks.list.query();
    expect(response).toHaveLength(10);
  });
  
  it('should handle invalid stock codes', async () => {
    await expect(
      testClient.stocks.detail.query({ code: 'INVALID' })
    ).rejects.toThrow('Invalid stock code');
  });
});
```

### 数据库集成测试
```typescript
// apps/server/src/__tests__/integration/database.test.ts
import { describe, it, expect } from 'bun:test';
import { db } from '../../db';
import { stocksTable } from '../../db/schema/stocks';

describe('Database Integration', () => {
  it('should insert and retrieve stock data', async () => {
    const stockData = {
      code: '000001.SZ',
      name: '平安银行',
      industry: '银行',
      listDate: '1991-04-03'
    };
    
    await db.insert(stocksTable).values(stockData);
    const retrieved = await db.select().from(stocksTable)
      .where(eq(stocksTable.code, '000001.SZ'));
    
    expect(retrieved[0]).toMatchObject(stockData);
  });
});
```

## Mock策略

### 外部API Mock
```typescript
// apps/server/src/__tests__/mocks/tushare-mock.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const tushareHandlers = [
  http.post('https://api.tushare.pro', ({ request }) => {
    const url = new URL(request.url);
    
    // Mock股票基础信息
    if (request.body.api_name === 'stock_basic') {
      return HttpResponse.json({
        data: {
          items: [
            ['000001.SZ', '平安银行', '银行', '1991-04-03'],
            ['000002.SZ', '万科A', '房地产', '1991-01-29']
          ]
        }
      });
    }
    
    // Mock日线数据
    if (request.body.api_name === 'daily') {
      return HttpResponse.json({
        data: {
          items: [
            ['000001.SZ', '2024-01-01', 10.0, 10.5, 10.8, 9.8, 1000000]
          ]
        }
      });
    }
    
    return HttpResponse.json({ error: 'Unknown API' }, { status: 404 });
  })
];

export const mockServer = setupServer(...tushareHandlers);

// 测试辅助函数
export class TushareMockServer {
  private server = mockServer;
  
  async start(): Promise<void> {
    this.server.listen();
  }
  
  async stop(): Promise<void> {
    this.server.close();
  }
  
  setupStockDataEndpoints(): void {
    // 设置股票数据端点
  }
  
  simulateFailureScenarios(): void {
    this.server.use(
      http.post('https://api.tushare.pro', () => {
        return HttpResponse.json(
          { error: 'Service Unavailable' }, 
          { status: 503 }
        );
      })
    );
  }
  
  simulateRateLimit(): void {
    this.server.use(
      http.post('https://api.tushare.pro', () => {
        return HttpResponse.json(
          { error: 'Rate limit exceeded' }, 
          { status: 429 }
        );
      })
    );
  }
}
```

## E2E测试策略

### 关键用户流程测试
```typescript
// apps/web/src/__tests__/e2e/user-journey.spec.ts
import { test, expect } from '@playwright/test';

test.describe('股票分析用户流程', () => {
  test('用户可以搜索股票并查看详情', async ({ page }) => {
    // 1. 登录
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // 2. 导航到股票搜索
    await page.click('[data-testid="stocks-nav"]');
    await expect(page).toHaveURL('/stocks');
    
    // 3. 搜索股票
    await page.fill('[data-testid="stock-search"]', '平安银行');
    await page.click('[data-testid="search-button"]');
    
    // 4. 验证搜索结果
    await expect(page.locator('[data-testid="stock-item"]')).toContainText('000001.SZ');
    
    // 5. 点击查看详情
    await page.click('[data-testid="stock-item"]:first-child');
    await expect(page).toHaveURL(/\/stocks\/000001\.SZ/);
    
    // 6. 验证股票详情页面
    await expect(page.locator('[data-testid="stock-name"]')).toContainText('平安银行');
    await expect(page.locator('[data-testid="stock-chart"]')).toBeVisible();
  });
  
  test('用户可以创建和运行回测', async ({ page }) => {
    // 回测流程测试
    await page.goto('/stocks/000001.SZ');
    await page.click('[data-testid="create-backtest"]');
    
    // 配置策略
    await page.selectOption('[data-testid="strategy-type"]', 'ma_crossover');
    await page.fill('[data-testid="ma-short"]', '5');
    await page.fill('[data-testid="ma-long"]', '20');
    
    // 运行回测
    await page.click('[data-testid="run-backtest"]');
    
    // 验证结果
    await expect(page.locator('[data-testid="backtest-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="sharpe-ratio"]')).toContainText(/\d+\.\d+/);
  });
});
```

### 性能测试
```typescript
// apps/web/src/__tests__/e2e/performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('性能测试', () => {
  test('首页加载性能', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(2000); // 2秒内加载完成
  });
  
  test('股票图表渲染性能', async ({ page }) => {
    await page.goto('/stocks/000001.SZ');
    
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="stock-chart"]');
    const renderTime = Date.now() - startTime;
    
    expect(renderTime).toBeLessThan(1000); // 1秒内渲染完成
  });
});
```

## 测试环境配置

### 测试数据库设置
```typescript
// apps/server/src/__tests__/helpers/test-database.ts
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

export async function setupTestDatabase() {
  const testDb = new Database(':memory:');
  const db = drizzle(testDb);
  
  // 运行迁移
  await migrate(db, { migrationsFolder: './drizzle' });
  
  // 插入测试数据
  await seedTestData(db);
  
  return db;
}

export async function cleanupTestDatabase() {
  // 清理测试数据
}

async function seedTestData(db: any) {
  // 插入测试股票数据
  await db.insert(stocksTable).values([
    { code: '000001.SZ', name: '平安银行', industry: '银行' },
    { code: '000002.SZ', name: '万科A', industry: '房地产' }
  ]);
}
```

## CI/CD集成

### GitHub Actions测试配置
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
        
      - name: Run unit tests
        run: bun test:unit
        
      - name: Generate coverage report
        run: bun test:coverage
        
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
  
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      - name: Start test services
        run: |
          bun run test:setup
          bun run test:integration
          
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      - name: Install Playwright
        run: bunx playwright install
        
      - name: Run E2E tests
        run: bun test:e2e
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## 测试脚本配置

### package.json测试脚本
```json
{
  "scripts": {
    "test": "bun test",
    "test:unit": "bun test --coverage apps/*/src/**/*.test.ts",
    "test:integration": "bun test apps/*/src/**/*.integration.test.ts",
    "test:e2e": "playwright test",
    "test:coverage": "bun test --coverage --coverage-dir=coverage",
    "test:watch": "bun test --watch",
    "test:setup": "bun run scripts/test-setup.ts",
    "test:teardown": "bun run scripts/test-teardown.ts"
  }
}
```

## 质量指标

### 覆盖率要求
- **总体覆盖率**: >80%
- **核心业务逻辑**: >90%
- **关键路径**: 100%
- **分支覆盖率**: >75%

### 性能指标
- **单元测试执行时间**: <30秒
- **集成测试执行时间**: <2分钟
- **E2E测试执行时间**: <10分钟
- **并行测试执行**: 支持多进程并行

### 质量门禁
- 所有测试必须通过
- 覆盖率不得低于设定阈值
- 新增代码必须包含测试
- 关键路径修改需要100%测试覆盖

## 最佳实践

### 测试编写原则
1. **AAA模式**: Arrange, Act, Assert
2. **单一职责**: 每个测试只验证一个功能点
3. **独立性**: 测试之间不应有依赖关系
4. **可重复性**: 测试结果应该一致和可预测
5. **清晰命名**: 测试名称应该描述被测行为

### Mock使用指南
1. **外部服务**: 始终Mock外部API调用
2. **数据库**: 使用内存数据库进行快速测试
3. **时间依赖**: Mock Date和Timer函数
4. **随机值**: Mock随机数生成器
5. **网络请求**: 使用MSW进行HTTP Mock

### 测试维护
1. **定期审查**: 每月审查测试覆盖率和质量
2. **重构测试**: 随代码重构同步更新测试
3. **删除冗余**: 移除重复或无效的测试
4. **性能优化**: 优化慢速测试的执行时间
5. **文档更新**: 保持测试文档与实现同步

这个测试策略确保了 neostock 项目的高质量交付，满足 PO 验证要求，并为生产环境提供可靠的质量保障。