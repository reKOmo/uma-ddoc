// Scrapes JP's gacha banner history, the support card list and the Career scenarios from GameTora
// (https://gametora.com/umamusume/gacha/history) into:
//   generated/jp_banners.json
//   generated/raw/gametora_cards.json    the support card list (then rebuilds the card data, see
//                                        scripts/build-cards.js)
//   data/scenarios.json              JP's side only: launch times, links, new scenarios
//                                    (see scripts/lib/scenarios.js)
// Global isn't scraped any more: it has its own record in data/ (scripts/lib/global.js), kept up
// from the official news. `--seed-global` writes that record's starting point from GameTora's
// Global data: data/global_banners.json + data/global_cards.json if missing (or with `--force`), and Global launch
// times of scenarios that have none yet. (Global's events come from the news alone: scripts/lib/events.js.)
//
// A banner file holds { source, characters: [banner…], cards: [banner…] }, newest first,
// where a banner is
//   { id, image, start, end, main, featured: [item…] }
// and an item is { id, char_id, name, title, rarity, icon, rate, new }, plus
// `type` (speed, stamina, …) for support cards.
// `featured` lists every rate-up item; `main` is the one with the highest
// rarity (then highest rate). Character items are trainee outfits (6-digit
// ids); card items are support cards, whose ids match our card data.
//
// raw/gametora_cards.json is GameTora's support card list as it is, cut to the fields we read: ids,
// names, titles, type, rarity, JP release date ("YYYY-MM-DD"), how it's obtained, the page's URL slug
// (not derivable from the name). Not its Global fields: Global's titles and dates are our own
// (data/global_cards.json).
//
// The history page loads its data from GameTora's versioned JSON files, so
// this reads those directly instead of parsing HTML.
//
// Usage: pnpm scrape-gametora [--seed-global [--force]]

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DATA_DIR, GENERATED_DIR } from './lib/paths.js';
import { BANNERS_FILE, pickMain, writeGlobal } from './lib/global.js';
import { fillColors, mergeGametora, readScenarios, writeScenarios } from './lib/scenarios.js';
import { writeSources } from './lib/sources.js';
import { GAMETORA_CARDS_FILE, buildCardFiles } from './build-cards.js';

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

// GameTora's server keys and the language fields used for each.
const SERVERS = {
  jp: { key: 'ja', prefix: '', char: ['name_jp', 'title_jp'], card: ['name_jp', 'title_ja'] },
  global: { key: 'en', prefix: 'en/', char: ['name_en', 'title_en_gl'], card: ['char_name', 'title_en'] },
};

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

// Data files are versioned: the manifest maps each name to its current hash.
async function loadData(names) {
  const manifest = await getJson(`${SITE}/data/manifests/umamusume.json`);
  const files = await Promise.all(
    names.map((name) => {
      if (!manifest[name]) throw new Error(`GameTora no longer lists data file "${name}"`);
      return getJson(`${SITE}/data/umamusume/${name}.${manifest[name]}.json`);
    })
  );
  return Object.fromEntries(names.map((name, i) => [name, files[i]]));
}

const iso = (unixSeconds) => new Date(unixSeconds * 1000).toISOString();

function toBanner(raw, server, describe) {
  const featured = raw.pickups.map(([id, rate, isNew]) => ({ ...describe(id), rate, new: isNew }));
  const main = pickMain(featured);
  return {
    id: raw.id,
    image: `${SITE}/images/umamusume/${server.prefix}gacha/img_bnr_gacha_${raw.id}.png`,
    start: iso(raw.start),
    end: iso(raw.end),
    main,
    featured,
  };
}

export async function scrapeBanners({ seedGlobal = false, force = false } = {}) {
  // Seeding writes Global's banners + cards if missing (--force: rewrite them, news-made entries too).
  const seedBanners = seedGlobal && (force || !existsSync(BANNERS_FILE));
  if (seedGlobal && !seedBanners)
    console.log('data/ has Global banners already (--force rewrites them); not seeding those');
  const servers = seedBanners ? SERVERS : { jp: SERVERS.jp };
  const names = ['character-cards', 'support-cards', 'scenarios'];
  for (const server of Object.values(servers)) {
    names.push(`${server.prefix}gacha/char-standard`, `${server.prefix}gacha/support-standard`);
  }
  const data = await loadData(names);
  const characters = new Map(data['character-cards'].map((c) => [c.card_id, c]));
  const cards = new Map(data['support-cards'].map((c) => [c.support_id, c]));

  mkdirSync(`${GENERATED_DIR}raw`, { recursive: true });
  const supportCards = data['support-cards'].map((c) =>
    Object.fromEntries(CARD_FIELDS.map((field) => [field, c[field] ?? null]))
  );
  writeFileSync(GAMETORA_CARDS_FILE, `[\n${supportCards.map((c) => JSON.stringify(c)).join(',\n')}\n]\n`);
  writeSources({
    'raw/gametora_cards.json': { url: `${SITE}/umamusume/supports`, fetched_at: new Date().toISOString() },
  });
  console.log(`gametora_cards: ${supportCards.length} support cards`);
  await buildCardFiles();

  mkdirSync(DATA_DIR, { recursive: true });
  const scenarios = mergeGametora(readScenarios().scenarios, data.scenarios, { seedGlobal });
  // Cover colours: only covers without one are downloaded (once each).
  const colored = await fillColors(scenarios, HEADERS);
  if (colored) console.log(`scenario colours: ${colored} computed from their covers`);
  writeScenarios({ jp: `${SITE}/umamusume/scenarios`, en: 'official news (pnpm update-global)' }, scenarios);
  const onGlobal = scenarios.filter((s) => s.en_start_date && s.en_start_date.tag !== 'predicted').length;
  console.log(`scenarios: ${scenarios.length} on JP, ${onGlobal} with a known Global launch`);
  for (const [name, server] of Object.entries(servers)) {
    const describeCharacter = (id) => {
      const c = characters.get(id);
      if (!c) return { id, char_id: null, name: null, title: null, rarity: null, icon: null };
      const icon = `${SITE}/images/umamusume/characters/thumb/chara_stand_${c.char_id}_${id}.png`;
      return { id, char_id: c.char_id, name: c[server.char[0]], title: c[server.char[1]], rarity: c.rarity, icon };
    };
    const describeCard = (id) => {
      const c = cards.get(id);
      if (!c) return { id, char_id: null, name: null, title: null, rarity: null, type: null, icon: null };
      const icon = `${SITE}/images/umamusume/supports/support_card_s_${id}.png`;
      return {
        id,
        char_id: c.char_id,
        name: c[server.card[0]],
        title: c[server.card[1]],
        rarity: c.rarity,
        type: c.type,
        icon,
      };
    };
    const newestFirst = (a, b) => b.start.localeCompare(a.start) || b.id - a.id;
    const result = {
      source: { site: `${SITE}/umamusume/gacha/history`, server: server.key, scraped_at: new Date().toISOString() },
      characters: data[`${server.prefix}gacha/char-standard`]
        .map((b) => toBanner(b, server, describeCharacter))
        .sort(newestFirst),
      cards: data[`${server.prefix}gacha/support-standard`]
        .map((b) => toBanner(b, server, describeCard))
        .sort(newestFirst),
    };
    if (name === 'global') {
      mkdirSync(DATA_DIR, { recursive: true });
      const released = data['support-cards'].filter((c) => c.release_en);
      const cards = Object.fromEntries(
        released.map((c) => [c.support_id, { title_en: c.title_en ?? null, release_gl: c.release_en }])
      );
      writeGlobal({ global: result, cards });
      console.log(`seeded data/: ${result.characters.length + result.cards.length} banners, ${released.length} cards`);
      continue;
    }
    writeFileSync(`${GENERATED_DIR}${name}_banners.json`, `${JSON.stringify(result, null, 1)}\n`);
    console.log(`${name}: ${result.characters.length} character banners, ${result.cards.length} card banners`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await scrapeBanners({
      seedGlobal: process.argv.includes('--seed-global'),
      force: process.argv.includes('--force'),
    });
  } catch (err) {
    console.error(`Banner scrape failed: ${err.message}`);
    process.exit(1);
  }
}
