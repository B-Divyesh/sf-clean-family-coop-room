import { test, expect, type BrowserContext, type Page } from '@playwright/test';

async function newPlayer(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.dismiss());
  return page;
}

test('@claim:three-games @claim:turn-taking @claim:continued-room two devices play every game in alternating turns', async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const first = await newPlayer(firstContext);
  const second = await newPlayer(secondContext);

  await first.goto('/');
  await first.getByRole('button', { name: 'Make a room' }).click();
  await expect(first.getByText('Waiting for the other player')).toBeVisible();
  const rawCode = await first.locator('.room-code').innerText();
  const code = rawCode.replace(/\D/g, '').slice(-6);
  expect(code).toHaveLength(6);

  await second.goto(`/?room=${code}`);
  await second.getByRole('button', { name: 'Open room' }).click();
  await expect(second.getByText('Both players are connected')).toBeVisible();
  await expect(first.getByText('Both players are connected')).toBeVisible();

  await first.getByRole('button', { name: 'Play Star Signal' }).click();
  await expect(second.getByRole('heading', { level: 1, name: 'Star Signal' })).toBeVisible();

  const sequence: Array<[Page, string]> = [
    [first, 'leaf'], [second, 'star'], [first, 'moon'],
    [second, 'heart'], [first, 'drop'], [second, 'sun']
  ];
  for (const [page, symbol] of sequence) await page.getByRole('button', { name: `Choose ${symbol}` }).click();
  await expect(first.getByRole('heading', { level: 1, name: 'You completed the round' })).toBeVisible();
  await expect(second.getByRole('heading', { level: 1, name: 'You completed the round' })).toBeVisible();

  await first.reload();
  await expect(first.getByText('Player 1 (you): connected')).toBeVisible();
  await expect(first.getByRole('heading', { level: 1, name: 'You completed the round' })).toBeVisible();

  await first.getByRole('button', { name: 'Choose another game' }).click();
  await first.getByRole('button', { name: 'Play Patchwork Pair' }).click();
  const patches: Array<[Page, string, number]> = [
    [first, 'amber', 0], [second, 'sky', 1], [first, 'mint', 2],
    [second, 'mint', 3], [first, 'amber', 4], [second, 'sky', 5],
    [first, 'sky', 6], [second, 'mint', 7], [first, 'amber', 8]
  ];
  for (const [page, color, index] of patches) {
    await page.getByRole('button', { name: color, exact: true }).click();
    await page.locator(`[data-patch-index="${index}"]`).click();
  }
  await expect(second.getByRole('heading', { level: 1, name: 'You completed the round' })).toBeVisible();

  await second.getByRole('button', { name: 'Choose another game' }).click();
  await second.getByRole('button', { name: 'Play Firefly Ferry' }).click();
  const route: Array<[Page, string]> = [
    [first, 'Right'], [second, 'Up'], [first, 'Right'], [second, 'Up'],
    [first, 'Right'], [second, 'Up'], [first, 'Right'], [second, 'Up']
  ];
  for (const [page, direction] of route) await page.getByRole('button', { name: new RegExp(direction, 'i') }).click();
  await expect(first.getByRole('heading', { level: 1, name: 'You completed the round' })).toBeVisible();

  await firstContext.close();
  await secondContext.close();
});
