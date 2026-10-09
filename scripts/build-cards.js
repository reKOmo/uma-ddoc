// Builds the card data from the raw inputs (see scripts/lib/cards.js):
//   generated/raw/upstream/*.js           upstream's card lists + events (`pnpm update-cards`)
//   generated/raw/gametora_cards.json     GameTora's support cards (`pnpm scrape-gametora`; optional)
//   data/global_cards.json                Global's titles + release dates (`pnpm update-global`)
// into
//   generated/cards.json                          every card: names, titles, releases, links… (schemas/cards.schema.json)
//   generated/card_stats/gl_card_stats.json       the tier list calculation's inputs per server
//   generated/card_stats/jp_card_stats.json
// The scripts that update an input run it themselves; `pnpm build-cards` runs it by hand.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildCards } from './lib/cards.js';
import { CARDS_FILE as GLOBAL_CARDS_FILE } from './lib/global.js';
import { GENERATED_DIR } from './lib/paths.js';
import { readSources } from './lib/sources.js';
import { UPSTREAM_RAW } from './lib/upstream.js';

export const GAMETORA_CARDS_FILE = `${GENERATED_DIR}raw/gametora_cards.json`;
export const OUTPUTS = ['cards.json', 'card_stats/gl_card_stats.json', 'card_stats/jp_card_stats.json'];

// One card per line, so the files stay readable and diffable.
const perLine = (object) =>
  `{\n${Object.entries(object)
    .map(([id, value]) => `  ${JSON.stringify(id)}: ${JSON.stringify(value)}`)
    .join(',\n')}\n}\n`;

// The upstream modules as written now (the query skips Node's module cache).
const importFresh = async (path) => (await import(`${pathToFileURL(path)}?t=${Date.now()}`)).default;
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export async function buildCardFiles() {
  const { repo, ref } = readSources()['raw/upstream/gl.js'];
  const { cards, stats } = buildCards({
    upstream: {
      gl: await importFresh(`${UPSTREAM_RAW}gl.js`),
      jp: await importFresh(`${UPSTREAM_RAW}jp.js`),
      events: await importFresh(`${UPSTREAM_RAW}card-events.js`),
    },
    gametora: existsSync(GAMETORA_CARDS_FILE) ? readJson(GAMETORA_CARDS_FILE) : [],
    globalCards: existsSync(GLOBAL_CARDS_FILE) ? readJson(GLOBAL_CARDS_FILE) : {},
    iconBase: `https://raw.githubusercontent.com/${repo}/${ref}/public/cardImages/`,
  });
  mkdirSync(`${GENERATED_DIR}card_stats`, { recursive: true });
  writeFileSync(`${GENERATED_DIR}cards.json`, perLine(cards));
  for (const server of ['gl', 'jp']) {
    writeFileSync(`${GENERATED_DIR}card_stats/${server}_card_stats.json`, perLine(stats[server]));
  }
  const count = (o) => Object.keys(o).length;
  console.log(`cards: ${count(cards)} (stats for ${count(stats.gl)} on Global, ${count(stats.jp)} on JP)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await buildCardFiles();
  } catch (err) {
    console.error(`Card data build failed: ${err.message}`);
    process.exit(1);
  }
}
