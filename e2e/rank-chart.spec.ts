import type { Locator, Page } from '@playwright/test';
import { expect, open, test } from './fixtures.ts';

const chart = (page: Page) => page.getByRole('img', { name: /Tier list position over time/ });
const container = (page: Page): Locator => chart(page).locator('xpath=../..');

test('the rank chart fits a phone, labels its ranks, tiers and scenarios, and zooms into a sideways scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page, '#/card/30001');
  await page.getByRole('group', { name: 'Server' }).getByRole('button', { name: 'Global' }).click();
  await expect(page.getByRole('heading', { name: 'Rank over time' })).toBeVisible();
  await expect(chart(page)).toBeVisible();

  // The card's whole life fits the width: nothing to scroll sideways.
  const fits = await container(page).evaluate((el) => {
    const svg = el.querySelector('svg');
    return !!svg && svg.getBoundingClientRect().width <= el.getBoundingClientRect().width + 1;
  });
  expect(fits).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await expect(
    container(page)
      .getByText(/^#\d+$/)
      .first()
  ).toBeVisible();
  await expect(
    container(page)
      .getByText(/^[SABCDEFG]$/)
      .first()
  ).toBeVisible();
  // The scenarios under the dates link to their pages.
  await expect(container(page).locator('a[href*="scenario"]').first()).toBeAttached();

  // Zoomed in, the plot outgrows the view and scrolls sideways; zoomed back out, it fits again.
  const scrolls = () =>
    chart(page).evaluate((el) => {
      const s = el.parentElement as HTMLElement;
      return s.scrollWidth > s.clientWidth;
    });
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(scrolls).toBe(true);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(scrolls).toBe(false);
});
