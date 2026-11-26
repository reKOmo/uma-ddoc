// Usage: pnpm scrape-gametora
//        pnpm scrape-gametora --events   only the event history (the manifest + 3 files)
// GameTora's pages are client-rendered, so this reads its versioned JSON files (the manifest maps each name to its
// current hash) instead of parsing HTML. An internal format: the script fails loudly if it changes. Banners aren't
// scraped any more (data/ has both servers' records).

import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { SCRAPER_HEADERS, getJson, paced } from './lib/http.ts';
import { jsonEnvelope, jsonLines } from './lib/json.ts';
import { DATA_DIR, GENERATED_DIR, isMain } from './lib/paths.ts';
import { type GametoraScenario, fillColors, mergeGametora, readScenarios, writeScenarios } from './lib/scenarios.ts';
import { writeSources } from './lib/sources.ts';
import {
  GAMETORA_EVENTS_FILE,
  GAMETORA_EVENT_FILES,
  type GametoraRecord,
  cutEvents,
  pick,
} from './lib/events/gametora.ts';
import { GAMETORA_CARDS_FILE, buildCardFiles } from './lib/cards/files.ts';
import { readJpCards } from './lib/cards/jp.ts';
import { GAMETORA_TRAINEES_FILE } from './lib/banners/jp.ts';

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

type Manifest = Record<string, string>;
// A row of a GameTora data file (its internal format: the fields read here are cut and written out below).
type Row = Record<string, unknown>;

const get = (url: string): Promise<unknown> => getJson(url, { headers: SCRAPER_HEADERS });

// TODO(ts): GameTora's manifest (its internal format): dataUrl() fails loudly on a name it doesn't list.
const getManifest = async (): Promise<Manifest> => (await get(`${SITE}/data/manifests/umamusume.json`)) as Manifest;
function dataUrl(manifest: Manifest, name: string): string {
  if (!manifest[name]) throw new Error(`GameTora no longer lists data file "${name}"`);
  return `${SITE}/data/umamusume/${name}.${manifest[name]}.json`;
}

const pace = paced({ pause: [2000, 2000], first: true });

async function loadData(names: string[], manifest: Manifest): Promise<Record<string, unknown>> {
  const files: Record<string, unknown> = {};
  for (const name of names) {
    files[name] = await pace(() => get(dataUrl(manifest, name)));
  }
  return files;
}

async function scrapeEvents(manifest: Manifest): Promise<ReturnType<typeof cutEvents>> {
  const names = Object.values(GAMETORA_EVENT_FILES).map(({ file }) => file);
  // TODO(ts): GameTora's JSON, trusted as lists of records (cutEvents() reads only the fields it knows)
  const events = cutEvents((await loadData(names, manifest)) as Record<string, GametoraRecord[]>);
  mkdirSync(`${GENERATED_DIR}raw`, { recursive: true });
  writeFileSync(
    GAMETORA_EVENTS_FILE,
    `${jsonEnvelope(Object.entries(events).map(([kind, list]) => [kind, jsonLines(list)]))}\n`
  );
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

async function scrapeGametora(): Promise<void> {
  const manifest = await getManifest();
  const data = await loadData(['support-cards', 'character-cards', 'scenarios'], manifest);

  mkdirSync(`${GENERATED_DIR}raw`, { recursive: true });
  // TODO(ts): GameTora's rows (its internal format): the fields used here are cut and written out,
  // as the files have them.
  const supportRows = data['support-cards'] as Row[];
  const supportCards = supportRows.map((c) => pick(c, CARD_FIELDS));
  writeFileSync(GAMETORA_CARDS_FILE, `${jsonLines(supportCards)}\n`);
  writeSources({
    'raw/gametora_cards.json': { url: `${SITE}/umamusume/supports`, fetched_at: new Date().toISOString() },
  });
  // Only for a trainee debuting on a JP banner (the news names it without an id); banners/jp.ts resolves the rest from
  // our own banners.
  // TODO(ts): as above, GameTora's rows (only the trainee fields read here).
  const trainees = (data['character-cards'] as Row[]).map((c) => ({
    id: c.card_id,
    char_id: c.char_id,
    name: c.name_jp ?? null,
    title: c.title_jp ?? null,
  }));
  writeFileSync(GAMETORA_TRAINEES_FILE, `${jsonLines(trainees)}\n`);
  writeSources({
    'raw/gametora_trainees.json': { url: `${SITE}/umamusume/characters`, fetched_at: new Date().toISOString() },
  });
  console.log(`gametora_trainees: ${trainees.length} trainee outfits`);
  const history = readJpCards();
  const added = supportCards.filter((c) => !history[String(c.support_id)]).length;
  console.log(
    `gametora_cards: ${supportCards.length} support cards, ${added} not in data/jp_cards.json (pnpm update-jp adds those the JP news shows)`
  );
  await buildCardFiles();

  mkdirSync(DATA_DIR, { recursive: true });
  // TODO(ts): GameTora's scenario list, trusted as it is (mergeGametora() reads the fields it knows)
  const scenarios = mergeGametora(readScenarios().scenarios, data.scenarios as GametoraScenario[]);
  // Cover colours: only covers without one are downloaded (once each).
  const colored = await fillColors(scenarios, SCRAPER_HEADERS);
  if (colored) console.log(`scenario colours: ${colored} computed from their covers`);
  writeScenarios({ jp: `${SITE}/umamusume/scenarios`, en: 'official news (pnpm update-global)' }, scenarios);
  const onGlobal = scenarios.filter((s) => s.en_start_date && s.en_start_date.status !== 'predicted').length;
  console.log(`scenarios: ${scenarios.length} on JP, ${onGlobal} with a known Global launch`);

  await scrapeEvents(manifest);
}

if (isMain(import.meta.url)) {
  try {
    if (
      parseArgs({ args: process.argv.slice(2), options: { events: { type: 'boolean' } }, strict: false }).values.events
    )
      await scrapeEvents(await getManifest());
    else await scrapeGametora();
  } catch (err) {
    console.error(`GameTora scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
