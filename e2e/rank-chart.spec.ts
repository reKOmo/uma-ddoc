// The card page's rank chart (Rank over time): it's shown, scrolls sideways, and hovering a point shows its tooltip
// (date, rank, tier chip).

import type { Locator, Page } from '@playwright/test';
import { expect, open, test } from './fixtures.ts';

const chart = (page: Page) => page.getByRole('img', { name: /Tier list position over time/ });
// The chart's container (the scroller's parent): the tooltip sits in it, beside the scroller.
const container = (page: Page): Locator => chart(page).locator('xpath=../..');

const scrollLeft = (page: Page) => chart(page).evaluate((el) => (el.parentElement as HTMLElement).scrollLeft);

test('the rank chart shows, scrolls sideways, and a hovered point shows its tooltip', async ({ page }) => {
  // Global's history is short: at a desktop width the plot fits, so narrow the view until it scrolls.
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page, '#/card/30001');
  await page.getByRole('group', { name: 'Server' }).getByRole('button', { name: 'Global' }).click();
  await expect(page.getByRole('heading', { name: 'Rank over time' })).toBeVisible();
  await expect(chart(page)).toBeVisible();

  // It scrolls sideways: it opens on today (the right end), and wheeling left moves the plot.
  await expect
    .poll(() =>
      chart(page).evaluate((el) => {
        const s = el.parentElement as HTMLElement;
        return s.scrollWidth > s.clientWidth;
      })
    )
    .toBe(true);
  const before = await scrollLeft(page);
  expect(before).toBeGreaterThan(0);
  await container(page).scrollIntoViewIfNeeded();
  const box = await container(page).boundingBox();
  if (!box) throw new Error('the rank chart has no box');
  await page.mouse.move(box.x + box.width / 2, box.y + 60);
  await page.mouse.wheel(-3000, 0);
  await expect.poll(() => scrollLeft(page)).toBeLessThan(before);

  // Hovering a point shows the tooltip: its date, the rank of N, and the tier's chip.
  await page.mouse.move(box.x + box.width / 2, box.y + 60);
  await expect(
    container(page)
      .getByText(/#\d+ of \d+/)
      .first()
  ).toBeVisible();
  await expect(
    container(page)
      .getByText(/^[SABCDEFG]$/)
      .first()
  ).toBeVisible();

  // Leaving the chart hides it.
  await page.mouse.move(0, 0);
  await expect(container(page).getByText(/#\d+ of \d+/)).toHaveCount(0);
});
