import { test, expect, type BrowserContext, type Page } from '@playwright/test';

async function newPlayer(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.dismiss());
  return page;
}

test('two devices join, complete a Star Signal round, and reconnect', async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const first = await newPlayer(firstContext);
  const second = await newPlayer(secondContext);

  await first.goto('/');
  await first.getByRole('button', { name: 'Make a room' }).click();
  await expect(first.getByText('Waiting for the other window')).toBeVisible();
  const rawCode = await first.locator('.room-code').innerText();
  const code = rawCode.replace(/\D/g, '').slice(-6);
  expect(code).toHaveLength(6);

  await second.goto(`/?room=${code}`);
  await second.getByRole('button', { name: 'Open room' }).click();
  await expect(second.getByText('Both windows are lit')).toBeVisible();
  await expect(first.getByText('Both windows are lit')).toBeVisible();

  await first.getByRole('button', { name: 'Play Star Signal' }).click();
  await expect(second.getByRole('heading', { level: 1, name: 'Star Signal' })).toBeVisible();

  const sequence: Array<[Page, string]> = [
    [first, 'leaf'], [second, 'star'], [first, 'moon'],
    [second, 'heart'], [first, 'drop'], [second, 'sun']
  ];
  for (const [page, symbol] of sequence) await page.getByRole('button', { name: `Choose ${symbol}` }).click();
  await expect(first.getByRole('heading', { level: 1, name: 'You did it together.' })).toBeVisible();
  await expect(second.getByRole('heading', { level: 1, name: 'You did it together.' })).toBeVisible();

  await first.reload();
  await expect(first.getByText('Window A (you): connected')).toBeVisible();
  await expect(first.getByRole('heading', { level: 1, name: 'You did it together.' })).toBeVisible();

  await firstContext.close();
  await secondContext.close();
});
