import { defineConfig } from 'vitest/config';

// Two projects: `unit` (pnpm test) needs only generated/ card data; `upstream`
// (pnpm test:upstream) also needs the upstream clone (pnpm clone-upstream).
export default defineConfig({
  test: {
    globalSetup: ['test/global-setup.js'],
    testTimeout: 60000,
    projects: [
      { extends: true, test: { name: 'unit', include: ['test/**/*.test.{js,jsx}'], exclude: ['test/upstream/**'] } },
      { extends: true, test: { name: 'upstream', include: ['test/upstream/**/*.test.js'] } },
    ],
  },
});
