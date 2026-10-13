import { defineConfig, devices } from '@playwright/test';

// End-to-end tests (`pnpm test:e2e`, e2e/): the app in a real browser against the dev server, which they start (or
// reuse when one is already on the port). Phone-sized first: the app is mobile first. Needs the card data in
// generated/ (as `pnpm dev` does) and Playwright's Chromium (`pnpm exec playwright install chromium`).
// (E2E_PORT: parallel worktrees each on their own port; a server already on it is reused when not in CI.)
const PORT = Number(process.env.E2E_PORT ?? 5180);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${PORT}/`, trace: 'retain-on-failure' },
  // Pixel comparisons (e2e/visual.spec.ts) only in the `visual` projects (`pnpm test:visual`); baselines outside git.
  snapshotPathTemplate: `${process.env.VISUAL_BASELINE ?? '.visual-baseline'}/{projectName}/{arg}{ext}`,
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] }, testIgnore: 'visual.spec.ts' },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: 'visual.spec.ts' },
    { name: 'visual-phone', use: { ...devices['Pixel 7'] }, testMatch: 'visual.spec.ts' },
    { name: 'visual-desktop', use: { ...devices['Desktop Chrome'] }, testMatch: 'visual.spec.ts' },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
