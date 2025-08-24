import { test, expect } from '@playwright/test';

test.describe('Basic E2E Tests', () => {
  test('should be able to navigate to external site', async ({ page }) => {
    // Test a simple external navigation
    await page.goto('https://example.com');
    
    // Verify the page loaded
    await expect(page).toHaveTitle('Example Domain');
    await expect(page.getByText('Example Domain')).toBeVisible();
  });

  test('should validate Playwright is working correctly', async ({ page }) => {
    // Simple test to validate Playwright setup
    await page.goto('https://httpbin.org/html');
    
    // Check that the page loaded and has expected content
    await expect(page.locator('h1')).toContainText('Herman Melville');
  });
});