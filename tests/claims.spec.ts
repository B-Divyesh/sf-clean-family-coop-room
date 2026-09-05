import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

let testClient = 10;

async function openPlayer(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.dismiss());
  return page;
}

async function openTwoPlayerRoom(browser: Browser): Promise<{ first: Page; second: Page; close: () => Promise<void> }> {
  const firstContext = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `203.0.113.${testClient++}` } });
  const secondContext = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `203.0.113.${testClient++}` } });
  const first = await openPlayer(firstContext);
  const second = await openPlayer(secondContext);
  await first.goto('/demo');
  await first.getByRole('button', { name: 'Start for real' }).click();
  await first.getByRole('button', { name: 'Make a room' }).click();
  await expect(first.getByText('Waiting for the other player')).toBeVisible();
  const code = (await first.locator('.room-code').innerText()).replace(/\D/g, '').slice(-6);
  await second.goto(`/demo`);
  await second.getByRole('button', { name: 'Start for real' }).click();
  await second.getByRole('button', { name: 'I have a code' }).click();
  await second.getByLabel('Six-digit room code').fill(code);
  await second.getByRole('button', { name: 'Open room' }).click();
  await expect(first.getByText('Both players are connected')).toBeVisible();
  return { first, second, close: async () => { await firstContext.close(); await secondContext.close(); } };
}

test('@claim:demo-sandbox sample is populated, resettable, and isolated from real data', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('together_room:999999', JSON.stringify({ marker: 'real-data' })));
  const requests: Array<{ method: string; path: string }> = [];
  page.on('request', (request) => requests.push({ method: request.method(), path: new URL(request.url()).pathname }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Try it with sample data' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Star Signal' })).toBeVisible();
  await expect(page.getByText('Patchwork Pair')).toBeVisible();
  await expect(page.getByText('Firefly Ferry')).toBeVisible();
  await page.getByRole('button', { name: 'Choose drop for Alex' }).click();
  await expect(page.getByText('Sample round complete. Both players rebuilt the signal.')).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('4 of 6 symbols are complete. It is Alex’s turn.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('together_room:999999'))).toBe('{"marker":"real-data"}');
  expect(requests.some((request) => request.method !== 'GET' || request.path === '/api/rooms')).toBeFalsy();
});

test('@claim:privacy-boundary landing and demo expose no identity, chat, listing, or third-party runtime', async ({ page, request }) => {
  const origins = new Set<string>();
  page.on('request', (request) => origins.add(new URL(request.url()).origin));
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Star Signal' })).toBeVisible();
  expect([...origins]).toEqual(['http://127.0.0.1:8080']);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByText('This sample cannot open, read, or change a real room.')).toBeVisible();
  expect((await request.get('/api/rooms')).status()).toBe(405);
});

test('@claim:offline-sample welcome and sample reopen offline after one visit', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Star Signal' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await page.reload();
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Try a sample co-op round' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Star Signal' })).toBeVisible();
  } finally {
    await context.setOffline(false);
    await context.close();
  }
});

test('@claim:paid-pack @claim:billing-boundary checkout leaves the app and a valid license enables every paid extra', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/**/verify?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null })
  }));
  await page.goto('/');
  await expect(page.getByText('US$8 once · no subscription')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buy family pack' })).toHaveAttribute('href', 'https://api.sociobot.in/api/v1/products/clean-family-coop-room/checkout');
  await page.goto('/?license=sample-license-token');
  await expect(page.getByRole('button', { name: 'Use Dawn palette' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use Berry palette' })).toBeVisible();
  await expect(page.getByText('ROUND COMPLETE ✦')).toBeVisible();
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole('button', { name: 'Use Berry palette' }).click();
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(after).not.toBe(before);
});

test('@claim:license-daily a recent local verdict avoids another license request', async ({ page }) => {
  let verifies = 0;
  await page.route('https://api.sociobot.in/api/v1/products/**/verify?*', (route) => { verifies += 1; return route.abort(); });
  await page.addInitScript(() => {
    localStorage.setItem('sb_license:clean-family-coop-room', 'saved-license-token');
    localStorage.setItem('sb_license_verdict:clean-family-coop-room', JSON.stringify({ valid: true, checked_at: Date.now() }));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your extra colors are ready' })).toBeVisible();
  expect(verifies).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('sb_license:clean-family-coop-room'))).toBe('saved-license-token');
});

test('@claim:paid-core-free an inactive license leaves every game available', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '203.0.113.200' });
  await page.route('https://api.sociobot.in/api/v1/products/**/verify?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ valid: false, reason: 'revoked', expires_at: null })
  }));
  await page.goto('/?license=revoked-license-token');
  await expect(page.getByText('This license is no longer active. The three games are still ready to play.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make a room' })).toBeEnabled();
  await page.getByRole('button', { name: 'Make a room' }).click();
  await expect(page.getByRole('button', { name: 'Play Star Signal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Patchwork Pair' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Firefly Ferry' })).toBeVisible();
});

test('@claim:remote-room two devices join with one six-digit code and no account', async ({ browser }) => {
  const room = await openTwoPlayerRoom(browser);
  await expect(room.first.getByText('Player 1 (you): connected')).toBeVisible();
  await expect(room.second.getByText('Player 2 (you): connected')).toBeVisible();
  await room.close();
});

test('@claim:reconnect a device reloads into the same room state', async ({ browser }) => {
  const pair = await openTwoPlayerRoom(browser);
  await pair.first.getByRole('button', { name: 'Play Star Signal' }).click();
  await pair.first.getByRole('button', { name: 'Choose leaf' }).click();
  await expect(pair.second.getByLabel('1 of 6 symbols complete')).toBeVisible();
  await pair.first.reload();
  await expect(pair.first.getByRole('heading', { name: 'Star Signal' })).toBeVisible();
  await expect(pair.first.getByText('Player 1 (you): connected')).toBeVisible();
  await expect(pair.first.getByLabel('1 of 6 symbols complete')).toBeVisible();
  await pair.close();
});
