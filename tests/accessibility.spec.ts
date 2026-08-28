import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing page has no serious accessibility violations or console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A tiny room to play together.');
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  // axe's Page type can lag Playwright's pinned minor while remaining runtime-compatible.
  const results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  expect(errors).toEqual([]);
});

test('privacy and terms are reachable without a network form', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy without profiles.');
  await page.getByRole('link', { name: 'Terms' }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Short rooms, simple terms.');
});

test('a returned purchase license is stored, stripped from the URL, and verified', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/**/verify?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null })
  }));
  await page.goto('/?license=test-license-token');
  await expect(page.getByRole('heading', { name: 'Your extra tapes are ready' })).toBeVisible();
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(() => localStorage.getItem('sb_license:clean-family-coop-room'))).toBe('test-license-token');
});
