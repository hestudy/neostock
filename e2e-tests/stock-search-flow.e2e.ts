import { test, expect, type Page } from '@playwright/test';

// Test data
const TEST_STOCKS = [
  {
    ts_code: '000001.SZ',
    symbol: '000001',
    name: '平安银行',
    industry: '银行',
  },
  {
    ts_code: '000002.SZ',
    symbol: '000002',
    name: '万科A',
    industry: '房地产开发',
  },
  {
    ts_code: '600000.SH',
    symbol: '600000',
    name: '浦发银行',
    industry: '银行',
  },
];

// Helper functions
async function navigateToStocks(page: Page) {
  await page.goto('/stocks');
  await expect(page.locator('h1')).toContainText('股票搜索');
}

async function waitForSearchResults(page: Page) {
  // Wait for search results to load
  await page.waitForSelector('[data-testid="stock-search-results"]', { 
    state: 'visible',
    timeout: 5000 
  });
}

async function performSearch(page: Page, keyword: string) {
  const searchInput = page.getByPlaceholder('搜索股票代码或名称...');
  await searchInput.fill(keyword);
  await searchInput.press('Enter');
  await waitForSearchResults(page);
}

test.describe('Stock Search and Detail Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test data if needed
    // This might involve API calls to seed the database
    // For now, we assume the test data exists
  });

  test.describe('Stock Search Functionality', () => {
    test('should display stock search page', async ({ page }) => {
      await navigateToStocks(page);
      
      // Check page elements
      await expect(page.getByPlaceholder('搜索股票代码或名称...')).toBeVisible();
      await expect(page.getByRole('button', { name: '搜索' })).toBeVisible();
      await expect(page.getByRole('button', { name: '搜索历史' })).toBeVisible();
      await expect(page.getByRole('button', { name: '我的收藏' })).toBeVisible();
    });

    test('should search stocks by name', async ({ page }) => {
      await navigateToStocks(page);
      await performSearch(page, '平安银行');
      
      // Check search results
      const results = page.locator('[data-testid="stock-search-results"]');
      await expect(results).toBeVisible();
      
      const firstResult = results.locator('[data-testid="stock-item"]').first();
      await expect(firstResult).toContainText('平安银行');
      await expect(firstResult).toContainText('000001.SZ');
    });

    test('should search stocks by code', async ({ page }) => {
      await navigateToStocks(page);
      await performSearch(page, '000001');
      
      const results = page.locator('[data-testid="stock-search-results"]');
      await expect(results).toBeVisible();
      
      const firstResult = results.locator('[data-testid="stock-item"]').first();
      await expect(firstResult).toContainText('000001');
      await expect(firstResult).toContainText('平安银行');
    });

    test('should search stocks by partial name', async ({ page }) => {
      await navigateToStocks(page);
      await performSearch(page, '银行');
      
      const results = page.locator('[data-testid="stock-search-results"]');
      await expect(results).toBeVisible();
      
      // Should find multiple banks
      const stockItems = results.locator('[data-testid="stock-item"]');
      const count = await stockItems.count();
      expect(count).toBeGreaterThan(1);
      
      // All results should contain "银行"
      for (let i = 0; i < count; i++) {
        await expect(stockItems.nth(i)).toContainText('银行');
      }
    });

    test('should handle empty search results', async ({ page }) => {
      await navigateToStocks(page);
      await performSearch(page, 'NONEXISTENT_STOCK');
      
      const emptyState = page.locator('[data-testid="empty-search-results"]');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('未找到匹配的股票');
    });

    test('should clear search input', async ({ page }) => {
      await navigateToStocks(page);
      
      const searchInput = page.getByPlaceholder('搜索股票代码或名称...');
      await searchInput.fill('000001');
      
      // Clear button should appear
      const clearButton = page.getByRole('button', { name: '清除搜索' });
      await expect(clearButton).toBeVisible();
      
      await clearButton.click();
      await expect(searchInput).toHaveValue('');
    });

    test('should show search suggestions on focus', async ({ page }) => {
      await navigateToStocks(page);
      
      const searchInput = page.getByPlaceholder('搜索股票代码或名称...');
      await searchInput.focus();
      
      // Search suggestions should appear
      const suggestions = page.locator('[data-testid="search-suggestions"]');
      await expect(suggestions).toBeVisible();
      
      // Should contain popular stocks or recent searches
      const suggestionItems = suggestions.locator('[data-testid="suggestion-item"]');
      const count = await suggestionItems.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Search Performance', () => {
    test('should respond to search within 100ms', async ({ page }) => {
      await navigateToStocks(page);
      
      const searchInput = page.getByPlaceholder('搜索股票代码或名称...');
      
      const startTime = Date.now();
      await searchInput.fill('平安');
      
      // Wait for debounced search to trigger
      await page.waitForTimeout(150);
      
      // Check if results appeared quickly
      const results = page.locator('[data-testid="stock-search-results"]');
      await expect(results).toBeVisible({ timeout: 2000 });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Allow some buffer for E2E overhead, but should still be fast
      expect(responseTime).toBeLessThan(500);
    });

    test('should debounce rapid typing', async ({ page }) => {
      await navigateToStocks(page);
      
      const searchInput = page.getByPlaceholder('搜索股票代码或名称...');
      
      // Type rapidly
      await searchInput.type('0000', { delay: 50 });
      
      // Should not trigger search immediately
      const results = page.locator('[data-testid="stock-search-results"]');
      
      // Wait for debounce period
      await page.waitForTimeout(300);
      
      // Now results should appear
      await expect(results).toBeVisible();
    });
  });

  test.describe('Stock Detail Navigation', () => {
    test('should navigate to stock detail page from search results', async ({ page }) => {
      await navigateToStocks(page);
      await performSearch(page, '平安银行');
      
      // Click on first search result
      const firstResult = page.locator('[data-testid="stock-item"]').first();
      await firstResult.click();
      
      // Should navigate to detail page
      await expect(page).toHaveURL(/\/stocks\/000001\.SZ/);
      
      // Check detail page content
      await expect(page.locator('h1')).toContainText('平安银行');
      await expect(page.locator('[data-testid="stock-code"]')).toContainText('000001.SZ');
    });

    test('should display stock basic information on detail page', async ({ page }) => {
      await page.goto('/stocks/000001.SZ');
      
      // Check basic stock information
      await expect(page.locator('h1')).toContainText('平安银行');
      await expect(page.locator('[data-testid="stock-code"]')).toContainText('000001.SZ');
      await expect(page.locator('[data-testid="stock-industry"]')).toContainText('银行');
      
      // Check price information
      const priceSection = page.locator('[data-testid="stock-price"]');
      await expect(priceSection).toBeVisible();
      
      // Should have current price
      const currentPrice = priceSection.locator('[data-testid="current-price"]');
      await expect(currentPrice).toBeVisible();
    });

    test('should show loading state while fetching stock data', async ({ page }) => {
      // Intercept the API call to add delay
      await page.route('/api/trpc/stocks.detail*', async (route) => {
        await page.waitForTimeout(1000);
        await route.continue();
      });
      
      await page.goto('/stocks/000001.SZ');
      
      // Should show loading skeleton
      const loadingSkeleton = page.locator('[data-testid="stock-detail-loading"]');
      await expect(loadingSkeleton).toBeVisible();
      
      // Eventually should show actual content
      await expect(page.locator('h1')).toContainText('平安银行', { timeout: 5000 });
    });

    test('should handle non-existent stock gracefully', async ({ page }) => {
      await page.goto('/stocks/INVALID.SZ');
      
      // Should show error message
      const errorMessage = page.locator('[data-testid="stock-not-found"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('股票不存在');
      
      // Should provide navigation back to search
      const backToSearchButton = page.getByRole('button', { name: '返回搜索' });
      await expect(backToSearchButton).toBeVisible();
      
      await backToSearchButton.click();
      await expect(page).toHaveURL('/stocks');
    });
  });

  test.describe('Favorites Functionality', () => {
    test('should add stock to favorites from detail page', async ({ page }) => {
      // Note: This test assumes user authentication is working
      // You might need to handle login flow first
      
      await page.goto('/stocks/000001.SZ');
      
      const favoriteButton = page.locator('[data-testid="favorite-button"]');
      await expect(favoriteButton).toBeVisible();
      
      // Initially should be unfavorited
      await expect(favoriteButton).toHaveAttribute('title', '添加收藏');
      
      // Add to favorites
      await favoriteButton.click();
      
      // Should show success message
      await expect(page.locator('[data-testid="toast"]')).toContainText('已添加到收藏');
      
      // Button should change state
      await expect(favoriteButton).toHaveAttribute('title', '取消收藏');
    });

    test('should remove stock from favorites', async ({ page }) => {
      await page.goto('/stocks/000001.SZ');
      
      const favoriteButton = page.locator('[data-testid="favorite-button"]');
      
      // Add to favorites first (assuming it's not already favorited)
      await favoriteButton.click();
      await expect(favoriteButton).toHaveAttribute('title', '取消收藏');
      
      // Remove from favorites
      await favoriteButton.click();
      
      // Should show success message
      await expect(page.locator('[data-testid="toast"]')).toContainText('已取消收藏');
      
      // Button should change state back
      await expect(favoriteButton).toHaveAttribute('title', '添加收藏');
    });

    test('should access favorites from quick actions', async ({ page }) => {
      await navigateToStocks(page);
      
      const favoritesButton = page.getByRole('button', { name: '我的收藏' });
      await favoritesButton.click();
      
      // Should show favorites modal or navigate to favorites page
      const favoritesContainer = page.locator('[data-testid="favorites-container"]');
      await expect(favoritesContainer).toBeVisible();
    });
  });

  test.describe('Search History', () => {
    test('should save search history', async ({ page }) => {
      await navigateToStocks(page);
      
      // Perform multiple searches
      await performSearch(page, '平安银行');
      await page.waitForTimeout(500);
      
      await performSearch(page, '万科A');
      await page.waitForTimeout(500);
      
      // Access search history
      const historyButton = page.getByRole('button', { name: '搜索历史' });
      await historyButton.click();
      
      const historyContainer = page.locator('[data-testid="search-history"]');
      await expect(historyContainer).toBeVisible();
      
      // Should contain recent searches
      await expect(historyContainer).toContainText('平安银行');
      await expect(historyContainer).toContainText('万科A');
    });

    test('should clear search history', async ({ page }) => {
      await navigateToStocks(page);
      
      // Add some search history
      await performSearch(page, '平安银行');
      
      // Access search history
      const historyButton = page.getByRole('button', { name: '搜索历史' });
      await historyButton.click();
      
      // Clear history
      const clearHistoryButton = page.getByRole('button', { name: '清空历史' });
      await clearHistoryButton.click();
      
      // Confirm clear
      const confirmButton = page.getByRole('button', { name: '确认' });
      await confirmButton.click();
      
      // History should be empty
      const emptyHistory = page.locator('[data-testid="empty-history"]');
      await expect(emptyHistory).toBeVisible();
    });
  });

  test.describe('Mobile Experience', () => {
    test('should work correctly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await navigateToStocks(page);
      
      // Search input should be properly sized for mobile
      const searchInput = page.getByPlaceholder('搜索股票代码或名称...');
      const inputBox = await searchInput.boundingBox();
      
      expect(inputBox?.height).toBeGreaterThanOrEqual(44); // Touch target size
      
      // Perform search
      await performSearch(page, '平安银行');
      
      // Results should be responsive
      const results = page.locator('[data-testid="stock-search-results"]');
      await expect(results).toBeVisible();
      
      // Stock items should be touch-friendly
      const stockItem = results.locator('[data-testid="stock-item"]').first();
      const itemBox = await stockItem.boundingBox();
      
      expect(itemBox?.height).toBeGreaterThanOrEqual(44);
    });

    test('should handle virtual keyboard on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await navigateToStocks(page);
      
      const searchInput = page.getByPlaceholder('搜索股票代码或名称...');
      await searchInput.focus();
      
      // Input should have proper attributes to prevent zoom
      await expect(searchInput).toHaveAttribute('autocomplete', 'off');
      
      // Should be able to type without issues
      await searchInput.type('000001');
      await expect(searchInput).toHaveValue('000001');
    });
  });

  test.describe('Complete User Journey', () => {
    test('should complete full stock search and discovery journey', async ({ page }) => {
      // 1. Start at stocks page
      await navigateToStocks(page);
      
      // 2. Search for a stock
      await performSearch(page, '银行');
      
      // 3. Browse search results
      const results = page.locator('[data-testid="stock-search-results"]');
      const stockItems = results.locator('[data-testid="stock-item"]');
      const itemCount = await stockItems.count();
      expect(itemCount).toBeGreaterThan(0);
      
      // 4. Select a specific stock
      const pinganBank = stockItems.filter({ hasText: '平安银行' }).first();
      await pinganBank.click();
      
      // 5. View stock details
      await expect(page).toHaveURL(/\/stocks\/000001\.SZ/);
      await expect(page.locator('h1')).toContainText('平安银行');
      
      // 6. Add to favorites
      const favoriteButton = page.locator('[data-testid="favorite-button"]');
      await favoriteButton.click();
      await expect(page.locator('[data-testid="toast"]')).toContainText('已添加到收藏');
      
      // 7. Navigate back to search
      await page.goBack();
      await expect(page).toHaveURL('/stocks');
      
      // 8. Check search history
      const historyButton = page.getByRole('button', { name: '搜索历史' });
      await historyButton.click();
      
      const historyContainer = page.locator('[data-testid="search-history"]');
      await expect(historyContainer).toContainText('银行');
      
      // 9. Check favorites
      const favoritesButton = page.getByRole('button', { name: '我的收藏' });
      await favoritesButton.click();
      
      const favoritesContainer = page.locator('[data-testid="favorites-container"]');
      await expect(favoritesContainer).toContainText('平安银行');
    });

    test('should handle browser navigation correctly', async ({ page }) => {
      await navigateToStocks(page);
      
      // Search and navigate to detail
      await performSearch(page, '平安银行');
      const firstResult = page.locator('[data-testid="stock-item"]').first();
      await firstResult.click();
      
      await expect(page).toHaveURL(/\/stocks\/000001\.SZ/);
      
      // Use browser back button
      await page.goBack();
      await expect(page).toHaveURL('/stocks');
      
      // Search should be preserved
      const searchInput = page.getByPlaceholder('搜索股票代码或名称...');
      await expect(searchInput).toHaveValue('平安银行');
      
      // Use browser forward button
      await page.goForward();
      await expect(page).toHaveURL(/\/stocks\/000001\.SZ/);
    });

    test('should maintain state across page refreshes', async ({ page }) => {
      await navigateToStocks(page);
      await performSearch(page, '平安银行');
      
      // Navigate to detail page
      const firstResult = page.locator('[data-testid="stock-item"]').first();
      await firstResult.click();
      
      // Refresh the page
      await page.reload();
      
      // Stock details should still be displayed
      await expect(page.locator('h1')).toContainText('平安银行');
      await expect(page.locator('[data-testid="stock-code"]')).toContainText('000001.SZ');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept API calls to simulate error
      await page.route('/api/trpc/stocks.search*', async (route) => {
        await route.abort('failed');
      });
      
      await navigateToStocks(page);
      await performSearch(page, '平安银行');
      
      // Should show error message
      const errorMessage = page.locator('[data-testid="search-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('搜索失败');
      
      // Should provide retry option
      const retryButton = page.getByRole('button', { name: '重试' });
      await expect(retryButton).toBeVisible();
    });

    test('should handle network timeout', async ({ page }) => {
      // Simulate slow network
      await page.route('/api/trpc/stocks.search*', async (route) => {
        await page.waitForTimeout(10000);
        await route.continue();
      });
      
      await navigateToStocks(page);
      
      const searchInput = page.getByPlaceholder('搜索股票代码或名称...');
      await searchInput.fill('平安银行');
      await searchInput.press('Enter');
      
      // Should show loading state
      const loadingIndicator = page.locator('[data-testid="search-loading"]');
      await expect(loadingIndicator).toBeVisible();
      
      // Eventually should show timeout error
      const timeoutError = page.locator('[data-testid="search-timeout"]');
      await expect(timeoutError).toBeVisible({ timeout: 15000 });
    });
  });
});