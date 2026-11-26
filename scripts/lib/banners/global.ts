// Global's banners and card releases in data/ (committed). Seeded once from GameTora (2026-10), then kept up from the
// official news by pnpm update-global. News-made entries carry `news_url` and start as the news' (status `news`;
// seeded ones `gametora`). A seeded banner
// the news shows keeps its dates and items, and gets that post's `news_url` and official art (`news_image`).
// A scout post names banners by gacha id, which Global shares with JP: a news banner is JP's banner with that id
// (featured ids, rates) under Global's dates and art, with the English names and titles the post lists.

import { writeFileSync } from 'node:fs';
import type { Banner, BannerFile, BannerId, BannerItem } from '../../../shared/schemas/banner.ts';
import type { CardsFile, GlobalCardsFile } from '../../../shared/schemas/card.ts';
import { dated } from '../../../shared/schemas/common.ts';
import type { BannerPost } from './posts.ts';
import { keepBannerFills } from '../fills.ts';
import { DATA_DIR } from '../paths.ts';
import { norm } from '../news/text.ts';

export const BANNERS_FILE = `${DATA_DIR}global_banners.json`;
export const CARDS_FILE = `${DATA_DIR}global_cards.json`;

export type CardRecords = GlobalCardsFile;
// The two lists of a banner file.
export type Kind = 'characters' | 'cards';
export const BANNER_KINDS: Kind[] = ['characters', 'cards'];
// char_id → English name (englishNames()).
type NameMap = Map<number | null, string>;

type ScoutPost = BannerPost;
type ScoutBanner = BannerPost['banners'][number];
// A post's banner as it's applied: its start is known.
type Announced = { post: ScoutPost; announced: ScoutBanner & { start: string } };

export type NewsBanner = { banner: Banner; kind: Kind; post: string; unmatched: string[] };
export type NewsSkip = { id: number; post: string; reason: string };
export type NewsResult = { global: BannerFile; cards: CardRecords; banners: NewsBanner[]; skipped: NewsSkip[] };

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
export function endOfMinute(iso: string): string;
export function endOfMinute(iso: string | null | undefined): string | undefined;
export function endOfMinute(iso: string | null | undefined): string | undefined {
  return iso?.replace(/:00(\.000)?Z$/, ':59.000Z');
}
const isoMs = (iso: string) => new Date(iso).toISOString();

// Pairs a JP banner's items with the post's English list ({ name, title, rarity|stars }): by character name first
// (`names`: char_id → English name), then, if one item and one entry are left, with each other (the post lists each
// banner's items under its own art). Entry null when unmatched.
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

// Seeded banners, without what an earlier run took from the posts (taken again below: idempotent).
const withoutNews = (list: Banner[]): Banner[] =>
  list.filter((b) => b.start.status !== 'news').map(({ news_url, news_image, ...b }) => b);

// id → { post, announced } from the newest post naming it. Paid scouts are left out.
function newestAnnounced(posts: ScoutPost[]): Map<number, Announced> {
  const announced = new Map<number, Announced>();
  for (const post of [...posts].sort((a, b) => (a.posted ?? '').localeCompare(b.posted ?? ''))) {
    if (post.paid) continue;
    for (const b of post.banners) if (b.start) announced.set(b.gachaId, { post, announced: { ...b, start: b.start } });
  }
  return announced;
}

// A news banner made from JP's banner with the same id, or the reason it can't be.
function makeFromNews(
  id: number,
  post: ScoutPost,
  a: Announced['announced'],
  jpBanners: Map<BannerId, { kind: Kind; banner: Banner }>,
  names: NameMap
): NewsBanner | NewsSkip {
  const source = jpBanners.get(id);
  if (!source) return { id, post: post.url, reason: 'no JP banner has this id' };
  const { kind, banner: jpBanner } = source;
  const type = kind === 'cards' ? 'support' : 'character';
  if (a.type && a.type !== type)
    return { id, post: post.url, reason: `the post lists it as a ${a.type} banner, JP as a ${type} one` };
  const pairs = pairEnglish(jpBanner.featured, a.featured, names);
  const featured = pairs.map(({ item, entry }) => ({
    ...item,
    name: entry?.name ?? names.get(item.char_id) ?? item.name,
    title: entry ? `[${entry.title}]` : item.title,
  }));
  const lengthMs = Date.parse(jpBanner.end?.date ?? '') - Date.parse(jpBanner.start.date);
  const image = a.image ?? jpBanner.image;
  const banner: Banner = {
    id,
    ...(image && { image }),
    start: dated(isoMs(a.start), 'news'),
    // Without an end in the post: as long as JP's.
    end: a.end
      ? dated(endOfMinute(isoMs(a.end)), 'news')
      : dated(new Date(Date.parse(a.start) + lengthMs).toISOString(), 'predicted'),
    main: null,
    featured,
    news_url: post.url,
  };
  return {
    banner,
    kind,
    post: post.url,
    unmatched: pairs.filter((p) => !p.entry).map((p) => `${p.item.title ?? ''} ${p.item.name ?? p.item.id}`.trim()),
  };
}

// The card releases without the news' ones (rebuilt from the news-made banners by markNew()).
const withoutNewsCards = (cards: CardRecords): CardRecords =>
  Object.fromEntries(Object.entries(cards).filter(([, c]) => !c.news_url));

// Sets each made banner's items' `new` (a card not out yet, or an outfit not shown yet) and its `main`, adds the
// card releases it shows to `nextCards`, and pushes it into `kinds`. Oldest first.
function markNew(made: NewsBanner[], kinds: Record<Kind, Banner[]>, nextCards: CardRecords): void {
  const firstOutfit = new Map<BannerItem['id'], string>();
  for (const b of kinds.characters) for (const item of b.featured) firstOutfit.set(item.id, b.start.date);
  made.sort(
    (x, y) => x.banner.start.date.localeCompare(y.banner.start.date) || Number(x.banner.id) - Number(y.banner.id)
  );
  for (const { banner, kind } of made) {
    const day = banner.start.date.slice(0, 10);
    for (const item of banner.featured) {
      if (kind === 'cards') {
        const key = String(item.id);
        const known = nextCards[key]?.release_gl.date;
        item.new = !known || known >= day;
        if (!known)
          nextCards[key] = { title_en: item.title ?? null, release_gl: dated(day, 'news'), news_url: banner.news_url };
      } else {
        const first = firstOutfit.get(item.id);
        item.new = !first || first >= banner.start.date;
        if (!first) firstOutfit.set(item.id, banner.start.date);
      }
    }
    banner.main = pickMain(banner.featured);
    kinds[kind].push(banner);
  }
}

// Rebuilds the news-made banners and card releases from every post (oldest first; a later post about the same banner
// wins), on top of the seeded ones. Pure. Paid scouts are left out, like JP's "special" banners.
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
  const kinds: Record<Kind, Banner[]> = {
    characters: withoutNews(global.characters),
    cards: withoutNews(global.cards),
  };
  const seededById = new Map<BannerId, Banner>(
    [...kinds.characters, ...kinds.cards].map((b): [BannerId, Banner] => [b.id, b])
  );
  const jpBanners = new Map<BannerId, { kind: Kind; banner: Banner }>();
  for (const kind of BANNER_KINDS) for (const b of jp[kind]) jpBanners.set(b.id, { kind, banner: b });

  const made: NewsBanner[] = [];
  const skipped: NewsSkip[] = [];
  for (const [id, { post, announced }] of newestAnnounced(posts)) {
    // A seeded banner the news shows: its post and official art; its dates and items stay.
    const seededBanner = seededById.get(id);
    if (seededBanner) {
      seededBanner.news_url = post.url;
      if (announced.image) seededBanner.news_image = announced.image;
      continue;
    }
    const result = makeFromNews(id, post, announced, jpBanners, names);
    if ('reason' in result) skipped.push(result);
    else made.push(result);
  }

  const nextCards = withoutNewsCards(cards);
  markNew(made, kinds, nextCards);
  const newestFirst = (a: Banner, b: Banner) => b.start.date.localeCompare(a.start.date) || Number(b.id) - Number(a.id);
  return {
    global: {
      ...global,
      characters: keepBannerFills(kinds.characters.sort(newestFirst), global.characters),
      cards: keepBannerFills(kinds.cards.sort(newestFirst), global.cards),
    },
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

// One banner per line, so commits diff per entry (the files are excluded from Biome).
export const bannerList = (items: Banner[]): string =>
  items.length ? `[\n${items.map((b) => JSON.stringify(b)).join(',\n')}\n]` : '[]';

export function writeGlobal({ global, cards }: { global: BannerFile; cards: CardRecords }) {
  writeFileSync(
    BANNERS_FILE,
    `{\n"source": ${JSON.stringify(global.source)},\n"characters": ${bannerList(global.characters)},\n"cards": ${bannerList(global.cards)}\n}\n`
  );
  const entries = Object.entries(cards).map(([id, c]) => `${JSON.stringify(id)}: ${JSON.stringify(c)}`);
  writeFileSync(CARDS_FILE, `{\n${entries.join(',\n')}\n}\n`);
}
