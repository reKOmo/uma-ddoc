// Usage: pnpm update-cards

import { updateCards } from './lib/cards/files.ts';
import { isMain } from './lib/paths.ts';

if (isMain(import.meta.url)) {
  try {
    await updateCards();
  } catch (err) {
    console.error(`Card data update failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
