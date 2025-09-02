import { test, expect } from '@playwright/test';

test.describe('股票搜索和详情页面 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 模拟用户登录
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('完整搜索流程：从搜索到详情页', async ({ page }) => {
    // 1. 导航到股票页面
    await page.click('[data-testid="nav-stocks"]');
    await expect(page).toHaveURL('/stocks');
    await expect(page.locator('[data-testid="stock-search-input"]')).toBeVisible();

    // 2. 执行股票搜索
    const searchInput = page.locator('[data-testid="stock-search-input"]');
    await searchInput.fill('平安银行');
    
    // 等待搜索结果加载
    await page.waitForSelector('[data-testid="search-result-item"]');
    
    // 验证搜索结果
    const searchResults = page.locator('[data-testid="search-result-item"]');
    await expect(searchResults.first()).toBeVisible();
    await expect(searchResults.first()).toContainText('平安银行');

    // 3. 点击搜索结果进入详情页
    await searchResults.first().click();
    
    // 验证导航到详情页
    await expect(page).toHaveURL(/\/stocks\/.+/);
    await expect(page.locator('[data-testid="stock-detail-header"]')).toBeVisible();

    // 4. 验证股票基本信息显示
    await expect(page.locator('[data-testid="stock-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="stock-code"]')).toBeVisible();
    await expect(page.locator('[data-testid="stock-price"]')).toBeVisible();

    // 5. 测试收藏功能
    const favoriteButton = page.locator('[data-testid="favorite-button"]');
    await favoriteButton.click();
    await expect(favoriteButton).toHaveClass(/active/);

    // 6. 测试时间周期切换
    const timePeriodSelect = page.locator('[data-testid="time-period-select"]');
    await timePeriodSelect.selectOption('1d');
    await expect(page.locator('[data-testid="chart-container"]')).toBeVisible();

    // 7. 测试浏览器后退功能
    await page.goBack();
    await expect(page).toHaveURL('/stocks');
    await expect(searchInput).toHaveValue('平安银行');

    // 8. 测试浏览器前进功能
    await page.goForward();
    await expect(page).toHaveURL(/\/stocks\/.+/);
    await expect(page.locator('[data-testid="stock-detail-header"]')).toBeVisible();
  });

  test('搜索性能和响应时间', async ({ page }) => {
    await page.click('[data-testid="nav-stocks"]');
    await expect(page).toHaveURL('/stocks');

    const searchInput = page.locator('[data-testid="stock-search-input"]');
    
    // 测试搜索响应时间 <100ms
    const startTime = Date.now();
    await searchInput.fill('000001');
    await page.waitForSelector('[data-testid="search-result-item"]');
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(200); // 包含UI渲染时间
    
    // 验证搜索结果准确性
    const searchResults = page.locator('[data-testid="search-result-item"]');
    await expect(searchResults.first()).toContainText('000001');
  });

  test('移动端响应式体验', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.click('[data-testid="nav-stocks"]');
    await expect(page).toHaveURL('/stocks');

    const searchInput = page.locator('[data-testid="stock-search-input"]');
    await searchInput.fill('平安银行');
    
    await page.waitForSelector('[data-testid="search-result-item"]');
    const searchResults = page.locator('[data-testid="search-result-item"]');
    
    // 验证移动端触摸目标大小
    const firstResult = searchResults.first();
    const boundingBox = await firstResult.boundingBox();
    expect(boundingBox.height).toBeGreaterThanOrEqual(44); // 最小触摸目标
    expect(boundingBox.width).toBeGreaterThanOrEqual(44);
    
    // 点击进入详情页
    await firstResult.click();
    await expect(page).toHaveURL(/\/stocks\/.+/);
    
    // 验证移动端详情页布局
    await expect(page.locator('[data-testid="stock-detail-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-optimized-layout"]')).toBeVisible();
  });

  test('错误处理和边界情况', async ({ page }) => {
    await page.click('[data-testid="nav-stocks"]');
    await expect(page).toHaveURL('/stocks');

    const searchInput = page.locator('[data-testid="stock-search-input"]');
    
    // 测试无效股票代码
    await searchInput.fill('INVALID_CODE');
    await page.waitForTimeout(500); // 等待防抖
    
    // 应该显示无结果提示
    await expect(page.locator('[data-testid="no-results-message"]')).toBeVisible();
    
    // 测试空搜索
    await searchInput.fill('');
    await expect(page.locator('[data-testid="search-result-item"]')).not.toBeVisible();
    
    // 测试网络错误恢复
    await page.route('**/api/trpc/stocks.search**', route => route.abort());
    await searchInput.fill('平安银行');
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    
    // 恢复网络连接
    await page.unroute('**/api/trpc/stocks.search**');
    await searchInput.fill('平安银行');
    await expect(page.locator('[data-testid="search-result-item"]')).toBeVisible();
  });

  test('搜索历史和快捷功能', async ({ page }) => {
    await page.click('[data-testid="nav-stocks"]');
    await expect(page).toHaveURL('/stocks');

    const searchInput = page.locator('[data-testid="stock-search-input"]');
    
    // 执行几次搜索建立历史
    await searchInput.fill('平安银行');
    await page.waitForSelector('[data-testid="search-result-item"]');
    await searchInput.fill('');
    
    await searchInput.fill('000001');
    await page.waitForSelector('[data-testid="search-result-item"]');
    await searchInput.fill('');
    
    // 验证搜索历史显示
    await expect(page.locator('[data-testid="search-history"]')).toBeVisible();
    const historyItems = page.locator('[data-testid="history-item"]');
    await expect(historyItems).toHaveCount(2);
    
    // 点击历史记录
    await historyItems.first().click();
    await expect(searchInput).toHaveValue('平安银行');
  });
});