// Fetches pull advice from Luh's Umamusume Support Card Encyclopedia (a public Google Sheet, see
// scripts/lib/pull-guide.js) into generated/pull_guide.json:
//   { banners: { [banner id]: { [card id]: advice } }, noBanner: { [card id]: advice } }
// with advice { googleSheetsSrc: { gid, row }, freePulls, shouldPull, comment, advice }: where the entry is in
// the sheet (src/pullGuide.js links there), the free pulls the banner gives, the pill (yes | no | free |
// whale | dolphin, plus the advice's "+"s; or null), the line under it, and the notes as one paragraph (see
// parsePull() in scripts/lib/pull-guide.js). Each entry is matched to one of Global's banners, real
// (data/) or predicted (generated/, optional: run after `pnpm predict-gl`); cards on no gacha banner
// (event, story, shop) go in `noBanner`, with `release: { label, date | month + part | dateText }`
// from the sheet (its future dates are the author's estimates). Its source (the sheet's URL and its
// "Latest update" date) goes in generated/sources.json.
//
// Its shape: schemas/pull_guide.schema.json.
//
// One request for the tab list, then one per tab, with short pauses (~15 requests).
//
// Usage: pnpm fetch-pull-guide

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { BANNERS_FILE } from './lib/global.ts';
import { GENERATED_DIR } from './lib/paths.ts';
import { writeSources } from './lib/sources.ts';
import { SHEET_URL, byBanner, parseSheetList, parseTab, parseUpdated, tabUrl } from './lib/pull-guide.ts';
import type { BannerFile } from '../shared/schemas/banner.ts';
import type { PullGuide } from '../shared/schemas/pullGuide.ts';

const HEADERS = { 'User-Agent': 'uma-ddoc scraper (Umaddoc, static tier list site)' };
export const PULL_GUIDE_FILE = `${GENERATED_DIR}pull_guide.json`;
// The file's shape (relative to it, so editors pick it up).
const SCHEMA = '../schemas/pull_guide.schema.json';

const PREDICTED_BANNERS_FILE = `${GENERATED_DIR}predicted_global_banners.json`;

// Global's banners, real then predicted (when `pnpm predict-gl` has run).
function readBanners(): BannerFile['cards'] {
  // TODO(ts): the banner files are ours, but JSON.parse gives unknown-shaped data: they're read as BannerFile.
  const read = (file: string): BannerFile['cards'] => (JSON.parse(readFileSync(file, 'utf8')) as BannerFile).cards;
  if (!existsSync(PREDICTED_BANNERS_FILE)) console.warn('pull guide: no predicted banners, run pnpm predict-gl first');
  return [...read(BANNERS_FILE), ...(existsSync(PREDICTED_BANNERS_FILE) ? read(PREDICTED_BANNERS_FILE) : [])];
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

export async function fetchPullGuide() {
  const sheets = parseSheetList(await getText(`${SHEET_URL}/htmlview`));
  if (sheets.length === 0) throw new Error('pull guide: no tabs found in the sheet (format changed?)');
  let updated: string | null = null;
  const pages: { name: string; gid: string; html: string }[] = [];
  for (const { name, gid } of sheets) {
    await pause();
    const html = await getText(tabUrl(gid));
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  fetchPullGuide().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
