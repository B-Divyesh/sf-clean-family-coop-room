import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing page has no serious accessibility violations or console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Play three remote co-op games');
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  // axe's Page type can lag Playwright's pinned minor while remaining runtime-compatible.
  const results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  expect(errors).toEqual([]);
});

test('populated demo has valid progress semantics and no serious accessibility violations', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('progressbar', { name: '4 of 6 symbols complete' })).toHaveAttribute('aria-valuenow', '4');
  const results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('privacy and terms are reachable without a network form', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page).toHaveTitle('Privacy — Together Room');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How Together Room handles data');
  await page.getByRole('link', { name: 'Terms' }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page).toHaveTitle('Terms — Together Room');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms for using Together Room');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How Together Room handles data');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('a returned purchase license is stored, stripped from the URL, and verified', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/**/verify?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null })
  }));
  await page.goto('/?license=test-license-token');
  await expect(page.getByRole('heading', { name: 'Your extra colors are ready' })).toBeVisible();
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(() => localStorage.getItem('sb_license:clean-family-coop-room'))).toBe('test-license-token');
});

test('keyboard focus starts on the visible skip link', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS('outline-width', '3px');
});

test('mobile links and disclosure meet touch targets and 200% reflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile geometry regression');
  await page.goto('/');
  const targets = [
    page.getByRole('link', { name: 'Together Room' }),
    page.getByText('Have a license? Restore it'),
    page.locator('.pack').getByRole('link', { name: 'terms' }),
    page.locator('.pack').getByRole('link', { name: 'privacy' }),
    page.locator('.site-footer').getByRole('link', { name: 'Privacy' }),
    page.locator('.site-footer').getByRole('link', { name: 'Terms' })
  ];
  for (const target of targets) {
    const box = await target.boundingBox();
    expect(box?.height, await target.textContent() ?? 'target').toBeGreaterThanOrEqual(44);
    expect(box?.width, await target.textContent() ?? 'target').toBeGreaterThanOrEqual(44);
  }

  await page.setViewportSize({ width: 195, height: 844 });
  expect(await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth })))
    .toEqual({ client: 195, scroll: 195 });
});

test('the installed shell updates cleanly and reloads offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await page.reload();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.reload();
  expect(await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      controlled: Boolean(navigator.serviceWorker.controller),
      installing: Boolean(registration.installing),
      waiting: Boolean(registration.waiting)
    };
  })).toEqual({ controlled: true, installing: false, waiting: false });

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Play three remote co-op games');
  } finally {
    await context.setOffline(false);
  }
});

test('paid view has valid landmarks and usable color controls', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb_license:clean-family-coop-room', 'test-license-token');
    localStorage.setItem('sb_license_verdict:clean-family-coop-room', JSON.stringify({ valid: true, checked_at: Date.now() }));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your extra colors are ready' })).toBeVisible();
  const results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations).toEqual([]);
});

test('route metadata, navigation, sitemap, and designed 404 are complete', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Together Room — Play remote co-op games');
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Demo' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Privacy' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Built by Param Factory' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://clean-family-coop-room.sociobot.in/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /social-card\.jpg$/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(sitemap.headers()['content-type']).toContain('xml');
  expect(await sitemap.text()).toContain('/demo');

  const response = await page.goto('/definitely-not-a-route');
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle('Page not found — Together Room');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page does not exist');
  await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible();
});

test('security headers include HSTS', async ({ request }) => {
  const response = await request.get('/');
  expect(response.headers()['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
});

test('a fresh landing visit stays first-party and stores no identity', async ({ page }) => {
  const origins = new Set<string>();
  page.on('request', (request) => origins.add(new URL(request.url()).origin));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect([...origins]).toEqual(['http://127.0.0.1:8080']);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});
