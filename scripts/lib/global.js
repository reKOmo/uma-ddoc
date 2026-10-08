// Global's own record of gacha banners and card releases, in data/ (committed):
//   data/global_banners.json  { source, characters: [banner…], cards: [banner…] }, newest first, in
//                             the shape scripts/scrape-gametora.js writes for JP
//   data/global_cards.json    { [card id]: { title_en, release_gl, news_url? } } for cards out on Global
// Seeded once from GameTora (pnpm scrape-gametora --seed-global) and kept up since from the official
// news (data/news/, pnpm update-global). Entries made from the news carry `news_url` (banners also
// `announced: true`); seeded ones are never changed.
//
// A scout post names its banners by gacha id, which Global shares with JP, so a banner from the
// news is JP's banner with that id (featured ids, icons, rates) under Global's dates and art, with
// the English names and titles the post lists.

import { readFileSync, writeFileSync } from 'node:fs';
import { DATA_DIR } from './paths.js';

export const BANNERS_FILE = `${DATA_DIR}global_banners.json`;
export const CARDS_FILE = `${DATA_DIR}global_cards.json`;

const RARITY = { R: 1, SR: 2, SSR: 3 };

// The highest rarity, then the highest rate (scrape-gametora.js's heuristic for `main`).
export function pickMain(featured) {
  return (
    featured.reduce(
      (best, item) =>
        !best || item.rarity > best.rarity || (item.rarity === best.rarity && item.rate > best.rate) ? item : best,
      null
    ) ?? null
  );
}

const norm = (s) =>
  (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Posts end banners at "9:59 p.m."; scraped banners end on the last second of that minute.
const endOfMinute = (iso) => iso?.replace(/:00(\.000)?Z$/, ':59.000Z');
const isoMs = (iso) => new Date(iso).toISOString();

// Pairs a JP banner's items with the post's English list ({ name, title, rarity|stars }): by
// character name first (`names`: char_id → English name), then, if one item and one entry are
// left, with each other. Returns [{ item, entry }] (entry null when unmatched).
function pairEnglish(items, entries, names, pairLeftovers) {
  const left = [...entries];
  const pairs = items.map((item) => {
    const i = left.findIndex((e) => names.get(item.char_id) && norm(e.name) === norm(names.get(item.char_id)));
    return { item, entry: i >= 0 ? left.splice(i, 1)[0] : null };
  });
  const unpaired = pairs.filter((p) => !p.entry);
  if (pairLeftovers && unpaired.length === 1 && left.length === 1) unpaired[0].entry = left[0];
  return pairs;
}

// Rebuilds the news-made banners and card releases from every post (oldest first; a later post
// about the same banner wins), on top of the seeded ones. Pure.
//   posts     data/news/announcements.json's records
//   global    data/global_banners.json      cards  data/global_cards.json
//   jp        GameTora's JP banners (generated/jp_banners.json)
//   names     Map char_id → English name
// Returns { global, cards, banners: [{ banner, kind, post, unmatched }], skipped: [{ id, post, reason }] }.
export function applyNews({ posts, global, cards, jp, names }) {
  const seeded = (list) => list.filter((b) => !b.news_url);
  const kinds = { characters: seeded(global.characters), cards: seeded(global.cards) };
  const seededIds = new Set([...kinds.characters, ...kinds.cards].map((b) => b.id));
  const jpBanners = new Map();
  for (const kind of ['characters', 'cards']) for (const b of jp[kind]) jpBanners.set(b.id, { kind, banner: b });

  // id → { post, announced } from the newest post naming it.
  const announced = new Map();
  for (const post of [...posts].sort((a, b) => (a.posted ?? '').localeCompare(b.posted ?? ''))) {
    for (const b of post.banners ?? []) if (b.start) announced.set(b.id, { post, announced: b });
  }

  const made = [];
  const skipped = [];
  for (const [id, { post, announced: a }] of announced) {
    if (seededIds.has(id)) continue;
    const source = jpBanners.get(id);
    if (!source) {
      skipped.push({ id, post: post.url, reason: 'no JP banner has this id' });
      continue;
    }
    const { kind, banner: jpBanner } = source;
    const sameKind = post.banners.filter((b) => jpBanners.get(b.id)?.kind === kind).length;
    const entries =
      kind === 'cards'
        ? post.cards.map((c) => ({ ...c, rarity: RARITY[c.rarity] }))
        : post.trainees.map((t) => ({ ...t, rarity: t.stars }));
    const pairs = pairEnglish(jpBanner.featured, entries, names, sameKind === 1);
    const featured = pairs.map(({ item, entry }) => ({
      ...item,
      name: entry?.name ?? names.get(item.char_id) ?? item.name,
      title: entry ? `[${entry.title}]` : item.title,
    }));
    const lengthMs = Date.parse(jpBanner.end) - Date.parse(jpBanner.start);
    const banner = {
      id,
      image: a.image ?? jpBanner.image,
      start: isoMs(a.start),
      end: a.end ? endOfMinute(isoMs(a.end)) : new Date(Date.parse(a.start) + lengthMs).toISOString(),
      main: null,
      featured,
      announced: true,
      news_url: post.url,
    };
    made.push({
      banner,
      kind,
      post: post.url,
      unmatched: pairs.filter((p) => !p.entry).map((p) => `${p.item.title ?? ''} ${p.item.name ?? p.item.id}`.trim()),
    });
  }

  // Card releases: the seeded ones, then each news-made card banner's cards that weren't out yet.
  const nextCards = Object.fromEntries(Object.entries(cards).filter(([, c]) => !c.news_url));
  const firstOutfit = new Map();
  for (const b of kinds.characters) for (const item of b.featured) firstOutfit.set(item.id, b.start);
  made.sort((x, y) => x.banner.start.localeCompare(y.banner.start) || x.banner.id - y.banner.id);
  for (const { banner, kind } of made) {
    const day = banner.start.slice(0, 10);
    for (const item of banner.featured) {
      if (kind === 'cards') {
        const known = nextCards[item.id]?.release_gl;
        item.new = !known || known >= day;
        if (!known) nextCards[item.id] = { title_en: item.title ?? null, release_gl: day, news_url: banner.news_url };
      } else {
        const first = firstOutfit.get(item.id);
        item.new = !first || first >= banner.start;
        if (!first) firstOutfit.set(item.id, banner.start);
      }
    }
    banner.main = pickMain(banner.featured);
    kinds[kind].push(banner);
  }

  const newestFirst = (a, b) => b.start.localeCompare(a.start) || b.id - a.id;
  return {
    global: { ...global, characters: kinds.characters.sort(newestFirst), cards: kinds.cards.sort(newestFirst) },
    cards: Object.fromEntries(Object.entries(nextCards).sort(([a], [b]) => Number(a) - Number(b))),
    banners: made,
    skipped,
  };
}

// char_id → English name, from Global's banners and our card metadata (by the JP card banners'
// card ids, which carry char_id).
export function englishNames(global, jp, metadata) {
  const names = new Map();
  for (const b of jp.cards) {
    for (const item of b.featured) {
      const name = metadata[item.id]?.name_en;
      if (name && item.char_id && !metadata[item.id]?.group) names.set(item.char_id, name);
    }
  }
  for (const b of [...global.characters, ...global.cards])
    for (const item of b.featured) if (item.char_id && item.name) names.set(item.char_id, item.name);
  return names;
}

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// One banner / card per line, so commits diff per entry (the files are excluded from Biome).
export function writeGlobal({ global, cards }) {
  const list = (items) => (items.length ? `[\n${items.map((b) => JSON.stringify(b)).join(',\n')}\n]` : '[]');
  writeFileSync(
    BANNERS_FILE,
    `{\n"source": ${JSON.stringify(global.source)},\n"characters": ${list(global.characters)},\n"cards": ${list(global.cards)}\n}\n`
  );
  const entries = Object.entries(cards).map(([id, c]) => `${JSON.stringify(id)}: ${JSON.stringify(c)}`);
  writeFileSync(CARDS_FILE, `{\n${entries.join(',\n')}\n}\n`);
}
