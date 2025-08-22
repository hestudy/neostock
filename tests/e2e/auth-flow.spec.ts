import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display home page with navigation', async ({ page }) => {
    await expect(page).toHaveTitle(/NeoStock/i);
    
    // Check if navigation links are present
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    // Look for login link or button
    const loginLink = page.getByRole('link', { name: /login|sign in/i }).first();
    await loginLink.click();
    
    await expect(page).toHaveURL(/.*login/);
    
    // Check if login form is present
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
  });

  test('should show validation errors for empty login form', async ({ page }) => {
    await page.goto('/login');
    
    // Try to submit empty form
    const submitButton = page.getByRole('button', { name: /sign in|login/i });
    await submitButton.click();
    
    // Should show validation errors (adjust selectors based on your form)
    await expect(page.locator('.error, [data-error], .text-red')).toHaveCount({ min: 1 });
  });

  test('should handle login with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill form with invalid credentials
    await page.getByRole('textbox', { name: /email/i }).fill('invalid@test.com');
    await page.getByRole('textbox', { name: /password/i }).fill('wrongpassword');
    
    const submitButton = page.getByRole('button', { name: /sign in|login/i });
    await submitButton.click();
    
    // Should show error message
    await expect(page.locator('.error, [data-error], .text-red')).toBeVisible();
  });

  test('should navigate to registration page', async ({ page }) => {
    const registerLink = page.getByRole('link', { name: /register|sign up/i }).first();
    await registerLink.click();
    
    await expect(page).toHaveURL(/.*register|.*signup/);
    
    // Check if registration form is present
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
  });

  test('should validate registration form requirements', async ({ page }) => {
    await page.goto('/login'); // Adjust route based on your app
    
    // Navigate to register if there's a link
    const registerLink = page.getByRole('link', { name: /register|sign up/i }).first();
    if (await registerLink.isVisible()) {
      await registerLink.click();
    }
    
    // Try to submit empty registration form
    const submitButton = page.getByRole('button', { name: /sign up|register/i });
    await submitButton.click();
    
    // Should show validation errors
    await expect(page.locator('.error, [data-error], .text-red')).toHaveCount({ min: 1 });
  });

  test('should toggle between light and dark mode', async ({ page }) => {
    // Look for theme toggle button
    const themeToggle = page.locator('button').filter({ hasText: /toggle.*mode|theme/i }).first();
    
    if (await themeToggle.isVisible()) {
      // Get initial theme class
      const initialTheme = await page.locator('html').getAttribute('class');
      
      await themeToggle.click();
      
      // Theme should change
      const newTheme = await page.locator('html').getAttribute('class');
      expect(newTheme).not.toBe(initialTheme);
    }
  });

  test('should have responsive layout on mobile', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    
    await expect(page.getByRole('navigation')).toBeVisible();
    
    // Check if mobile navigation works (hamburger menu, etc.)
    const mobileMenu = page.locator('button').filter({ hasText: /menu|☰|≡/ }).first();
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    }
  });

  // Performance test
  test('should load home page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});