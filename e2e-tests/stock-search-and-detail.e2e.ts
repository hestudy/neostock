import { test, expect } from '@playwright/test';

test.describe('股票搜索和详情页面 - E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 模拟 API 响应
    await page.route('**/api/stocks/search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              ts_code: '000001.SZ',
              symbol: '000001',
              name: '平安银行',
              area: '深圳',
              industry: '银行',
              market: 'SZSE'
            },
            {
              ts_code: '600000.SH',
              symbol: '600000',
              name: '浦发银行',
              area: '上海',
              industry: '银行',
              market: 'SSE'
            }
          ]
        })
      });
    });

    await page.route('**/api/stocks/detail', async (route) => {
      const url = route.request().url();
      const code = url.split('code=')[1];
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ts_code: code,
            symbol: code.split('.')[0],
            name: code.includes('000001') ? '平安银行' : '浦发银行',
            area: code.includes('SZ') ? '深圳' : '上海',
            industry: '银行',
            market: code.includes('SZ') ? 'SZSE' : 'SSE',
            list_date: '1991-04-03'
          }
        })
      });
    });

    await page.goto('/');
  });

  test('应该能够成功搜索股票', async ({ page }) => {
    // 等待页面加载
    await page.waitForSelector('[data-testid="stock-search-input"]');
    
    // 输入搜索关键词
    await page.fill('[data-testid="stock-search-input"]', '平安银行');
    
    // 等待搜索结果
    await page.waitForSelector('[data-testid="search-result-item"]');
    
    // 验证搜索结果
    const results = await page.locator('[data-testid="search-result-item"]').count();
    expect(results).toBeGreaterThan(0);
    
    // 验证搜索结果包含正确的股票信息
    const firstResult = await page.locator('[data-testid="search-result-item"]').first();
    await expect(firstResult).toContainText('平安银行');
    await expect(firstResult).toContainText('000001.SZ');
  });

  test('应该能够点击搜索结果进入详情页', async ({ page }) => {
    // 搜索股票
    await page.fill('[data-testid="stock-search-input"]', '平安银行');
    await page.waitForSelector('[data-testid="search-result-item"]');
    
    // 点击第一个搜索结果
    await page.click('[data-testid="search-result-item"]:first-child');
    
    // 等待导航到详情页
    await page.waitForURL('/stocks/**');
    
    // 验证详情页加载
    await expect(page.locator('[data-testid="stock-detail-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="stock-detail-header"]')).toContainText('平安银行');
  });

  test('应该支持搜索建议功能', async ({ page }) => {
    // 输入部分关键词
    await page.fill('[data-testid="stock-search-input"]', '平安');
    
    // 等待搜索建议
    await page.waitForSelector('[data-testid="search-suggestion"]');
    
    // 验证搜索建议显示
    const suggestions = await page.locator('[data-testid="search-suggestion"]').count();
    expect(suggestions).toBeGreaterThan(0);
  });

  test('应该能够通过股票代码搜索', async ({ page }) => {
    // 输入股票代码
    await page.fill('[data-testid="stock-search-input"]', '000001');
    
    // 等待搜索结果
    await page.waitForSelector('[data-testid="search-result-item"]');
    
    // 验证搜索结果
    const results = await page.locator('[data-testid="search-result-item"]').count();
    expect(results).toBeGreaterThan(0);
    
    // 验证结果包含正确的股票代码
    const firstResult = await page.locator('[data-testid="search-result-item"]').first();
    await expect(firstResult).toContainText('000001.SZ');
  });

  test('应该处理无搜索结果的情况', async ({ page }) => {
    // 模拟无结果响应
    await page.unroute('**/api/stocks/search');
    await page.route('**/api/stocks/search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: []
        })
      });
    });

    // 输入不存在的关键词
    await page.fill('[data-testid="stock-search-input"]', '不存在的股票');
    
    // 等待搜索结果处理
    await page.waitForTimeout(1000);
    
    // 验证无结果提示
    await expect(page.locator('[data-testid="no-results-message"]')).toBeVisible();
  });

  test('应该支持移动端搜索优化', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 验证移动端搜索组件
    await expect(page.locator('[data-testid="mobile-search-input"]')).toBeVisible();
    
    // 测试移动端搜索
    await page.fill('[data-testid="mobile-search-input"]', '平安银行');
    await page.waitForSelector('[data-testid="mobile-search-result"]');
    
    // 验证移动端搜索结果
    const mobileResults = await page.locator('[data-testid="mobile-search-result"]').count();
    expect(mobileResults).toBeGreaterThan(0);
  });

  test('应该支持股票详情页面的面包屑导航', async ({ page }) => {
    // 导航到股票详情页
    await page.goto('/stocks/000001.SZ');
    
    // 等待详情页加载
    await page.waitForSelector('[data-testid="stock-detail-header"]');
    
    // 验证面包屑导航
    await expect(page.locator('[data-testid="breadcrumb-home"]')).toBeVisible();
    await expect(page.locator('[data-testid="breadcrumb-current"]')).toBeVisible();
    await expect(page.locator('[data-testid="breadcrumb-current"]')).toContainText('000001.SZ');
    
    // 测试面包屑导航点击
    await page.click('[data-testid="breadcrumb-home"]');
    await page.waitForURL('/');
  });

  test('应该支持股票列表分页', async ({ page }) => {
    // 模拟分页数据
    await page.unroute('**/api/stocks/list');
    await page.route('**/api/stocks/list', async (route) => {
      const url = new URL(route.request().url());
      const pageParam = url.searchParams.get('page') || '1';
      const limit = url.searchParams.get('limit') || '20';
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            stocks: Array.from({ length: parseInt(limit) }, (_, i) => ({
              ts_code: `000${String(parseInt(pageParam) * parseInt(limit) + i + 1).padStart(3, '0')}.SZ`,
              symbol: `000${String(parseInt(pageParam) * parseInt(limit) + i + 1).padStart(3, '0')}`,
              name: `测试股票${String(parseInt(pageParam) * parseInt(limit) + i + 1).padStart(3, '0')}`,
              area: '深圳',
              industry: '测试',
              market: 'SZSE'
            })),
            pagination: {
              page: parseInt(pageParam),
              limit: parseInt(limit),
              total: 100,
              totalPages: 5
            }
          }
        })
      });
    });

    // 导航到股票列表页
    await page.goto('/stocks');
    
    // 等待列表加载
    await page.waitForSelector('[data-testid="stock-list-item"]');
    
    // 验证分页控件
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
    
    // 测试分页导航
    await page.click('[data-testid="next-page"]');
    await page.waitForURL('/stocks?page=2');
    
    // 验证页面内容更新
    await page.waitForSelector('[data-testid="stock-list-item"]');
    const items = await page.locator('[data-testid="stock-list-item"]').count();
    expect(items).toBeGreaterThan(0);
  });

  test('应该支持实时更新功能', async ({ page }) => {
    // 导航到股票详情页
    await page.goto('/stocks/000001.SZ');
    
    // 等待详情页加载
    await page.waitForSelector('[data-testid="stock-detail-header"]');
    
    // 模拟实时更新
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('stock-update', {
        detail: {
          code: '000001.SZ',
          price: 12.50,
          change: 0.25,
          changePercent: 2.04
        }
      }));
    });
    
    // 验证实时更新显示
    await expect(page.locator('[data-testid="real-time-price"]')).toBeVisible();
    await expect(page.locator('[data-testid="real-time-change"]')).toBeVisible();
  });

  test('应该支持错误处理和重试机制', async ({ page }) => {
    // 模拟 API 错误
    await page.unroute('**/api/stocks/search');
    await page.route('**/api/stocks/search', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: '服务器内部错误'
        })
      });
    });

    // 尝试搜索
    await page.fill('[data-testid="stock-search-input"]', '测试');
    await page.waitForTimeout(1000);
    
    // 验证错误提示
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // 测试重试功能
    await page.unroute('**/api/stocks/search');
    await page.route('**/api/stocks/search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: []
        })
      });
    });
    
    await page.click('[data-testid="retry-button"]');
    await page.waitForTimeout(1000);
    
    // 验证错误消息消失
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });

  test('应该支持键盘导航', async ({ page }) => {
    // 搜索股票
    await page.fill('[data-testid="stock-search-input"]', '平安银行');
    await page.waitForSelector('[data-testid="search-result-item"]');
    
    // 测试键盘导航
    await page.press('[data-testid="stock-search-input"]', 'ArrowDown');
    await expect(page.locator('[data-testid="search-result-item"]:first-child')).toHaveClass(/selected/);
    
    // 测试回车键选择
    await page.press('[data-testid="stock-search-input"]', 'Enter');
    await page.waitForURL('/stocks/**');
    
    // 验证导航到详情页
    await expect(page.locator('[data-testid="stock-detail-header"]')).toBeVisible();
  });
});