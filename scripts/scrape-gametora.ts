// @ts-nocheck
// What we still take from GameTora (https://gametora.com/umamusume), into:
//   generated/raw/gametora_cards.json    the support card list, cut to the fields we read: ids, names, titles, type,
//                                        rarity, JP release date ("YYYY-MM-DD"), how it's obtained, the page's URL
//                                        slug (not derivable from the name). It augments the cards the JP news
//                                        shows that data/jp_cards.json lacks (id, type, charId, slug, English;
//                                        `pnpm update-jp`: scripts/lib/jp-cards.js) and gives every card's slug.
//                                        Then the card data is rebuilt (scripts/build-cards.js).
//   generated/raw/gametora_trainees.json trainee outfits { id, char_id, name, title } (Japanese): the id of a
//                                        trainee debuting on a JP banner (the news names it without one;
//                                        scripts/lib/jp-banners.js)
//   generated/raw/gametora_events.json   JP's story events, Champions Meetings and Legend Races (update-jp fills
//                                        them into data/jp_events.json where the JP news has none, and ml/ pairs
//                                        Global's events with them: scripts/lib/gametora-events.js)
//   data/scenarios.json                  JP's side only: launch times, links, new scenarios
//                                        (see scripts/lib/scenarios.js)
// Banners aren't scraped any more: both servers have their own record in data/ (data/jp_banners.json,
// data/global_banners.json: GameTora's history seeded them once, the official news keeps them up), and the app builds
// GameTora's image URLs (card art and icons, trainee icons, banner art) from ids.
//
// GameTora's pages are client-rendered, so this reads its versioned JSON files (the manifest maps each name to its
// current hash) instead of parsing HTML. An internal format: the script fails loudly if it changes.
//
// Usage: pnpm scrape-gametora
//        pnpm scrape-gametora --events   only the event history (the manifest + 3 files)

import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DATA_DIR, GENERATED_DIR } from './lib/paths.ts';
import { fillColors, mergeGametora, readScenarios, writeScenarios } from './lib/scenarios.ts';
import { writeSources } from './lib/sources.ts';
import { GAMETORA_EVENTS_FILE, GAMETORA_EVENT_FILES, cutEvents } from './lib/gametora-events.ts';
import { GAMETORA_CARDS_FILE, buildCardFiles } from './build-cards.ts';
import { readJpCards } from './lib/jp-cards.ts';
import { GAMETORA_TRAINEES_FILE } from './lib/jp-banners.ts';

// The support card fields raw/gametora_cards.json keeps.
const CARD_FIELDS = [
  'support_id',
  'char_id',
  'char_name',
  'name_jp',
  'title_en',
  'title_ja',
  'type',
  'rarity',
  'release',
  'obtained',
  'url_name',
];

const SITE = 'https://gametora.com';
const HEADERS = { 'User-Agent': 'uma-ddoc scraper (Umaddoc, static tier list site)' };

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

// Data files are versioned: the manifest maps each name to its current hash.
const getManifest = () => getJson(`${SITE}/data/manifests/umamusume.json`);
function dataUrl(manifest, name) {
  if (!manifest[name]) throw new Error(`GameTora no longer lists data file "${name}"`);
  return `${SITE}/data/umamusume/${name}.${manifest[name]}.json`;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One file at a time, 2 s apart.
async function loadData(names, manifest) {
  const files = {};
  for (const name of names) {
    await pause(2000);
    files[name] = await getJson(dataUrl(manifest, name));
  }
  return files;
}

// JP's event history (story events, Champions Meetings, Legend Races) → raw/gametora_events.json, cut to the fields
// update-jp reads (scripts/lib/gametora-events.js). One file at a time, 2 s apart.
export async function scrapeEvents(manifest) {
  const files = {};
  for (const { file } of Object.values(GAMETORA_EVENT_FILES)) {
    await pause(2000);
    files[file] = await getJson(dataUrl(manifest, file));
  }
  const events = cutEvents(files);
  mkdirSync(`${GENERATED_DIR}raw`, { recursive: true });
  const lines = Object.entries(events).map(
    ([kind, list]) => `${JSON.stringify(kind)}: [\n${list.map((e) => JSON.stringify(e)).join(',\n')}\n]`
  );
  writeFileSync(GAMETORA_EVENTS_FILE, `{\n${lines.join(',\n')}\n}\n`);
  writeSources({
    'raw/gametora_events.json': { url: `${SITE}/umamusume/events`, fetched_at: new Date().toISOString() },
  });
  console.log(
    `gametora_events: ${Object.entries(events)
      .map(([kind, list]) => `${list.length} ${kind}`)
      .join(', ')}`
  );
  return events;
}

// The support card list (raw/gametora_cards.json, then the card data is rebuilt) and the Career scenarios
// (data/scenarios.json's JP side), then the event history.
export async function scrapeGametora() {
  const manifest = await getManifest();
  const data = await loadData(['support-cards', 'character-cards', 'scenarios'], manifest);

  mkdirSync(`${GENERATED_DIR}raw`, { recursive: true });
  const supportCards = data['support-cards'].map((c) =>
    Object.fromEntries(CARD_FIELDS.map((field) => [field, c[field] ?? null]))
  );
  writeFileSync(GAMETORA_CARDS_FILE, `[\n${supportCards.map((c) => JSON.stringify(c)).join(',\n')}\n]\n`);
  writeSources({
    'raw/gametora_cards.json': { url: `${SITE}/umamusume/supports`, fetched_at: new Date().toISOString() },
  });
  // Trainee outfits, only for a trainee debuting on a JP banner (the news names it without an id): scripts/lib/
  // jp-banners.js resolves the rest from our own banners.
  const trainees = data['character-cards'].map((c) => ({
    id: c.card_id,
    char_id: c.char_id,
    name: c.name_jp ?? null,
    title: c.title_jp ?? null,
  }));
  writeFileSync(GAMETORA_TRAINEES_FILE, `[\n${trainees.map((t) => JSON.stringify(t)).join(',\n')}\n]\n`);
  writeSources({
    'raw/gametora_trainees.json': { url: `${SITE}/umamusume/characters`, fetched_at: new Date().toISOString() },
  });
  console.log(`gametora_trainees: ${trainees.length} trainee outfits`);
  const history = readJpCards();
  const added = supportCards.filter((c) => !history[c.support_id]).length;
  console.log(
    `gametora_cards: ${supportCards.length} support cards, ${added} not in data/jp_cards.json (pnpm update-jp adds those the JP news shows)`
  );
  await buildCardFiles();

  mkdirSync(DATA_DIR, { recursive: true });
  const scenarios = mergeGametora(readScenarios().scenarios, data.scenarios);
  // Cover colours: only covers without one are downloaded (once each).
  const colored = await fillColors(scenarios, HEADERS);
  if (colored) console.log(`scenario colours: ${colored} computed from their covers`);
  writeScenarios({ jp: `${SITE}/umamusume/scenarios`, en: 'official news (pnpm update-global)' }, scenarios);
  const onGlobal = scenarios.filter((s) => s.en_start_date && s.en_start_date.tag !== 'predicted').length;
  console.log(`scenarios: ${scenarios.length} on JP, ${onGlobal} with a known Global launch`);

  await scrapeEvents(manifest);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes('--events')) await scrapeEvents(await getManifest());
    else await scrapeGametora();
  } catch (err) {
    console.error(`GameTora scrape failed: ${err.message}`);
    process.exit(1);
  }
}
