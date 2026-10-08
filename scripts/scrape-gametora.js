// Scrapes JP's gacha banner history and the support card list from GameTora
// (https://gametora.com/umamusume/gacha/history) into:
//   generated/jp_banners.json
//   generated/gametora_cards.json
// Global isn't scraped any more: it has its own record in data/ (scripts/lib/global.js), kept up
// from the official news. `--seed-global` writes that record's starting point from GameTora's
// Global data (data/global_banners.json + data/global_cards.json); it refuses to overwrite one
// unless `--force` is given too.
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
// gametora_cards.json maps every support card id to
//   { url, title_en, title_jp, release_gl, release_jp }
// for the card page (GameTora's URL slugs can't be derived from the name alone).
// Release dates are "YYYY-MM-DD", or null if the card isn't out on that server
// (a few Global promo cards have no date either). Its Global fields are GameTora's: the site
// reads Global titles and dates from data/global_cards.json instead (src/cardInfo.js, ml/data.py).
//
// The history page loads its data from GameTora's versioned JSON files, so
// this reads those directly instead of parsing HTML.
//
// Usage: pnpm scrape-gametora [--seed-global [--force]]

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DATA_DIR, GENERATED_DIR } from './lib/paths.js';
import { BANNERS_FILE, pickMain, writeGlobal } from './lib/global.js';

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
  if (seedGlobal && existsSync(BANNERS_FILE) && !force)
    throw new Error('data/ already has Global banners; --force overwrites them (and every news-made entry)');
  const servers = seedGlobal ? SERVERS : { jp: SERVERS.jp };
  const names = ['character-cards', 'support-cards'];
  for (const server of Object.values(servers)) {
    names.push(`${server.prefix}gacha/char-standard`, `${server.prefix}gacha/support-standard`);
  }
  const data = await loadData(names);
  const characters = new Map(data['character-cards'].map((c) => [c.card_id, c]));
  const cards = new Map(data['support-cards'].map((c) => [c.support_id, c]));

  mkdirSync(GENERATED_DIR, { recursive: true });
  const cardInfo = Object.fromEntries(
    data['support-cards'].map((c) => [
      c.support_id,
      {
        url: `${SITE}/umamusume/supports/${c.url_name}`,
        title_en: c.title_en ?? null,
        title_jp: c.title_ja ?? null,
        release_gl: c.release_en ?? null,
        release_jp: c.release ?? null,
      },
    ])
  );
  writeFileSync(`${GENERATED_DIR}gametora_cards.json`, `${JSON.stringify(cardInfo)}\n`);
  console.log(`gametora_cards: ${Object.keys(cardInfo).length} support cards`);
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
