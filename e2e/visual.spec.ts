// Screens compared pixel by pixel with a baseline (`pnpm test:visual`, the `visual` project only): for restyling
// that must not change how the app looks (the CSS Modules move). Baselines are made on this machine from a known-good
// commit (`pnpm test:visual --update-snapshots`) and kept out of git (fonts render differently elsewhere): in
// .visual-baseline/, or $VISUAL_BASELINE (a worktree can compare against the main checkout's). Remote art is blocked
// (it loads at its own pace) and the clock fixed, so runs compare.

import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const options = (p: Page) => p.getByRole('button', { name: /Options/ });
const SCREENS: Record<string, { hash: string; act?: (page: Page) => Promise<void> }> = {
  cards: { hash: '#/' },
  'cards-filter': { hash: '#/', act: (p) => options(p).click() },
  // (the dropdown's button: today's custom one, or a combobox once it's Radix Select)
  'cards-scenario-open': {
    hash: '#/',
    act: (p) => p.locator('[aria-haspopup="listbox"], [role="combobox"]').first().click(),
  },
  'timeline-gl': { hash: '#/timeline' },
  'timeline-jp': { hash: '#/timeline/jp/30003', act: (p) => p.keyboard.press('Escape') },
  'timeline-filter': { hash: '#/timeline', act: (p) => options(p).click() },
  'timeline-order': {
    hash: '#/timeline',
    act: async (p) => {
      await options(p).click();
      // (after the sheet has slid in: 500 ms; clicking while it moves left its content scrolled under load)
      await p.getByRole('dialog').waitFor();
      await p.waitForTimeout(700);
      await p.getByRole('dialog').getByRole('button', { name: 'Order' }).click();
    },
  },
  'banner-sheet': { hash: '#/timeline/gl/30003' },
  'event-sheet': { hash: '#/timeline/gl/1076' },
  card: { hash: '#/card/30126' },
  'card-full': { hash: '#/card/30001' },
  scenarios: { hash: '#/scenarios' },
  scenario: { hash: '#/scenario/URA' },
  settings: { hash: '#/settings' },
};

for (const scheme of ['light', 'dark'] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme, reducedMotion: 'reduce' });
    for (const [name, { hash, act }] of Object.entries(SCREENS)) {
      test(name, async ({ page, context }) => {
        await context.route(
          (url) => url.hostname !== 'localhost',
          (route) => route.abort()
        );
        await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
        await page.goto(`/${hash}`);
        await page.waitForTimeout(2500);
        if (act) {
          await act(page);
          await page.waitForTimeout(1500);
        }
        await expect(page).toHaveScreenshot(`${scheme}-${name}.png`, {
          fullPage: true,
          threshold: 0,
          maxDiffPixels: 60,
        });
      });
    }
  });
}
