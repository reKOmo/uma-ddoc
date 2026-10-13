// Global's own record of gacha banners and card releases, in data/ (committed):
//   data/global_banners.json  { source, characters: [banner…], cards: [banner…] }, newest first, in
//                             data/jp_banners.json's shape (scripts/lib/jp-banners.js; no GameTora URLs: the app
//                             builds the art, en/gacha/img_bnr_gacha_<id>.png, and icons from ids)
//   data/global_cards.json    { [card id]: { title_en, release_gl, news_url? } } for cards out on Global
// Seeded once from GameTora (2026-10) and kept up since from the official
// news (data/news/, pnpm update-global). Entries made from the news carry `news_url` (banners also
// `announced: true`). Seeded banners (no `announced`) keep their dates and items; one a post shows gets that post's
// `news_url` and official art (`news_image`), as JP's GameTora banners do (scripts/lib/jp-banners.js).
//
// A scout post names its banners by gacha id, which Global shares with JP, so a banner from the
// news is JP's banner with that id (featured ids, rates) under Global's dates and art, with
// the English names and titles the post lists.

import { readFileSync, writeFileSync } from 'node:fs';
import type { Banner, BannerFile, BannerId, BannerItem } from '../../shared/schemas/banner.ts';
import type { CardsFile, GlobalCardsFile } from '../../shared/schemas/card.ts';
import type { BannerPost } from './banner-posts.ts';
import { DATA_DIR } from './paths.ts';
import { norm } from './news-text.ts';

export const BANNERS_FILE = `${DATA_DIR}global_banners.json`;
export const CARDS_FILE = `${DATA_DIR}global_cards.json`;

// data/global_cards.json's entries, by id.
export type CardRecords = GlobalCardsFile;
type Kind = 'characters' | 'cards';
// char_id → English name (englishNames()).
type NameMap = Map<number | null, string>;

// A scout post (bannerPost(), scripts/lib/banner-posts.ts) and its banners.
type ScoutPost = BannerPost;
type ScoutBanner = BannerPost['banners'][number];

// A banner applyNews() made from a post, and a post it skipped.
export type NewsBanner = { banner: Banner; kind: Kind; post: string; unmatched: string[] };
export type NewsSkip = { id: number; post: string; reason: string };
export type NewsResult = { global: BannerFile; cards: CardRecords; banners: NewsBanner[]; skipped: NewsSkip[] };

const BANNER_KINDS: Kind[] = ['characters', 'cards'];

const RARITY: Partial<Record<string, number>> = { R: 1, SR: 2, SSR: 3 };

// The highest rarity, then the highest rate (our heuristic for `main`, as when the banners were seeded).
export function pickMain<T extends Pick<BannerItem, 'rarity' | 'rate'>>(featured: T[]): T | null {
  return (
    featured.reduce<T | null>(
      (best, item) =>
        !best || item.rarity > best.rarity || (item.rarity === best.rarity && (item.rate ?? 0) > (best.rate ?? 0))
          ? item
          : best,
      null
    ) ?? null
  );
}

// Posts end banners at "9:59 p.m."; scraped banners end on the last second of that minute.
const endOfMinute = (iso: string) => iso?.replace(/:00(\.000)?Z$/, ':59.000Z');
const isoMs = (iso: string) => new Date(iso).toISOString();

// Pairs a JP banner's items with the post's English list ({ name, title, rarity|stars }): by
// character name first (`names`: char_id → English name), then, if one item and one entry are
// left, with each other (the post lists each banner's items under its own art). Returns [{ item, entry }] (entry null when unmatched).
function pairEnglish(items: BannerItem[], entries: { name: string; title: string }[], names: NameMap) {
  const left = [...entries];
  const pairs = items.map((item) => {
    const i = left.findIndex((e) => names.get(item.char_id) && norm(e.name) === norm(names.get(item.char_id)));
    return { item, entry: i >= 0 ? left.splice(i, 1)[0] : null };
  });
  const unpaired = pairs.filter((p) => !p.entry);
  if (unpaired.length === 1 && left.length === 1) unpaired[0].entry = left[0];
  return pairs;
}

// Rebuilds the news-made banners and card releases from every post (oldest first; a later post
// about the same banner wins), on top of the seeded ones. Pure. Paid scouts (one-off guaranteed ones) are left out,
// like JP's "special" banners.
//   posts     scout posts, as scripts/lib/banner-posts.js reads them (bannerPost())
//   global    data/global_banners.json      cards  data/global_cards.json
//   jp        JP's banners (data/jp_banners.json, regular ones: scripts/lib/jp-banners.js's regularBanners())
//   names     Map char_id → English name
// Returns { global, cards, banners: [{ banner, kind, post, unmatched }], skipped: [{ id, post, reason }] }.
export function applyNews({
  posts,
  global,
  cards,
  jp,
  names,
}: {
  posts: ScoutPost[];
  global: BannerFile;
  cards: CardRecords;
  jp: Pick<BannerFile, 'characters' | 'cards'>;
  names: NameMap;
}): NewsResult {
  // Seeded banners, without what an earlier run took from the posts (taken again below: idempotent).
  const seeded = (list: Banner[]): Banner[] =>
    list.filter((b) => !b.announced).map(({ news_url, news_image, ...b }) => b);
  const kinds: Record<Kind, Banner[]> = { characters: seeded(global.characters), cards: seeded(global.cards) };
  const seededById = new Map<BannerId, Banner>(
    [...kinds.characters, ...kinds.cards].map((b): [BannerId, Banner] => [b.id, b])
  );
  const jpBanners = new Map<BannerId, { kind: Kind; banner: Banner }>();
  for (const kind of BANNER_KINDS) for (const b of jp[kind]) jpBanners.set(b.id, { kind, banner: b });

  // id → { post, announced } from the newest post naming it.
  const announced = new Map<number, { post: ScoutPost; announced: ScoutBanner & { start: string } }>();
  for (const post of [...posts].sort((a, b) => (a.posted ?? '').localeCompare(b.posted ?? ''))) {
    if (post.paid) continue;
    for (const b of post.banners) if (b.start) announced.set(b.gachaId, { post, announced: { ...b, start: b.start } });
  }

  const made: NewsBanner[] = [];
  const skipped: NewsSkip[] = [];
  for (const [id, { post, announced: a }] of announced) {
    // A seeded banner the news shows: its post and official art; its dates and items stay.
    const seededBanner = seededById.get(id);
    if (seededBanner) {
      seededBanner.news_url = post.url;
      if (a.image) seededBanner.news_image = a.image;
      continue;
    }
    const source = jpBanners.get(id);
    if (!source) {
      skipped.push({ id, post: post.url, reason: 'no JP banner has this id' });
      continue;
    }
    const { kind, banner: jpBanner } = source;
    const type = kind === 'cards' ? 'support' : 'character';
    if (a.type && a.type !== type) {
      skipped.push({ id, post: post.url, reason: `the post lists it as a ${a.type} banner, JP as a ${type} one` });
      continue;
    }
    const entries = a.featured.map((f) => ({
      ...f,
      rarity: kind === 'cards' ? RARITY['rarity' in f ? f.rarity : ''] : 'stars' in f ? f.stars : undefined,
    }));
    const pairs = pairEnglish(jpBanner.featured, entries, names);
    const featured = pairs.map(({ item, entry }) => ({
      ...item,
      name: entry?.name ?? names.get(item.char_id) ?? item.name,
      title: entry ? `[${entry.title}]` : item.title,
    }));
    const lengthMs = Date.parse(jpBanner.end ?? '') - Date.parse(jpBanner.start);
    const image = a.image ?? jpBanner.image;
    const banner: Banner = {
      id,
      ...(image && { image }),
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
  const nextCards: CardRecords = Object.fromEntries(Object.entries(cards).filter(([, c]) => !c.news_url));
  const firstOutfit = new Map<BannerItem['id'], string>();
  for (const b of kinds.characters) for (const item of b.featured) firstOutfit.set(item.id, b.start);
  made.sort((x, y) => x.banner.start.localeCompare(y.banner.start) || Number(x.banner.id) - Number(y.banner.id));
  for (const { banner, kind } of made) {
    const day = banner.start.slice(0, 10);
    for (const item of banner.featured) {
      if (kind === 'cards') {
        const key = String(item.id); // as an object key, as before
        const known = nextCards[key]?.release_gl;
        item.new = !known || known >= day;
        if (!known) nextCards[key] = { title_en: item.title ?? null, release_gl: day, news_url: banner.news_url };
      } else {
        const first = firstOutfit.get(item.id);
        item.new = !first || first >= banner.start;
        if (!first) firstOutfit.set(item.id, banner.start);
      }
    }
    banner.main = pickMain(banner.featured);
    kinds[kind].push(banner);
  }

  const newestFirst = (a: Banner, b: Banner) => b.start.localeCompare(a.start) || Number(b.id) - Number(a.id);
  return {
    global: { ...global, characters: kinds.characters.sort(newestFirst), cards: kinds.cards.sort(newestFirst) },
    cards: Object.fromEntries(Object.entries(nextCards).sort(([a], [b]) => Number(a) - Number(b))),
    banners: made,
    skipped,
  };
}

// char_id → English name, from our cards (generated/cards.json; group cards are named after the group)
// and Global's banners.
export function englishNames(global: BannerFile, cards: CardsFile): NameMap {
  const names: NameMap = new Map();
  for (const card of Object.values(cards)) {
    if (card.charId && card.name.en && card.type !== 'group') names.set(card.charId, card.name.en);
  }
  for (const b of [...global.characters, ...global.cards])
    for (const item of b.featured) if (item.char_id && item.name) names.set(item.char_id, item.name);
  return names;
}

// TODO(ts): JSON.parse gives any; the caller names the file's type (its schema in shared/schemas/).
export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

// One banner / card per line, so commits diff per entry (the files are excluded from Biome).
export function writeGlobal({ global, cards }: { global: BannerFile; cards: CardRecords }) {
  const list = (items: Banner[]) => (items.length ? `[\n${items.map((b) => JSON.stringify(b)).join(',\n')}\n]` : '[]');
  writeFileSync(
    BANNERS_FILE,
    `{\n"source": ${JSON.stringify(global.source)},\n"characters": ${list(global.characters)},\n"cards": ${list(global.cards)}\n}\n`
  );
  const entries = Object.entries(cards).map(([id, c]) => `${JSON.stringify(id)}: ${JSON.stringify(c)}`);
  writeFileSync(CARDS_FILE, `{\n${entries.join(',\n')}\n}\n`);
}
