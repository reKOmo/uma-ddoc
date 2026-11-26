// Usage: pnpm fetch-pull-guide   (run after `pnpm predict-gl`, so predicted banners get their cards too)
// Writes generated/pull_guide.json (its shape: schemas/pull_guide.schema.json) and the sheet's date in sources.json.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { SCRAPER_HEADERS, getText, paced } from './lib/http.ts';
import { readJson } from './lib/json.ts';
import { GENERATED_DIR, dataFile, isMain } from './lib/paths.ts';
import { writeSources } from './lib/sources.ts';
import { SHEET_URL, byBanner, parseSheetList, parseTab, parseUpdated, tabUrl } from './lib/cards/pull-guide.ts';
import type { BannerFile } from '../shared/schemas/banner.ts';
import type { PullGuide } from '../shared/schemas/pullGuide.ts';

const PULL_GUIDE_FILE = `${GENERATED_DIR}pull_guide.json`;
// The file's shape (relative to it, so editors pick it up).
const SCHEMA = '../schemas/pull_guide.schema.json';

const PREDICTED_BANNERS_FILE = `${GENERATED_DIR}predicted_global_banners.json`;

function readBanners(): BannerFile['cards'] {
  const read = (file: string): BannerFile['cards'] => readJson<BannerFile>(file).cards;
  if (!existsSync(PREDICTED_BANNERS_FILE)) console.warn('pull guide: no predicted banners, run pnpm predict-gl first');
  return [
    ...read(dataFile('gl', 'banners')),
    ...(existsSync(PREDICTED_BANNERS_FILE) ? read(PREDICTED_BANNERS_FILE) : []),
  ];
}

const pace = paced({ pause: [1000, 2000], first: true });

async function fetchPullGuide() {
  const sheets = parseSheetList(await getText(`${SHEET_URL}/htmlview`, { headers: SCRAPER_HEADERS }));
  if (sheets.length === 0) throw new Error('pull guide: no tabs found in the sheet (format changed?)');
  let updated: string | null = null;
  const pages: { name: string; gid: string; html: string }[] = [];
  for (const { name, gid } of sheets) {
    const html = await pace(() => getText(tabUrl(gid), { headers: SCRAPER_HEADERS }));
    updated ??= parseUpdated(html);
    pages.push({ name, gid, html });
  }
  // Notes are joined with every card name in the sheet at hand, so parse twice.
  const names: string[] = [...new Set(pages.flatMap(({ html }) => parseTab(html).entries.map((e) => e.name)))];
  const tabs: (ReturnType<typeof parseTab> & { name: string; gid: string })[] = [];
  for (const { name, gid, html } of pages) {
    const tab = parseTab(html, names);
    if (tab.entries.length === 0) continue;
    tabs.push({ name, gid, ...tab });
    console.log(`${name}: ${tab.entries.length} cards`);
  }
  const { banners, noBanner }: Pick<PullGuide, 'banners' | 'noBanner'> = byBanner(tabs, readBanners());
  const count = Object.keys(banners).length + Object.keys(noBanner).length;
  if (count === 0) throw new Error('pull guide: no cards found (format changed?)');
  // Free cards (events, stories, the shop) are on no banner; anything else should have been on one.
  for (const [id, entry] of Object.entries(noBanner)) {
    if (entry.shouldPull !== 'free')
      console.warn(`pull guide: card ${id} (row ${entry.googleSheetsSrc.row}) on no banner`);
  }
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(PULL_GUIDE_FILE, `${JSON.stringify({ $schema: SCHEMA, banners, noBanner }, null, 1)}\n`);
  writeSources({
    'pull_guide.json': { url: SHEET_URL, updated, fetched_at: new Date().toISOString() },
  });
  console.log(
    `${Object.keys(banners).length} banners, ${Object.keys(noBanner).length} cards on none (updated ${updated ?? 'unknown'}) → ${PULL_GUIDE_FILE}`
  );
}

if (isMain(import.meta.url)) {
  fetchPullGuide().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
