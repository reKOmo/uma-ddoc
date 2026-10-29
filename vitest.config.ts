import { defineConfig } from 'vitest/config';

// Two projects: `unit` (pnpm test) needs only generated/ card data; `upstream`
// (pnpm test:upstream) also needs the upstream clone (pnpm clone-upstream).
export default defineConfig({
  test: {
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 60000,
    // CI's required check runs everything else (test:code); new news can fail these without the code being wrong.
    tags: [{ name: 'data', description: 'reads the stored news, the records or generated/ as a whole' }],
    projects: [
      { extends: true, test: { name: 'unit', include: ['test/**/*.test.{ts,tsx}'], exclude: ['test/upstream/**'] } },
      { extends: true, test: { name: 'upstream', include: ['test/upstream/**/*.test.ts'] } },
    ],
  },
});
