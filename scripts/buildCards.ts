// Usage: pnpm build-cards

import { buildCardFiles } from './lib/cards/files.ts';
import { isMain } from './lib/paths.ts';

if (isMain(import.meta.url)) {
  try {
    await buildCardFiles();
  } catch (err) {
    console.error(`Card data build failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
