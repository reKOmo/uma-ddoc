// Fetches pull advice from Luh's Umamusume Support Card Encyclopedia (a public Google Sheet, see
// scripts/lib/pull-guide.js) into generated/pull_guide.json:
//   { source: { url, updated }, cards: { [id]: [entry…] } }
// where an entry is one banner of the card, oldest first:
//   { scenario, tab, gid, row, name, label, date | month + part | date_text, free_pulls, pull, verdict, pill, advice,
//     notes: [text…] }
// `scenario` is our key for the tab's scenario era (data/scenarios.json; null if unknown), `gid` + `row`
// where the entry is in the sheet (src/pullGuide.js links there), `label` the
// banner kind the sheet notes ("Event", "Rerun", "Story"…), `verdict` yes | no | free | whale |
// dolphin or null, `pill` / `advice` / notes as split by parsePull() in scripts/lib/pull-guide.js.
// The sheet's dates are Global's; future ones are the author's estimates (`month` + early/late).
//
// One request for the tab list, then one per tab, with short pauses (~15 requests).
//
// Usage: pnpm fetch-pull-guide

import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GENERATED_DIR } from './lib/paths.js';
import { readScenarios } from './lib/scenarios.js';
import { SHEET_URL, byCard, parseSheetList, parseTab, parseUpdated, scenarioKey, tabUrl } from './lib/pull-guide.js';

const HEADERS = { 'User-Agent': 'uma-ddoc scraper (Umaddoc, static tier list site)' };
export const PULL_GUIDE_FILE = `${GENERATED_DIR}pull_guide.json`;

const pause = () => new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

async function getText(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

export async function fetchPullGuide() {
  const sheets = parseSheetList(await getText(`${SHEET_URL}/htmlview`));
  if (sheets.length === 0) throw new Error('pull guide: no tabs found in the sheet (format changed?)');
  const scenarios = readScenarios().scenarios;
  let updated = null;
  const pages = [];
  for (const { name, gid } of sheets) {
    await pause();
    const html = await getText(tabUrl(gid));
    updated ??= parseUpdated(html);
    pages.push({ name, gid, html });
  }
  // Notes are joined with every card name in the sheet at hand, so parse twice.
  const names = [...new Set(pages.flatMap(({ html }) => parseTab(html).entries.map((e) => e.name)))];
  const tabs = [];
  for (const { name, gid, html } of pages) {
    const tab = parseTab(html, names);
    if (tab.entries.length === 0) continue;
    tabs.push({ name, gid, ...tab });
    console.log(`${name}: ${tab.entries.length} cards`);
  }
  const cards = byCard(tabs, scenarios);
  if (Object.keys(cards).length === 0) throw new Error('pull guide: no cards found (format changed?)');
  for (const { name, slug } of tabs) {
    if (slug && !scenarioKey(slug, scenarios))
      console.warn(`pull guide: tab "${name}" links "${slug}", not a known scenario`);
  }
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(PULL_GUIDE_FILE, `${JSON.stringify({ source: { url: SHEET_URL, updated }, cards }, null, 1)}\n`);
  console.log(`${Object.keys(cards).length} cards (updated ${updated ?? 'unknown'}) → ${PULL_GUIDE_FILE}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  fetchPullGuide().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
