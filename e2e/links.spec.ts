// Links into the Timeline: each opens its banner or event's sheet on the right server, and the address keeps the
// open sheet, so going back to the Timeline (from a card's page) opens it again. (The wouter migration broke all of
// these once: the router re-read the address after the Timeline had replaced it.)

import { activeTab, expect, open, server, sheet, sheetTitle, test } from './fixtures.ts';

// A Global banner JP has too (gacha ids are shared): Special Week's, and a card on a predicted Global banner.
const BANNER = 30003;
const CARD_WITH_UPCOMING_BANNER = 30126;

test('a direct link opens its sheet', async ({ page }) => {
  await open(page, `#/timeline/gl/${BANNER}`);
  await expect(sheetTitle(page)).toContainText('Special Week');
  await expect(page).toHaveURL(new RegExp(`#/timeline/gl/${BANNER}$`));
  await expect(server(page)).toHaveText('Global');
  await expect(activeTab(page)).toHaveText('Timeline');
});

test('a link to JP switches server and opens the JP entry', async ({ page }) => {
  await open(page, `#/timeline/jp/${BANNER}`);
  await expect(server(page)).toHaveText('Japan');
  await expect(sheetTitle(page)).toContainText('スペシャルウィーク');
});

test("a card page's See banner opens the banner, and its other-server link opens it on JP", async ({ page }) => {
  await open(page, `#/card/${CARD_WITH_UPCOMING_BANNER}`);
  await page.getByRole('link', { name: 'See banner' }).click();
  await expect(page).toHaveURL(/#\/timeline\/gl\/\d+$/);
  await expect(sheet(page)).toBeVisible();
  await sheet(page).getByRole('link', { name: /Japan/ }).click();
  await expect(server(page)).toHaveText('Japan');
  await expect(page).toHaveURL(/#\/timeline\/jp\/\d+$/);
  await expect(sheet(page)).toBeVisible();
});

test('back from a card page reopens the sheet it came from', async ({ page }) => {
  await open(page, `#/timeline/gl/${BANNER}`);
  await expect(sheetTitle(page)).toContainText('Special Week');
  await sheet(page)
    .getByRole('link', { name: /See more/ })
    .first()
    .click();
  await expect(page).toHaveURL(/#\/card\/\d+$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`#/timeline/gl/${BANNER}$`));
  await expect(sheetTitle(page)).toContainText('Special Week');
});

test('closing the sheet puts the plain Timeline in the address', async ({ page }) => {
  await open(page, `#/timeline/gl/${BANNER}`);
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
  await expect(page).toHaveURL(/#\/timeline$/);
});

test('the old #/banners address is the Timeline', async ({ page }) => {
  await open(page, '#/banners');
  await expect(activeTab(page)).toHaveText('Timeline');
  await expect(page).toHaveURL(/#\/timeline$/);
});
