import { test, expect } from '@playwright/test';

test.describe('Navigation and Core Pages', () => {
  test('should navigate between main pages', async ({ page }) => {
    await page.goto('/');
    
    // Test home page
    await expect(page).toHaveTitle(/NeoStock/i);
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    
    // Navigate to dashboard if available
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await expect(page).toHaveURL(/.*dashboard/);
    }
    
    // Navigate back to home
    const homeLink = page.getByRole('link', { name: 'Home' });
    await homeLink.click();
    await expect(page).toHaveURL('/');
  });

  test('should maintain navigation consistency across pages', async ({ page }) => {
    const pages = ['/', '/login'];
    
    for (const pageUrl of pages) {
      await page.goto(pageUrl);
      
      // Each page should have consistent navigation
      await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    }
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/non-existent-page');
    
    // Should either redirect or show 404
    if (response?.status() === 404) {
      await expect(page.locator('text=404')).toBeVisible();
    } else {
      // If redirected, should be to a valid page
      expect(response?.status()).toBeLessThan(400);
    }
  });

  test('should support browser back/forward navigation', async ({ page }) => {
    await page.goto('/');
    await page.goto('/login');
    
    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/');
    
    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/.*login/);
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check for proper ARIA labels and roles
    const navigation = page.getByRole('navigation');
    await expect(navigation).toBeVisible();
    
    // Navigation links should be accessible
    const links = navigation.getByRole('link');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);
    
    // Each link should have accessible text
    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      expect(text?.trim()).toBeTruthy();
    }
  });
});