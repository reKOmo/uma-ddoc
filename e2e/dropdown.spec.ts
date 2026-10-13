// The app's dropdown (src/Dropdown.tsx, on Radix Select), as the Cards tab's Scenario picker: chosen by pointer (a tap
// on phones), by keyboard, closed by Escape; disabled options (scenarios the tier list doesn't rank) can't be chosen.

import type { Page } from '@playwright/test';
import { expect, open, test } from './fixtures.ts';

const picker = (page: Page) => page.getByRole('combobox').first();
const list = (page: Page) => page.getByRole('listbox');

test('a click opens the list and choosing an option changes the scenario', async ({ page }) => {
  await open(page, '#/');
  await picker(page).click();
  await expect(list(page)).toBeVisible();
  await list(page).getByRole('option', { name: /^TB/ }).click();
  await expect(list(page)).toBeHidden();
  await expect(picker(page)).toContainText('TB');
});

test('the keyboard opens, moves and chooses; Escape closes', async ({ page }) => {
  await open(page, '#/');
  await picker(page).focus();
  await page.keyboard.press('Enter');
  await expect(list(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list(page)).toBeHidden();
  await expect(picker(page)).toContainText('GC');
  await page.keyboard.press('Enter');
  await expect(list(page)).toBeVisible();
  await page.keyboard.press('ArrowDown'); // GC → TB
  await page.keyboard.press('Enter');
  await expect(list(page)).toBeHidden();
  await expect(picker(page)).toContainText('TB');
});

test('a disabled option can not be chosen', async ({ page }) => {
  await open(page, '#/');
  await picker(page).click();
  // (scenarios the tier list doesn't rank yet: "Not in the tier list yet")
  const disabled = list(page).getByRole('option', { disabled: true }).first();
  await expect(disabled).toHaveAttribute('aria-disabled', 'true');
  await disabled.click({ force: true });
  await expect(list(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker(page)).toContainText('GC');
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('a tap opens the list and a tap chooses', async ({ page }) => {
    await open(page, '#/');
    await picker(page).tap();
    await expect(list(page)).toBeVisible();
    await list(page)
      .getByRole('option', { name: /^Unity/ })
      .tap();
    await expect(list(page)).toBeHidden();
    await expect(picker(page)).toContainText('Unity');
  });
});
