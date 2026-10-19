// JP's banners (data/jp_banners.json, committed): GameTora's history, seeded once (2026-10; GameTora's banners aren't
// scraped any more), with the JP news merged over it. No GameTora URLs are stored:
// the app builds art and icons from ids. A banner's `image` is only a news-made banner's official art.
// A banner GameTora has keeps its dates (the news agrees on all of them: those it gives are then the news', status
// `news`) and gets news_url / news_image.
// Re-runs (decision 6): the original keeps its dates and gets `rerun`. A re-run GameTora already has is its `rerunOf`,
// else a news-made entry with id `<original id>-rerun` (the only string ids).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { type GametoraType, dated } from '../../shared/schemas/common.ts';
import type { Banner, BannerFile, BannerId, BannerItem } from '../../shared/schemas/banner.ts';
import type { Card, CardsFile } from '../../shared/schemas/card.ts';
import type { GametoraTrainee } from '../../shared/schemas/gametora.ts';
import type { NewsPost } from '../../shared/schemas/news.ts';
import { bannerPost } from './banner-posts.ts';
import { BANNERS_FILE as GLOBAL_BANNERS_FILE, pickMain } from './global.ts';
import { ja } from './news-lang/ja.ts';
import { norm } from './news-text.ts';
import { DATA_DIR, GENERATED_DIR } from './paths.ts';

export const JP_BANNERS_FILE = `${DATA_DIR}jp_banners.json`;
// GameTora's trainee outfits (`pnpm scrape-gametora`), cut to { id, char_id, name, title } (Japanese): only for a
// trainee our banners have never shown (a debut), which the news names without an id.
export const GAMETORA_TRAINEES_FILE = `${GENERATED_DIR}raw/gametora_trainees.json`;

// The two lists of a banner file.
type Kind = 'characters' | 'cards';
const KINDS: Kind[] = ['characters', 'cards'];
// A post's banner type (bannerPost(): the heading it sits under).
type ScoutType = 'character' | 'support';
const KIND_OF_TYPE: Record<ScoutType, Kind> = { character: 'characters', support: 'cards' };
const RARITY: Record<string, number> = { R: 1, SR: 2, SSR: 3 };
// cards.json's readable types → GameTora's, as the seeded banners have them.
const GAMETORA_TYPE: Record<string, string> = { wisdom: 'intelligence' };
// The keys the news adds to a seeded banner (taken off before each rebuild).
const NEWS_KEYS = ['news_url', 'news_image', 'rerun', 'rerunOf', 'paid', 'name', 'note'] as const;

// A featured item while the news is merged in: `new` is set on every item once the banners are (the end of
// applyJpNews()).
type Item = Omit<BannerItem, 'new'> & { new?: boolean };
// A banner while the news is merged in: its featured items may still lack `new` (see Item).
type Draft = Omit<Banner, 'featured' | 'main'> & { featured: Item[]; main: Item | null };
type ScoutItem = { rarity?: string; stars?: number; title: string; name: string };
type ScoutBanner = {
  gachaId: number;
  type?: ScoutType | null;
  start: string | null;
  end: string | null;
  image?: string;
  featured: ScoutItem[];
  paid?: boolean;
  name?: string | null;
  note?: string;
  rerun?: { start: string | null; end: string | null };
};
// (what bannerPost() gives, scripts/lib/banner-posts.ts: these are the fields read here)
type ScoutPost = { id: number; url: string; posted: string | null; banners: ScoutBanner[] };

// Posts end banners at "11:59"; GameTora's end on the last second of that minute.
const endOfMinute = (iso: string | null | undefined): string | undefined => iso?.replace(/:00(\.000)?Z$/, ':59.000Z');
const key = (title: string, name: string): string => `${norm(title)}|${norm(name)}`;
const sameItems = (a: { id: number | null }[], b: { id: number | null }[]): boolean =>
  a.length > 0 && a.length === b.length && a.every((x) => b.some((y) => y.id === x.id)) && a.every((x) => x.id != null);

// Banners Global could run and ml/ can learn from: not paid, not our own re-run entries (string ids), and as GameTora
// lists them (without the R cards the news adds to its banners).
export const isRegular = (banner: Banner): boolean => !banner.paid && typeof banner.id === 'number';
const gametoraItems = <T extends { from_news?: boolean }>(featured: T[]): T[] => featured.filter((f) => !f.from_news);
const asGametora = (banner: Banner): Banner =>
  banner.from_news ? banner : { ...banner, featured: gametoraItems(banner.featured) };
export const regularBanners = (jp: BannerFile): BannerFile => ({
  ...jp,
  characters: jp.characters.filter(isRegular).map(asGametora),
  cards: jp.cards.filter(isRegular).map(asGametora),
});

// The featured item a post's entry ({ rarity|stars, title, name }) stands for: support cards by our card data,
// trainees by the banners' own items (`banners`: JP's and Global's banner files).
function resolver({
  cards,
  banners,
  trainees: gametora = null,
}: {
  cards: CardsFile;
  banners: (BannerFile | null)[];
  trainees?: GametoraTrainee[] | null;
}): (entry: ScoutItem, kind: Kind) => Item {
  const supports = new Map<string, Card>();
  for (const c of Object.values(cards)) if (c.title?.jp && c.name?.jp) supports.set(key(c.title.jp, c.name.jp), c);
  const trainees = new Map<string, Pick<BannerItem, 'id' | 'char_id'>>();
  for (const jp of banners)
    for (const b of jp?.characters ?? []) for (const f of b.featured) if (f.id) trainees.set(key(f.title, f.name), f);
  // A debut: GameTora's list (our banners' ids win; once stored, a trainee resolves from them without it).
  for (const t of gametora ?? []) if (!trainees.has(key(t.title, t.name))) trainees.set(key(t.title, t.name), t);
  return (entry, kind) => {
    const title = `[${entry.title}]`;
    if (kind === 'cards') {
      const card = supports.get(key(entry.title, entry.name));
      return {
        id: card ? Number(card.id) : null,
        char_id: card?.charId ?? null,
        name: entry.name,
        title,
        // TODO(ts): a card's entry always has its rarity (bannerPost's featured list); RARITY is keyed by it.
        rarity: RARITY[entry.rarity as string],
        // TODO(ts): cards.json's `wisdom` is GameTora's `intelligence`; every other type is the same name in both.
        type: card ? ((GAMETORA_TYPE[card.type] ?? card.type) as GametoraType) : null,
        rate: null,
      };
    }
    const trainee = trainees.get(key(entry.title, entry.name));
    return {
      id: trainee?.id ?? null,
      char_id: trainee?.char_id ?? null,
      name: entry.name,
      title,
      // TODO(ts): a trainee's entry always has its stars (bannerPost's featured list).
      rarity: entry.stars as number,
      rate: null,
    };
  };
}

export type ApplyJpNewsResult = {
  jp: BannerFile;
  enriched: Banner[];
  made: Banner[];
  reruns: Banner[];
  unresolved: { banner: BannerId; item: Item }[];
  mismatches: { id: number; post: string; what: string }[];
  skipped: { id: BannerId; post: string; reason: string }[];
};

// The news (scout posts as bannerPost(post, ja) reads them) merged over the stored banners. Pure and idempotent.
// `global` resolves trainee ids; `trainees` (GameTora's list) covers trainees no banner has shown yet.
export function applyJpNews({
  posts,
  jp,
  cards,
  global = null,
  trainees = null,
}: {
  posts: ScoutPost[];
  jp: BannerFile;
  cards: CardsFile;
  global?: BannerFile | null;
  trainees?: GametoraTrainee[] | null;
}): ApplyJpNewsResult {
  // Each list without the news' keys; its featured items without the R cards the news adds.
  const kinds: Record<Kind, Draft[]> = { characters: [], cards: [] };
  for (const kind of KINDS)
    kinds[kind] = jp[kind]
      .filter((b) => !b.from_news)
      .map((b) => {
        const draft: Draft = {
          ...b,
          start: dated(b.start.date, 'gametora'),
          end: b.end && dated(b.end.date, 'gametora'),
          featured: gametoraItems(b.featured),
        };
        for (const k of NEWS_KEYS) delete draft[k];
        return draft;
      });
  const seeded = new Map<BannerId, { kind: Kind; banner: Draft }>();
  for (const kind of KINDS) for (const b of kinds[kind]) seeded.set(b.id, { kind, banner: b });
  const resolve = resolver({ cards, banners: [jp, global], trainees });

  // id → the newest post naming it (with dates), and the newest giving it a re-run.
  const latest = new Map<number, { post: ScoutPost; b: ScoutBanner & { start: string } }>();
  const reheld = new Map<number, { post: ScoutPost; b: ScoutBanner & { rerun: { start: string } } }>();
  // (every stored post has a time: posts.json's post_at)
  for (const post of [...posts].sort((a, b) => (a.posted ?? '').localeCompare(b.posted ?? '') || a.id - b.id))
    for (const b of post.banners) {
      if (b.start) latest.set(b.gachaId, { post, b: { ...b, start: b.start } });
      if (b.rerun?.start) reheld.set(b.gachaId, { post, b: { ...b, rerun: { ...b.rerun, start: b.rerun.start } } });
    }

  const enriched: Draft[] = [];
  const made: Draft[] = [];
  const mismatches: ApplyJpNewsResult['mismatches'] = [];
  const skipped: ApplyJpNewsResult['skipped'] = [];
  const unresolved: ApplyJpNewsResult['unresolved'] = [];
  const byId = new Map<BannerId, { kind: Kind; banner: Draft }>();
  for (const [id, { post, b }] of latest) {
    const news = {
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
      if (b.start !== banner.start.date) what.push(`start ${b.start} (GameTora ${banner.start.date})`);
      if (b.end && endOfMinute(b.end) !== banner.end?.date)
        what.push(`end ${endOfMinute(b.end)} (GameTora ${banner.end?.date})`);
      if (what.length) mismatches.push({ id, post: post.url, what: what.join(', ') });
      Object.assign(banner, news);
      if (b.start === banner.start.date) banner.start.status = 'news';
      if (banner.end && endOfMinute(b.end) === banner.end.date) banner.end.status = 'news';
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
    const kind = b.type && KIND_OF_TYPE[b.type];
    if (!kind) {
      skipped.push({ id, post: post.url, reason: 'no type (the art sits under no known heading)' });
      continue;
    }
    const banner: Draft = {
      id,
      image: b.image,
      start: dated(b.start, 'news'),
      end: b.end ? dated(endOfMinute(b.end) as string, 'news') : null,
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
  const reruns: Draft[] = [];
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
        o.start.date === start &&
        sameItems(gametoraItems(o.featured), gametoraItems(banner.featured))
    );
    let rerun: Draft;
    if (twin) {
      // GameTora's re-run has no post of its own: it shows its original's.
      Object.assign(twin, {
        rerunOf: id,
        news_url: post.url,
        news_image: banner.news_image ?? banner.image,
      });
      twin.start.status = 'news';
      rerun = twin;
    } else {
      rerun = {
        id: `${id}-rerun`,
        ...(banner.image && { image: banner.image }),
        start: dated(start, 'news'),
        end: end ? dated(end, 'news') : null,
        main: null,
        featured: banner.featured.map((f) => ({ ...f })),
        from_news: true,
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
    banner.rerun = { id: rerun.id, start: dated(start, 'news'), end: end ? dated(end, 'news') : null };
    reruns.push(rerun);
  }

  // `new`: a news-made banner's items new when it's their first banner; then each made banner's main item.
  for (const kind of KINDS) {
    const first = new Map<number | null, string>();
    for (const b of kinds[kind])
      if (!b.rerunOf)
        // TODO(ts): undefined before an id's first sight: `undefined <= start` is false, so it's set then, as before.
        for (const f of b.featured)
          if (f.id != null && !((first.get(f.id) as string) <= b.start.date)) first.set(f.id, b.start.date);
    for (const b of kinds[kind].filter((x) => x.from_news)) {
      for (const f of b.featured) f.new = !b.rerunOf && f.id != null && first.get(f.id) === b.start.date;
      b.main = pickMain(b.featured);
    }
    // the R cards added to GameTora's banners
    for (const b of kinds[kind].filter((x) => !x.from_news))
      for (const f of b.featured) if (f.from_news) f.new = !b.rerunOf && first.get(f.id) === b.start.date;
  }

  const num = (id: BannerId): number => Number.parseInt(String(id), 10);
  const newestFirst = (a: Draft, b: Draft): number => b.start.date.localeCompare(a.start.date) || num(b.id) - num(a.id);
  // TODO(ts): every featured item has `new` once the loop above has set it (Item's `new` is optional until then).
  const done = (list: Draft[]): Banner[] => list as Banner[];
  return {
    jp: { ...jp, characters: done(kinds.characters.sort(newestFirst)), cards: done(kinds.cards.sort(newestFirst)) },
    enriched: done(enriched),
    made: done(made),
    reruns: done(reruns),
    unresolved,
    mismatches,
    skipped,
  };
}

export const readJpBanners = (file = JP_BANNERS_FILE): BannerFile => JSON.parse(readFileSync(file, 'utf8'));

// One banner per line, like data/global_banners.json (excluded from Biome).
export function writeJpBanners(jp: BannerFile, file = JP_BANNERS_FILE): void {
  const list = (items: Banner[]) => (items.length ? `[\n${items.map((b) => JSON.stringify(b)).join(',\n')}\n]` : '[]');
  writeFileSync(
    file,
    `{\n"source": ${JSON.stringify(jp.source)},\n"characters": ${list(jp.characters)},\n"cards": ${list(jp.cards)}\n}\n`
  );
}

const banners = (n: number): string => `${n} banner${n === 1 ? '' : 's'}`;

// The JP news' banners merged into data/jp_banners.json; returns a summary { lines: [...] } for summary.md.
export async function updateJpBanners({
  posts,
  cards,
}: {
  posts: NewsPost[];
  cards: CardsFile;
}): Promise<(ApplyJpNewsResult & { lines: string[] }) | { lines: string[] }> {
  if (!existsSync(JP_BANNERS_FILE)) return { lines: ['JP banners: no data/jp_banners.json.'] };
  const jp = readJpBanners();
  const global = existsSync(GLOBAL_BANNERS_FILE) ? readJpBanners(GLOBAL_BANNERS_FILE) : null;
  const trainees = existsSync(GAMETORA_TRAINEES_FILE) ? JSON.parse(readFileSync(GAMETORA_TRAINEES_FILE, 'utf8')) : null;
  const scouts = posts.map((post) => bannerPost(post, ja)).filter((scout) => scout !== null);
  const before = JSON.stringify(jp);
  const result = applyJpNews({ posts: scouts, jp, cards, global, trainees });
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
