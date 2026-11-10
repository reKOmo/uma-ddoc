import type { Page } from '@playwright/test';
import { activeTab, expect, open, sheet, sheetTitle, test } from './fixtures.ts';

const filterButton = (page: Page) => page.getByRole('button', { name: 'Options' }).first();
// A Global banner (Special Week's).
const BANNER = 30003;

for (const url of ['#/', '#/timeline']) {
  test(`back closes the filter sheet and stays on the page (${url})`, async ({ page }) => {
    await open(page, url);
    await filterButton(page).click();
    await expect(sheet(page)).toBeVisible();
    await page.goBack();
    await expect(sheet(page)).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${url}$`));
  });

  test(`closing the filter sheet leaves no extra history entry (${url})`, async ({ page }) => {
    await open(page, '#/settings');
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, url);
    await filterButton(page).click();
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/#\/settings$/);
  });
}

test('back closes an event sheet opened from a bar', async ({ page }) => {
  await open(page, '#/timeline');
  await page.getByTestId('bar').first().click();
  await expect(sheet(page)).toBeVisible();
  await page.goBack();
  await expect(sheet(page)).toBeHidden();
  await expect(page).toHaveURL(/#\/timeline$/);
  await expect(activeTab(page)).toHaveText('Timeline');
});

test("back closes a linked event's sheet", async ({ page }) => {
  await open(page, `#/timeline/gl/${BANNER}`);
  await expect(sheetTitle(page)).toContainText('Special Week');
  await page.goBack();
  await expect(sheet(page)).toBeHidden();
  await expect(page).toHaveURL(/#\/timeline$/);
  await expect(activeTab(page)).toHaveText('Timeline');
});

test('closing an event sheet leaves no extra history entry', async ({ page }) => {
  await open(page, '#/settings');
  await page.evaluate(() => {
    window.location.hash = '#/timeline';
  });
  await page.getByTestId('bar').first().click();
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
  await page.goBack();
  await expect(page).toHaveURL(/#\/settings$/);
});
