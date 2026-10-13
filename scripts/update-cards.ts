// Downloads upstream's card lists and card events (scripts/lib/upstream.js) into generated/raw/upstream/,
// as downloaded, records the commit in generated/sources.json and rebuilds the card data from them
// (scripts/build-cards.js).
//
// Usage: pnpm update-cards

import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DATA_FILES, REPO, UPSTREAM_RAW, download, latestRef } from './lib/upstream.ts';
import { GENERATED_DIR } from './lib/paths.ts';
import { readSources, writeSources } from './lib/sources.ts';
import { OUTPUTS, buildCardFiles } from './build-cards.ts';

const sourceKey = (file: { local: string }): string => `raw/upstream/${file.local}`;

export async function updateCards(): Promise<void> {
  const ref = await latestRef();
  console.log(`Fetching card data from ${REPO} @ ${ref.slice(0, 10)}…`);
  const texts = await download(ref, DATA_FILES);

  // Written next to the old files and swapped in, so a failure never leaves them half-written.
  const tmp = `${UPSTREAM_RAW.slice(0, -1)}.tmp/`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  for (const file of DATA_FILES) {
    const header = `// Downloaded from https://github.com/${REPO}/blob/${ref}/${file.upstream}\n// by scripts/update-cards.js — do not edit.\n\n`;
    writeFileSync(tmp + file.local, header + texts[file.upstream]);
  }
  rmSync(UPSTREAM_RAW, { recursive: true, force: true });
  renameSync(tmp, UPSTREAM_RAW);
  const source = { repo: REPO, ref, fetched_at: new Date().toISOString() };
  writeSources(Object.fromEntries(DATA_FILES.map((file) => [sourceKey(file), source])));
  await buildCardFiles();
}

// Fetches upstream's card data if this checkout is missing it, and builds the card data if that's missing.
export async function ensureCards(): Promise<void> {
  const sources = readSources();
  if (DATA_FILES.some((file) => !existsSync(UPSTREAM_RAW + file.local) || !sources[sourceKey(file)])) {
    await updateCards();
  } else if (OUTPUTS.some((name) => !existsSync(GENERATED_DIR + name))) {
    await buildCardFiles();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await updateCards();
  } catch (err) {
    console.error(`Card data update failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
