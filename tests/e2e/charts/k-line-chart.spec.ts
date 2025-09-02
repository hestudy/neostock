import { test, expect } from '@playwright/test';

test.describe('K线图表 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 模拟股票数据
    await page.route('**/api/stocks/chart-data**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000000 },
            { time: '2024-01-02', open: 105, high: 115, low: 95, close: 110, volume: 1200000 },
            { time: '2024-01-03', open: 110, high: 120, low: 100, close: 115, volume: 1100000 },
            { time: '2024-01-04', open: 115, high: 125, low: 105, close: 120, volume: 1300000 },
            { time: '2024-01-05', open: 120, high: 130, low: 110, close: 125, volume: 1400000 }
          ]
        })
      });
    });

    // 模拟技术指标数据
    await page.route('**/api/stocks/technical-indicators**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { time: '2024-01-01', ma5: 102, ma10: 100, ma20: 98, ma60: 95 },
            { time: '2024-01-02', ma5: 107, ma10: 103, ma20: 100, ma60: 96 },
            { time: '2024-01-03', ma5: 110, ma10: 105, ma20: 102, ma60: 97 },
            { time: '2024-01-04', ma5: 115, ma10: 108, ma20: 104, ma60: 98 },
            { time: '2024-01-05', ma5: 118, ma10: 112, ma20: 106, ma60: 99 }
          ]
        })
      });
    });

    // 导航到股票详情页
    await page.goto('/stocks/000001.SZ');
    await page.waitForSelector('[data-testid="k-line-chart"]');
  });

  test('应该正确显示K线图表', async ({ page }) => {
    const chartContainer = await page.locator('[data-testid="k-line-chart"]');
    await expect(chartContainer).toBeVisible();
    
    // 验证图表尺寸
    const boundingBox = await chartContainer.boundingBox();
    expect(boundingBox?.width).toBeGreaterThan(0);
    expect(boundingBox?.height).toBeGreaterThan(0);
  });

  test('应该支持技术指标切换', async ({ page }) => {
    // 等待图表加载完成
    await page.waitForSelector('[data-testid="k-line-chart"]');
    
    // 点击MA指标开关
    const maToggle = await page.locator('[data-testid="indicator-ma-toggle"]');
    await maToggle.click();
    
    // 验证MA指标显示
    await expect(page.locator('[data-testid="ma-indicator"]')).toBeVisible();
    
    // 点击MACD指标开关
    const macdToggle = await page.locator('[data-testid="indicator-macd-toggle"]');
    await macdToggle.click();
    
    // 验证MACD指标显示
    await expect(page.locator('[data-testid="macd-indicator"]')).toBeVisible();
    
    // 点击RSI指标开关
    const rsiToggle = await page.locator('[data-testid="indicator-rsi-toggle"]');
    await rsiToggle.click();
    
    // 验证RSI指标显示
    await expect(page.locator('[data-testid="rsi-indicator"]')).toBeVisible();
  });

  test('应该支持图表缩放功能', async ({ page }) => {
    const chartContainer = await page.locator('[data-testid="k-line-chart"]');
    
    // 获取初始图表状态
    const initialBoundingBox = await chartContainer.boundingBox();
    
    // 模拟滚轮缩放
    await chartContainer.hover();
    await page.mouse.wheel(0, -100); // 向上滚动放大
    
    // 等待缩放动画完成
    await page.waitForTimeout(500);
    
    // 验证图表仍然可见
    await expect(chartContainer).toBeVisible();
  });

  test('应该支持图表拖拽平移', async ({ page }) => {
    const chartContainer = await page.locator('[data-testid="k-line-chart"]');
    
    // 获取图表中心位置
    const boundingBox = await chartContainer.boundingBox();
    const centerX = boundingBox!.x + boundingBox!.width / 2;
    const centerY = boundingBox!.y + boundingBox!.height / 2;
    
    // 模拟拖拽操作
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 100, centerY, { steps: 10 });
    await page.mouse.up();
    
    // 验证图表仍然可见
    await expect(chartContainer).toBeVisible();
  });

  test('应该支持十字光标显示', async ({ page }) => {
    const chartContainer = await page.locator('[data-testid="k-line-chart"]');
    
    // 获取图表位置
    const boundingBox = await chartContainer.boundingBox();
    const centerX = boundingBox!.x + boundingBox!.width / 2;
    const centerY = boundingBox!.y + boundingBox!.height / 2;
    
    // 移动鼠标到图表中心
    await page.mouse.move(centerX, centerY);
    
    // 等待十字光标显示
    await page.waitForTimeout(300);
    
    // 验证十字光标显示（通过检查特定的光标元素）
    const crosshair = await page.locator('[data-testid="chart-crosshair"]');
    await expect(crosshair).toBeVisible();
  });

  test('应该支持双击重置视图', async ({ page }) => {
    const chartContainer = await page.locator('[data-testid="k-line-chart"]');
    
    // 获取图表中心位置
    const boundingBox = await chartContainer.boundingBox();
    const centerX = boundingBox!.x + boundingBox!.width / 2;
    const centerY = boundingBox!.y + boundingBox!.height / 2;
    
    // 双击图表中心
    await page.mouse.move(centerX, centerY);
    await page.dblclick(centerX, centerY);
    
    // 等待重置动画完成
    await page.waitForTimeout(500);
    
    // 验证图表仍然可见
    await expect(chartContainer).toBeVisible();
  });

  test.describe('移动端测试', () => {
    test.beforeEach(async ({ page }) => {
      // 模拟移动设备
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('应该在移动端正确显示图表', async ({ page }) => {
      const chartContainer = await page.locator('[data-testid="k-line-chart"]');
      await expect(chartContainer).toBeVisible();
      
      // 验证移动端适配
      const boundingBox = await chartContainer.boundingBox();
      expect(boundingBox?.width).toBeLessThanOrEqual(375);
    });

    test('应该支持触摸手势操作', async ({ page }) => {
      const chartContainer = await page.locator('[data-testid="k-line-chart"]');
      const boundingBox = await chartContainer.boundingBox();
      
      // 模拟单点触摸
      await page.touch.tap(boundingBox!.x + 100, boundingBox!.y + 100);
      
      // 等待触摸响应
      await page.waitForTimeout(300);
      
      // 验证图表仍然可见
      await expect(chartContainer).toBeVisible();
    });

    test('应该支持触摸缩放', async ({ page }) => {
      const chartContainer = await page.locator('[data-testid="k-line-chart"]');
      const boundingBox = await chartContainer.boundingBox();
      
      // 模拟捏合手势
      await page.touch.tap(boundingBox!.x + 100, boundingBox!.y + 100);
      await page.touch.tap(boundingBox!.x + 200, boundingBox!.y + 100);
      
      // 等待缩放响应
      await page.waitForTimeout(500);
      
      // 验证图表仍然可见
      await expect(chartContainer).toBeVisible();
    });

    test('应该支持触摸滑动', async ({ page }) => {
      const chartContainer = await page.locator('[data-testid="k-line-chart"]');
      const boundingBox = await chartContainer.boundingBox();
      
      // 模拟滑动操作
      await page.touch.tap(boundingBox!.x + 200, boundingBox!.y + 100);
      await page.touch.move(boundingBox!.x + 100, boundingBox!.y + 100);
      
      // 等待滑动响应
      await page.waitForTimeout(300);
      
      // 验证图表仍然可见
      await expect(chartContainer).toBeVisible();
    });
  });

  test.describe('主题切换测试', () => {
    test('应该支持主题切换', async ({ page }) => {
      // 等待图表加载完成
      await page.waitForSelector('[data-testid="k-line-chart"]');
      
      // 点击主题切换按钮
      const themeToggle = await page.locator('[data-testid="theme-toggle"]');
      await themeToggle.click();
      
      // 等待主题切换完成
      await page.waitForTimeout(500);
      
      // 验证图表在主题切换后仍然可见
      const chartContainer = await page.locator('[data-testid="k-line-chart"]');
      await expect(chartContainer).toBeVisible();
    });

    test('应该在主题切换时保持数据完整性', async ({ page }) => {
      // 等待图表加载完成
      await page.waitForSelector('[data-testid="k-line-chart"]');
      
      // 获取初始图表数据
      const initialData = await page.evaluate(() => {
        return window.performance.getEntriesByType('resource');
      });
      
      // 切换主题
      const themeToggle = await page.locator('[data-testid="theme-toggle"]');
      await themeToggle.click();
      
      // 等待主题切换完成
      await page.waitForTimeout(500);
      
      // 验证数据没有重新加载
      const finalData = await page.evaluate(() => {
        return window.performance.getEntriesByType('resource');
      });
      
      expect(finalData.length).toBe(initialData.length);
    });
  });

  test.describe('性能测试', () => {
    test('应该在大数据量下保持性能', async ({ page }) => {
      // 模拟大数据量
      await page.route('**/api/stocks/chart-data**', async (route) => {
        const largeData = Array.from({ length: 1000 }, (_, i) => ({
          time: `2024-01-${String(i + 1).padStart(2, '0')}`,
          open: 100 + Math.random() * 50,
          high: 110 + Math.random() * 50,
          low: 90 + Math.random() * 50,
          close: 105 + Math.random() * 50,
          volume: 1000000 + Math.random() * 500000
        }));
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: largeData })
        });
      });
      
      // 重新加载页面
      await page.goto('/stocks/000001.SZ');
      
      // 等待图表加载完成
      await page.waitForSelector('[data-testid="k-line-chart"]');
      
      // 测量加载时间
      const startTime = Date.now();
      await page.waitForLoadState('networkidle');
      const endTime = Date.now();
      
      // 验证加载时间在合理范围内
      expect(endTime - startTime).toBeLessThan(5000);
      
      // 验证图表可见
      const chartContainer = await page.locator('[data-testid="k-line-chart"]');
      await expect(chartContainer).toBeVisible();
    });

    test('应该在频繁操作时保持稳定', async ({ page }) => {
      const chartContainer = await page.locator('[data-testid="k-line-chart"]');
      const boundingBox = await chartContainer.boundingBox();
      
      // 模拟频繁操作
      for (let i = 0; i < 10; i++) {
        // 移动鼠标
        await page.mouse.move(
          boundingBox!.x + Math.random() * boundingBox!.width,
          boundingBox!.y + Math.random() * boundingBox!.height
        );
        
        // 点击
        await page.mouse.click(
          boundingBox!.x + Math.random() * boundingBox!.width,
          boundingBox!.y + Math.random() * boundingBox!.height
        );
        
        // 短暂等待
        await page.waitForTimeout(100);
      }
      
      // 验证图表仍然可见且稳定
      await expect(chartContainer).toBeVisible();
    });
  });

  test.describe('错误处理测试', () => {
    test('应该处理数据加载失败', async ({ page }) => {
      // 模拟API错误
      await page.route('**/api/stocks/chart-data**', async (route) => {
        await route.abort('failed');
      });
      
      // 重新加载页面
      await page.goto('/stocks/000001.SZ');
      
      // 等待错误状态
      await page.waitForSelector('[data-testid="chart-error"]');
      
      // 验证错误信息显示
      const errorMessage = await page.locator('[data-testid="chart-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toHaveText(/数据加载失败/);
      
      // 验证重试按钮存在
      const retryButton = await page.locator('[data-testid="retry-button"]');
      await expect(retryButton).toBeVisible();
    });

    test('应该处理网络错误', async ({ page }) => {
      // 模拟网络错误
      await page.route('**/api/stocks/chart-data**', async (route) => {
        await route.abort('net::ERR_INTERNET_DISCONNECTED');
      });
      
      // 重新加载页面
      await page.goto('/stocks/000001.SZ');
      
      // 等待错误状态
      await page.waitForSelector('[data-testid="chart-error"]');
      
      // 验证错误信息显示
      const errorMessage = await page.locator('[data-testid="chart-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('应该处理无效数据', async ({ page }) => {
      // 模拟无效数据
      await page.route('**/api/stocks/chart-data**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] })
        });
      });
      
      // 重新加载页面
      await page.goto('/stocks/000001.SZ');
      
      // 等待空状态
      await page.waitForSelector('[data-testid="chart-empty"]');
      
      // 验证空状态显示
      const emptyMessage = await page.locator('[data-testid="chart-empty"]');
      await expect(emptyMessage).toBeVisible();
      await expect(emptyMessage).toHaveText(/暂无数据/);
    });
  });

  test.describe('无障碍访问测试', () => {
    test('应该支持键盘导航', async ({ page }) => {
      const chartContainer = await page.locator('[data-testid="k-line-chart"]');
      
      // 使用Tab键聚焦到图表
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // 验证图表获得焦点
      await expect(chartContainer).toBeFocused();
      
      // 测试键盘操作
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      
      // 验证图表仍然可见
      await expect(chartContainer).toBeVisible();
    });

    test('应该提供适当的ARIA标签', async ({ page }) => {
      const chartContainer = await page.locator('[data-testid="k-line-chart"]');
      
      // 验证ARIA标签
      await expect(chartContainer).toHaveAttribute('role', 'img');
      await expect(chartContainer).toHaveAttribute('aria-label', 'K线图表');
    });
  });
});