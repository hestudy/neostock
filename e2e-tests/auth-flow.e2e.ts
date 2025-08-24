import { test, expect } from '@playwright/test';

test.describe('Basic Browser Tests', () => {
  test('should validate browser functionality', async ({ page }) => {
    await page.goto('https://example.com');
    
    // Check that browser can navigate and render content
    await expect(page).toHaveTitle('Example Domain');
    await expect(page.getByRole('heading')).toContainText('Example Domain');
    
    // Test basic interactions
    const moreInfo = page.getByRole('link', { name: 'More information...' });
    await expect(moreInfo).toBeVisible();
  });
});