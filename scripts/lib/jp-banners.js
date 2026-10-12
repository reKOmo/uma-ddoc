// JP's banners (data/jp_banners.json, committed): GameTora's history, seeded once (pnpm update-jp --seed), with the
// banners the JP news announces merged over it (docs/jp-news-plan.md, decision 2). Same shape as GameTora's file
// (generated/jp_banners.json, which pnpm scrape-gametora keeps writing: the seed and a check):
// { source, characters: [banner…], cards: [banner…] }, newest first, one banner per line.
//
// What the news adds (rebuilt from every post each time; seeded entries are never lost):
// - a banner GameTora has: `announced: true`, `news_url`, `news_image` (the post's official art; `image` stays
//   GameTora's). Its dates stay GameTora's (the news agrees on all of them; disagreements are listed). The R cards the
//   post lists (GameTora leaves them out) are added to its featured, each marked `from_news: true`.
// - a banner GameTora lacks (select-pickup supports, Twinkle Collection 30xxx, paid 50xxx): a new entry made from the
//   post, `from_news: true`, `image` = `news_image` = the official art, featured resolved to ids (support cards by
//   generated/cards.json's title.jp + name.jp, trainees by title + name on any GameTora banner; unresolved ones keep
//   their names with id null), R cards kept, `rate` null (posts don't give rates).
// - `paid: true` on paid banners (gacha id ≥ 50000; Global never runs them, ml/ and Global's news skip them).
// - re-runs (a scout re-held after an issue, decision 6): the original keeps its dates and gets `rerun: { id, start,
//   end }`; the re-run is GameTora's banner with the same featured starting then (its `rerunOf` = the original's id),
//   else a news-made entry with id `<original id>-rerun` (a string: the only ids that aren't numbers).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { bannerPost } from './banner-posts.js';
import { pickMain } from './global.js';
import { ja } from './news-lang/ja.js';
import { norm } from './news-text.js';
import { DATA_DIR, GENERATED_DIR } from './paths.js';

export const JP_BANNERS_FILE = `${DATA_DIR}jp_banners.json`;
export const GAMETORA_JP_FILE = `${GENERATED_DIR}jp_banners.json`;

const KINDS = ['characters', 'cards'];
const KIND_OF_TYPE = { character: 'characters', support: 'cards' };
const RARITY = { R: 1, SR: 2, SSR: 3 };
// cards.json's readable types → GameTora's, as the seeded banners have them.
const GAMETORA_TYPE = { wisdom: 'intelligence' };
// The keys the news adds to a seeded banner (taken off before each rebuild).
const NEWS_KEYS = ['announced', 'news_url', 'news_image', 'rerun', 'rerunOf', 'paid', 'name', 'note'];

// Posts end banners at "11:59"; GameTora's end on the last second of that minute.
const endOfMinute = (iso) => iso?.replace(/:00(\.000)?Z$/, ':59.000Z');
const key = (title, name) => `${norm(title)}|${norm(name)}`;
const sameItems = (a, b) =>
  a.length > 0 && a.length === b.length && a.every((x) => b.some((y) => y.id === x.id)) && a.every((x) => x.id != null);

// Banners Global could run and ml/ can learn from: not paid, not our own re-run entries (string ids), and as GameTora
// lists them (without the R cards the news adds to its banners).
export const isRegular = (banner) => !banner.paid && typeof banner.id === 'number';
const gametoraItems = (featured) => featured.filter((f) => !f.from_news);
const asGametora = (banner) => (banner.from_news ? banner : { ...banner, featured: gametoraItems(banner.featured) });
export const regularBanners = (jp) => ({
  ...jp,
  characters: jp.characters.filter(isRegular).map(asGametora),
  cards: jp.cards.filter(isRegular).map(asGametora),
});

// The featured item a post's entry ({ rarity|stars, title, name }) stands for: support cards by our card data,
// trainees by GameTora's banners.
function resolver({ cards, banners }) {
  const supports = new Map();
  for (const c of Object.values(cards)) if (c.title?.jp && c.name?.jp) supports.set(key(c.title.jp, c.name.jp), c);
  const trainees = new Map();
  for (const jp of banners)
    for (const b of jp?.characters ?? []) for (const f of b.featured) if (f.id) trainees.set(key(f.title, f.name), f);
  return (entry, kind) => {
    const title = `[${entry.title}]`;
    if (kind === 'cards') {
      const card = supports.get(key(entry.title, entry.name));
      return {
        id: card ? Number(card.id) : null,
        char_id: card?.charId ?? null,
        name: entry.name,
        title,
        rarity: RARITY[entry.rarity],
        type: card ? (GAMETORA_TYPE[card.type] ?? card.type) : null,
        icon: card?.images?.icon ?? null,
        rate: null,
      };
    }
    const trainee = trainees.get(key(entry.title, entry.name));
    return {
      id: trainee?.id ?? null,
      char_id: trainee?.char_id ?? null,
      name: entry.name,
      title,
      rarity: entry.stars,
      icon: trainee?.icon ?? null,
      rate: null,
    };
  };
}

// The news (scout posts as bannerPost(post, ja) reads them) merged over the stored banners (data/jp_banners.json).
// Pure and idempotent. `gametora`: GameTora's current file, only to resolve trainee ids (optional).
// Returns { jp, enriched, made, reruns, unresolved: [{ banner, item }], mismatches: [{ id, post, what }],
// skipped: [{ id, post, reason }] }.
export function applyJpNews({ posts, jp, cards, gametora = null }) {
  const kinds = {};
  for (const kind of KINDS)
    kinds[kind] = jp[kind]
      .filter((b) => !b.from_news)
      .map((b) => ({
        ...Object.fromEntries(Object.entries(b).filter(([k]) => !NEWS_KEYS.includes(k))),
        featured: gametoraItems(b.featured),
      }));
  const seeded = new Map();
  for (const kind of KINDS) for (const b of kinds[kind]) seeded.set(b.id, { kind, banner: b });
  const resolve = resolver({ cards, banners: [jp, gametora] });

  // id → the newest post naming it (with dates), and the newest giving it a re-run.
  const latest = new Map();
  const reheld = new Map();
  for (const post of [...posts].sort((a, b) => a.posted.localeCompare(b.posted) || a.id - b.id))
    for (const b of post.banners) {
      if (b.start) latest.set(b.gachaId, { post, b });
      if (b.rerun?.start) reheld.set(b.gachaId, { post, b });
    }

  const enriched = [];
  const made = [];
  const mismatches = [];
  const skipped = [];
  const unresolved = [];
  const byId = new Map();
  for (const [id, { post, b }] of latest) {
    const news = {
      announced: true,
      news_url: post.url,
      news_image: b.image,
      ...(b.paid && { paid: true }),
      ...(b.name && { name: b.name }),
      ...(b.note && { note: b.note }),
    };
    const known = seeded.get(id);
    if (known) {
      const { kind, banner } = known;
      const what = [];
      if (b.type && KIND_OF_TYPE[b.type] !== kind) what.push(`type ${b.type}`);
      if (b.start !== banner.start) what.push(`start ${b.start} (GameTora ${banner.start})`);
      if (b.end && endOfMinute(b.end) !== banner.end) what.push(`end ${endOfMinute(b.end)} (GameTora ${banner.end})`);
      if (what.length) mismatches.push({ id, post: post.url, what: what.join(', ') });
      Object.assign(banner, news);
      // The R cards GameTora leaves out (decision 1: kept where the post lists them).
      if (kind === 'cards')
        for (const entry of b.featured.filter((f) => f.rarity === 'R')) {
          const item = resolve(entry, kind);
          if (item.id != null && !banner.featured.some((f) => f.id === item.id))
            banner.featured.push({ ...item, from_news: true });
        }
      enriched.push(banner);
      byId.set(id, { kind, banner });
      continue;
    }
    const kind = KIND_OF_TYPE[b.type];
    if (!kind) {
      skipped.push({ id, post: post.url, reason: 'no type (the art sits under no known heading)' });
      continue;
    }
    const banner = {
      id,
      image: b.image,
      start: b.start,
      end: endOfMinute(b.end) ?? null,
      main: null,
      featured: b.featured.map((f) => resolve(f, kind)),
      from_news: true,
      ...news,
    };
    for (const item of banner.featured) if (item.id == null) unresolved.push({ banner: id, item });
    kinds[kind].push(banner);
    made.push(banner);
    byId.set(id, { kind, banner });
  }

  // Re-runs: GameTora's re-run banner (same featured, starting at the re-run), else one of our own.
  const reruns = [];
  for (const [id, { post, b }] of reheld) {
    const original = byId.get(id);
    if (!original) continue;
    const { kind, banner } = original;
    const start = b.rerun.start;
    const end = endOfMinute(b.rerun.end) ?? null;
    const twin = kinds[kind].find(
      (o) =>
        o !== banner &&
        !o.from_news &&
        o.start === start &&
        sameItems(gametoraItems(o.featured), gametoraItems(banner.featured))
    );
    let rerun = twin;
    if (twin) twin.rerunOf = id;
    else {
      rerun = {
        id: `${id}-rerun`,
        image: banner.image,
        start,
        end,
        main: null,
        featured: banner.featured.map((f) => ({ ...f })),
        from_news: true,
        announced: true,
        news_url: post.url,
        news_image: banner.news_image,
        ...(banner.paid && { paid: true }),
        ...(banner.name && { name: banner.name }),
        ...(banner.note && { note: banner.note }),
        rerunOf: id,
      };
      kinds[kind].push(rerun);
      made.push(rerun);
    }
    banner.rerun = { id: rerun.id, start, end };
    reruns.push(rerun);
  }

  // `new`: a news-made banner's items new when it's their first banner; then each made banner's main item.
  for (const kind of KINDS) {
    const first = new Map();
    for (const b of kinds[kind])
      if (!b.rerunOf)
        for (const f of b.featured) if (f.id != null && !(first.get(f.id) <= b.start)) first.set(f.id, b.start);
    for (const b of kinds[kind].filter((x) => x.from_news)) {
      for (const f of b.featured) f.new = !b.rerunOf && f.id != null && first.get(f.id) === b.start;
      b.main = pickMain(b.featured);
    }
    // the R cards added to GameTora's banners
    for (const b of kinds[kind].filter((x) => !x.from_news))
      for (const f of b.featured) if (f.from_news) f.new = !b.rerunOf && first.get(f.id) === b.start;
  }

  const num = (id) => Number.parseInt(String(id), 10);
  const newestFirst = (a, b) => b.start.localeCompare(a.start) || num(b.id) - num(a.id);
  return {
    jp: { ...jp, characters: kinds.characters.sort(newestFirst), cards: kinds.cards.sort(newestFirst) },
    enriched,
    made,
    reruns,
    unresolved,
    mismatches,
    skipped,
  };
}

export const readJpBanners = (file = JP_BANNERS_FILE) => JSON.parse(readFileSync(file, 'utf8'));

// One banner per line, like data/global_banners.json (excluded from Biome).
export function writeJpBanners(jp, file = JP_BANNERS_FILE) {
  const list = (items) => (items.length ? `[\n${items.map((b) => JSON.stringify(b)).join(',\n')}\n]` : '[]');
  writeFileSync(
    file,
    `{\n"source": ${JSON.stringify(jp.source)},\n"characters": ${list(jp.characters)},\n"cards": ${list(jp.cards)}\n}\n`
  );
}

// data/jp_banners.json from GameTora's file, once (`force` to start over).
export function seedJpBanners({ force = false } = {}) {
  if (existsSync(JP_BANNERS_FILE) && !force)
    throw new Error('data/jp_banners.json exists already: pass --force to seed it again from GameTora');
  if (!existsSync(GAMETORA_JP_FILE)) throw new Error('no generated/jp_banners.json: run pnpm scrape-gametora');
  const gametora = readJpBanners(GAMETORA_JP_FILE);
  writeJpBanners(gametora);
  return gametora;
}

const banners = (n) => `${n} banner${n === 1 ? '' : 's'}`;

// The JP news' banners merged into data/jp_banners.json; returns a summary { lines: [...] } for summary.md.
//   posts  the stored JP posts (data/news/jp/posts.json)    cards  generated/cards.json
export async function updateJpBanners({ posts, cards }) {
  if (!existsSync(JP_BANNERS_FILE))
    return { lines: ['JP banners: not seeded yet (pnpm update-jp --seed makes data/jp_banners.json).'] };
  const jp = readJpBanners();
  const gametora = existsSync(GAMETORA_JP_FILE) ? readJpBanners(GAMETORA_JP_FILE) : null;
  const scouts = posts.map((post) => bannerPost(post, ja)).filter(Boolean);
  const before = JSON.stringify(jp);
  const result = applyJpNews({ posts: scouts, jp, cards, gametora });
  writeJpBanners(result.jp);
  const changed = JSON.stringify(result.jp) !== before;

  const lines = [
    `JP banners: ${banners(result.enriched.length)} from the news on GameTora's, ${banners(result.made.length)} made from it (${result.reruns.length} re-runs)${changed ? '' : ', nothing changed'}.`,
  ];
  if (result.unresolved.length)
    lines.push(
      `JP banners: ${result.unresolved.length} featured items not found: ${result.unresolved.map(({ banner, item }) => `${item.title}${item.name} (${banner})`).join(', ')}.`
    );
  for (const m of result.mismatches)
    lines.push(`JP banner ${m.id}: the news differs from GameTora: ${m.what} (${m.post}).`);
  for (const s of result.skipped) lines.push(`JP banner ${s.id} skipped: ${s.reason} (${s.post}).`);
  return { ...result, lines };
}
