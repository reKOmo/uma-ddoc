import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors, 'uncaught errors on the page').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const sheet = (page: Page) => page.getByRole('dialog');
export const sheetTitle = (page: Page) => sheet(page).getByRole('heading').first();

// The server switch's selected button ("Global" / "Japan"). The page behind an open sheet is hidden from the accessibility tree, the switch too.
export const server = (page: Page) =>
  page
    .getByRole('group', { name: 'Server', includeHidden: true })
    .getByRole('button', { pressed: true, includeHidden: true });

export const activeTab = (page: Page) =>
  page.getByRole('navigation', { includeHidden: true }).locator('a[aria-current="page"]');

// Loads an address on a fresh page (no saved state but what `storage` puts in localStorage first).
export async function open(page: Page, hash: string, storage: Record<string, string> = {}) {
  if (Object.keys(storage).length) {
    await page.addInitScript((items) => {
      for (const [key, value] of Object.entries(items)) window.localStorage.setItem(key, value);
    }, storage);
  }
  await page.goto(`/${hash}`);
}
