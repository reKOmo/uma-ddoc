import { expect, open, sheetTitle, test } from './fixtures.ts';

// A Global banner (Special Week's): her name is on its bar behind the sheet too.
const BANNER = 30003;

// The browser's find (Ctrl+F) can't be pressed from a test; Chromium's window.find() runs the same search, which skips
// the inert page under an open sheet.
test("the browser's find searches an open sheet, not the page behind it", async ({ page }) => {
  await open(page, `#/timeline/gl/${BANNER}`);
  await expect(sheetTitle(page)).toContainText('Special Week');
  const inSheet = await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
    // TODO(ts): window.find() is non-standard, missing from lib.dom.
    const find = (window as unknown as { find: (text: string) => boolean }).find;
    if (!find('Special Week')) return null;
    return !!window.getSelection()?.anchorNode?.parentElement?.closest('[role="dialog"]');
  });
  expect(inSheet).toBe(true);
});
