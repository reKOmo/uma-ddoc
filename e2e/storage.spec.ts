// What the app remembers in localStorage: settings and filters survive a reload, and what older versions stored
// still loads (the keys and formats must never change, or people lose their settings).

import { expect, open, test } from './fixtures.ts';

const stored = (page: import('@playwright/test').Page, key: string) =>
  page.evaluate((k) => window.localStorage.getItem(k), key);

test('settings survive a reload, stored as before', async ({ page }) => {
  await open(page, '#/settings');
  const times = page.getByRole('group', { name: 'Time zone' });
  await times.getByRole('button', { name: /Local/ }).click();
  await page.reload();
  await expect(times.getByRole('button', { name: /Local/ })).toHaveAttribute('aria-pressed', 'true');
  expect(JSON.parse((await stored(page, 'uma-ddoc.settings')) ?? '{}')).toEqual({
    timeZone: 'local',
    scenarioNames: 'global',
    jpNewsLanguage: 'jp',
    // Added later; the browser's (Playwright's Chromium is en-US: 12-hour).
    clock: '12h',
    fanTlGlobal: 'all',
    jpNames: 'jp',
    theme: 'system',
  });
});

test('the theme setting switches the colours, and survives a reload', async ({ page }) => {
  await open(page, '#/settings');
  const theme = page.getByRole('group', { name: 'Theme' });
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await theme.getByRole('button', { name: /Light/ }).click();
  const light = await background();
  await theme.getByRole('button', { name: /Dark/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await background()).not.toBe(light);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await theme.getByRole('button', { name: /System/ }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
});

test("an older version's settings load", async ({ page }) => {
  await open(page, '#/settings', {
    'uma-ddoc.settings': JSON.stringify({ timeZone: 'local', scenarioNames: 'jp', jpNewsLanguage: 'en' }),
  });
  const pressed = page.getByRole('main').getByRole('button', { pressed: true });
  await expect(pressed).toHaveCount(5);
  // Added later (no theme stored): the device's.
  await expect(pressed.nth(0)).toContainText('System');
  await expect(pressed.nth(1)).toContainText('Local');
  // It stored no clock: the browser's.
  await expect(pressed.nth(2)).toContainText('12-hour');
  await expect(pressed.nth(3)).toContainText('JP');
  await expect(pressed.nth(4)).toContainText('English');
  // Added later (the names' dropdowns): their defaults.
  const main = page.getByRole('main');
  await expect(main.getByRole('combobox', { name: /^Global/ })).toContainText('All English');
  await expect(main.getByRole('combobox', { name: /^JP/ })).toContainText('Japanese');
});

test('garbage in storage gives the defaults, not a crash', async ({ page }) => {
  await open(page, '#/settings', { 'uma-ddoc.settings': '{not json', 'uma-ddoc.tierListFilters': '[1,2' });
  await expect(page.getByRole('group', { name: 'Time zone' }).getByRole('button', { pressed: true })).toContainText(
    'UTC'
  );
});

test('the Cards search survives leaving the tab and a reload', async ({ page }) => {
  await open(page, '#/');
  await page.getByRole('searchbox', { name: 'Search cards' }).fill('kitasan');
  await page.getByRole('navigation').getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Cards' }).click();
  await expect(page.getByRole('searchbox', { name: 'Search cards' })).toHaveValue('kitasan');
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search cards' })).toHaveValue('kitasan');
  expect(JSON.parse((await stored(page, 'uma-ddoc.tierListFilters')) ?? '{}')).toMatchObject({ query: 'kitasan' });
});

test('Timeline compact mode survives a reload, stored as the plain string', async ({ page }) => {
  await open(page, '#/timeline');
  const compact = page.getByRole('button', { name: 'Compact' });
  await expect(compact).toHaveAttribute('aria-pressed', 'true');
  await compact.click();
  await page.reload();
  await expect(compact).toHaveAttribute('aria-pressed', 'false');
  expect(await stored(page, 'uma-ddoc.timelineCompact')).toBe('false');
});

test('a folded Timeline group stays folded after a reload', async ({ page }) => {
  await open(page, '#/timeline');
  const group = page.getByRole('button', { name: /^Support cards/ });
  await expect(group).toHaveAttribute('aria-expanded', 'true');
  await group.click();
  await page.reload();
  await expect(group).toHaveAttribute('aria-expanded', 'false');
  expect(JSON.parse((await stored(page, 'uma-ddoc.timelineCollapsed')) ?? '[]')).toContain('cards');
});

test("an older version's Timeline state loads (hidden kinds, folded groups, compact off)", async ({ page }) => {
  await open(page, '#/timeline', {
    'uma-ddoc.timelineHidden': JSON.stringify(['story']),
    'uma-ddoc.timelineCollapsed': JSON.stringify(['characters']),
    'uma-ddoc.timelineCompact': 'false',
  });
  await expect(page.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: /^Trainees/ })).toHaveAttribute('aria-expanded', 'false');
  // the filter button counts what's hidden
  await expect(page.getByRole('button', { name: /Options/ })).toContainText('1');
});
