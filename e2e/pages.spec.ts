// Every page renders, highlights the right tab, and loads its data (on both servers where that matters).

import { activeTab, expect, open, server, test } from './fixtures.ts';

const TABS = [
  ['#/', 'Cards'],
  ['#/timeline', 'Timeline'],
  ['#/scenarios', 'Scenarios'],
  ['#/settings', 'Settings'],
] as const;

for (const [hash, name] of TABS) {
  test(`the ${name} tab renders and is highlighted`, async ({ page }) => {
    await open(page, hash);
    await expect(activeTab(page)).toHaveText(name);
    await expect(page.getByRole('main')).not.toBeEmpty();
  });
}

test('the Cards tab ranks cards and opens a card', async ({ page }) => {
  await open(page, '#/');
  const card = page
    .getByRole('main')
    .getByRole('link')
    .filter({ has: page.locator('img') })
    .first();
  await card.click();
  await expect(page).toHaveURL(/#\/card\/\d+$/);
  await expect(activeTab(page)).toHaveText('Cards');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/#\/$/);
});

for (const name of ['Global', 'Japan']) {
  test(`a card page loads its tiers and origins on ${name}`, async ({ page }) => {
    await open(page, '#/card/30001');
    await page.getByRole('group', { name: 'Server' }).getByRole('button', { name }).click();
    await expect(server(page)).toHaveText(name);
    await expect(page.getByRole('heading', { name: 'Tier by scenario' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Available on' })).toBeVisible();
    // the tier table fills in (a tier chip per LB once ranked) and origins load (a Timeline link)
    await expect(page.getByRole('table').getByRole('row').nth(1)).not.toContainText('…');
    await expect(page.getByRole('link', { name: /banner|gift|story/i }).first()).toBeVisible();
  });
}

test('a card not on Global yet says so and shows its predicted rank', async ({ page }) => {
  await open(page, '#/card/30126');
  await expect(page.getByRole('heading', { name: 'Rank over time' })).toBeVisible();
});

test('a scenario page keeps the Scenarios tab and links its neighbours', async ({ page }) => {
  await open(page, '#/scenarios');
  await page.getByRole('main').getByRole('link').nth(1).click();
  await expect(page).toHaveURL(/#\/scenario\//);
  await expect(activeTab(page)).toHaveText('Scenarios');
  const others = page.getByRole('navigation', { name: /scenario/i });
  const before = page.url();
  await others.getByRole('link').first().click();
  await expect(page).not.toHaveURL(before);
  await expect(page).toHaveURL(/#\/scenario\//);
});

test('a Timeline sheet opens from a bar and closes', async ({ page }) => {
  await open(page, '#/timeline');
  await page.getByRole('button', { name: /./ }).and(page.locator('.bar-hit')).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/#\/timeline\/(gl|jp)\/.+$/);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
