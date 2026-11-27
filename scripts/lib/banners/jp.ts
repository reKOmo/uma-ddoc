// JP's banners (data/jp_banners.json, committed): GameTora's history, seeded once (2026-10; GameTora's banners aren't
// scraped any more), with the JP news merged over it. No GameTora URLs are stored:
// the app builds art and icons from ids. A banner's `image` is only a news-made banner's official art.
// A banner GameTora has keeps its dates (the news agrees on all of them: those it gives are then the news', status
// `news`) and gets news_url / news_image.
// Re-runs (decision 6): the original keeps its dates and gets `rerun`. A re-run GameTora already has is its `rerunOf`,
// else a news-made entry with id `<original id>-rerun` (the only string ids).

import { existsSync } from 'node:fs';
import { type Rarity, dated, toGametoraType } from '../../../shared/schemas/common.ts';
import type { Banner, BannerFile, BannerId, BannerItem } from '../../../shared/schemas/banner.ts';
import type { Card, CardsFile } from '../../../shared/schemas/card.ts';
import type { GametoraTrainee } from '../../../shared/schemas/gametora.ts';
import { RARITY_CODES } from '../../../shared/joinCards.ts';
import type { Featured, FeaturedCard, FeaturedTrainee } from './posts.ts';
import {
  BANNER_KINDS,
  type Kind,
  type ScoutBanner,
  type ScoutPost,
  endOfMinute,
  newestPerBanner,
  pickMain,
  withoutNews,
  writeBannerFile,
} from './common.ts';
import { cardKey } from '../news/text.ts';
import { readJson, sameJson } from '../json.ts';
import { newestBannersFirst } from '../order.ts';
import { GENERATED_DIR, dataFile } from '../paths.ts';

// GameTora's trainee outfits (`pnpm scrape-gametora`), cut to { id, char_id, name, title } (Japanese): only for a
// trainee our banners have never shown (a debut), which the news names without an id.
export const GAMETORA_TRAINEES_FILE = `${GENERATED_DIR}raw/gametora_trainees.json`;

// A post's banner type (bannerPost(): the heading it sits under).
const KIND_OF_TYPE: Record<NonNullable<ScoutBanner['type']>, Kind> = { character: 'characters', support: 'cards' };

// A featured item while the news is merged in: `new` is set on every item once the banners are (the end of
// applyJpNews()).
type Item = Omit<BannerItem, 'new'> & { new?: boolean };
// A banner while the news is merged in: its featured items may still lack `new` (see Item).
type Draft = Omit<Banner, 'featured' | 'main'> & { featured: Item[]; main: Item | null };
// The newest post naming a banner id, with its start known; the newest one giving it a re-run, with that start.
type Announced = { post: ScoutPost; b: ScoutBanner & { start: string } };
type Rerun = { post: ScoutPost; b: ScoutBanner & { rerun: { start: string } } };
// A stored banner the news is merged into.
type Known = { kind: Kind; banner: Draft };

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
}): (entry: Featured, kind: Kind) => Item {
  const supports = new Map<string, Card>();
  for (const c of Object.values(cards)) if (c.title?.jp && c.name?.jp) supports.set(cardKey(c.title.jp, c.name.jp), c);
  const trainees = new Map<string, Pick<BannerItem, 'id' | 'char_id'>>();
  for (const jp of banners)
    for (const b of jp?.characters ?? [])
      for (const f of b.featured) if (f.id) trainees.set(cardKey(f.title, f.name), f);
  // A debut: GameTora's list (our banners' ids win; once stored, a trainee resolves from them without it).
  for (const t of gametora ?? [])
    if (!trainees.has(cardKey(t.title, t.name))) trainees.set(cardKey(t.title, t.name), t);
  return (entry, kind) => {
    const title = `[${entry.title}]`;
    if (kind === 'cards') {
      const card = supports.get(cardKey(entry.title, entry.name));
      return {
        id: card ? Number(card.id) : null,
        char_id: card?.charId ?? null,
        name: entry.name,
        title,
        // TODO(ts): a card's entry always has its rarity (bannerPost() reads a support banner's list as cards), as the
        // news writes it (R, SR or SSR).
        rarity: RARITY_CODES[(entry as FeaturedCard).rarity as Rarity],
        type: card ? toGametoraType(card.type) : null,
        rate: null,
      };
    }
    const trainee = trainees.get(cardKey(entry.title, entry.name));
    return {
      id: trainee?.id ?? null,
      char_id: trainee?.char_id ?? null,
      name: entry.name,
      title,
      // TODO(ts): a trainee's entry always has its stars (bannerPost() reads a character banner's list as trainees).
      rarity: (entry as FeaturedTrainee).stars,
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

// applyJpNews()'s working state: the drafts per list, what the news did to them, and the report.
type Merge = {
  kinds: Record<Kind, Draft[]>;
  byId: Map<BannerId, Known>;
  resolve: (entry: Featured, kind: Kind) => Item;
  enriched: Draft[];
  made: Draft[];
  reruns: Draft[];
  unresolved: ApplyJpNewsResult['unresolved'];
  mismatches: ApplyJpNewsResult['mismatches'];
  skipped: ApplyJpNewsResult['skipped'];
};

const seedDraft = (b: Banner): Draft => ({
  ...withoutNews(b),
  start: dated(b.start.date, 'gametora'),
  end: b.end && dated(b.end.date, 'gametora'),
  featured: gametoraItems(b.featured),
});

// Each list without the news' keys; its featured items without the R cards the news adds.
function seedDrafts(jp: BannerFile): Record<Kind, Draft[]> {
  const seed = (list: Banner[]): Draft[] => list.filter((b) => !b.from_news).map(seedDraft);
  return { characters: seed(jp.characters), cards: seed(jp.cards) };
}

// The fields the news adds to a banner.
const newsFields = (post: ScoutPost, b: { image?: string; paid?: boolean; name?: string | null; note?: string }) => ({
  news_url: post.url,
  news_image: b.image,
  ...(b.paid && { paid: true }),
  ...(b.name && { name: b.name }),
  ...(b.note && { note: b.note }),
});

// A seeded banner the news shows: its mismatches with GameTora, the news' fields and statuses, and the R cards the
// post lists that GameTora leaves out.
function enrichSeeded(s: Merge, id: number, { post, b }: Announced, { kind, banner }: Known): void {
  const what: string[] = [];
  if (b.type && KIND_OF_TYPE[b.type] !== kind) what.push(`type ${b.type}`);
  if (b.start !== banner.start.date) what.push(`start ${b.start} (GameTora ${banner.start.date})`);
  if (b.end && endOfMinute(b.end) !== banner.end?.date)
    what.push(`end ${endOfMinute(b.end)} (GameTora ${banner.end?.date})`);
  if (what.length) s.mismatches.push({ id, post: post.url, what: what.join(', ') });
  Object.assign(banner, newsFields(post, b));
  if (b.start === banner.start.date) banner.start.status = 'news';
  if (banner.end && endOfMinute(b.end) === banner.end.date) banner.end.status = 'news';
  // The R cards GameTora leaves out (decision 1: kept where the post lists them).
  if (kind === 'cards')
    for (const entry of b.featured.filter((f) => 'rarity' in f && f.rarity === 'R')) {
      const item = s.resolve(entry, kind);
      if (item.id != null && !banner.featured.some((f) => f.id === item.id))
        banner.featured.push({ ...item, from_news: true });
    }
  s.enriched.push(banner);
  s.byId.set(id, { kind, banner });
}

// A banner the news lists that no seeded banner has: made from the news, or skipped when its art sits under no
// known heading.
function makeFromNews(s: Merge, id: number, { post, b }: Announced): void {
  const kind = b.type && KIND_OF_TYPE[b.type];
  if (!kind) {
    s.skipped.push({ id, post: post.url, reason: 'no type (the art sits under no known heading)' });
    return;
  }
  const banner: Draft = {
    id,
    image: b.image,
    start: dated(b.start, 'news'),
    end: b.end ? dated(endOfMinute(b.end), 'news') : null,
    main: null,
    featured: b.featured.map((f) => s.resolve(f, kind)),
    from_news: true,
    ...newsFields(post, b),
  };
  for (const item of banner.featured) if (item.id == null) s.unresolved.push({ banner: id, item });
  s.kinds[kind].push(banner);
  s.made.push(banner);
  s.byId.set(id, { kind, banner });
}

// Re-runs: GameTora's re-run banner (same featured, starting at the re-run), else one of our own.
function addReruns(s: Merge, reheld: Map<number, Rerun>): void {
  for (const [id, { post, b }] of reheld) {
    const original = s.byId.get(id);
    if (!original) continue;
    const { kind, banner } = original;
    const start = b.rerun.start;
    const end = endOfMinute(b.rerun.end) ?? null;
    const twin = s.kinds[kind].find(
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
        ...newsFields(post, { ...banner, image: banner.news_image }),
        rerunOf: id,
      };
      s.kinds[kind].push(rerun);
      s.made.push(rerun);
    }
    banner.rerun = { id: rerun.id, start: dated(start, 'news'), end: end ? dated(end, 'news') : null };
    s.reruns.push(rerun);
  }
}

// `new`: an item is new in the first banner (not a re-run) that shows it; a news-made banner's main item is then
// picked. The R cards added to GameTora's banners are marked the same way.
function markNew(kinds: Record<Kind, Draft[]>): void {
  for (const kind of BANNER_KINDS) {
    const first = new Map<number, string>();
    for (const b of kinds[kind])
      if (!b.rerunOf)
        for (const f of b.featured) {
          if (f.id == null) continue;
          const seen = first.get(f.id);
          if (seen === undefined || b.start.date < seen) first.set(f.id, b.start.date);
        }
    for (const b of kinds[kind]) {
      for (const f of b.featured)
        if (b.from_news || f.from_news) f.new = !b.rerunOf && f.id != null && first.get(f.id) === b.start.date;
      if (b.from_news) b.main = pickMain(b.featured);
    }
  }
}

// The news (scout posts as bannerPost(post, jpLexicon) reads them) merged over the stored banners. Pure and idempotent.
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
  const kinds = seedDrafts(jp);
  const seeded = new Map<BannerId, Known>();
  for (const kind of BANNER_KINDS) for (const banner of kinds[kind]) seeded.set(banner.id, { kind, banner });
  const s: Merge = {
    kinds,
    byId: new Map(),
    resolve: resolver({ cards, banners: [jp, global], trainees }),
    enriched: [],
    made: [],
    reruns: [],
    unresolved: [],
    mismatches: [],
    skipped: [],
  };

  const latest = newestPerBanner(posts, (b) => (b.start ? { ...b, start: b.start } : null));
  const reheld = newestPerBanner(posts, (b) =>
    b.rerun?.start ? { ...b, rerun: { ...b.rerun, start: b.rerun.start } } : null
  );
  for (const [id, announced] of latest) {
    const known = seeded.get(id);
    if (known) enrichSeeded(s, id, announced, known);
    else makeFromNews(s, id, announced);
  }
  addReruns(s, reheld);
  markNew(kinds);

  // TODO(ts): every featured item has `new` once markNew() has set it (Item's `new` is optional until then).
  const done = (list: Draft[]): Banner[] => list as Banner[];
  return {
    jp: {
      ...jp,
      characters: done(kinds.characters.sort(newestBannersFirst)),
      cards: done(kinds.cards.sort(newestBannersFirst)),
    },
    enriched: done(s.enriched),
    made: done(s.made),
    reruns: done(s.reruns),
    unresolved: s.unresolved,
    mismatches: s.mismatches,
    skipped: s.skipped,
  };
}

export const readJpBanners = (file = dataFile('jp', 'banners')): BannerFile => readJson<BannerFile>(file);
export const writeJpBanners = (jp: BannerFile): void => writeBannerFile(dataFile('jp', 'banners'), jp);

const banners = (n: number): string => `${n} banner${n === 1 ? '' : 's'}`;

// The JP news' banners (each post as bannerPost(post, jpLexicon) reads it) merged over data/jp_banners.json, and the
// summary's lines; the caller writes the result.
export function updateJpBanners({
  scouts,
  cards,
}: {
  scouts: ScoutPost[];
  cards: CardsFile;
}): ApplyJpNewsResult & { lines: string[] } {
  const jp = readJpBanners();
  const global = existsSync(dataFile('gl', 'banners')) ? readJpBanners(dataFile('gl', 'banners')) : null;
  const trainees = readJson<GametoraTrainee[] | null>(GAMETORA_TRAINEES_FILE, null);
  const result = applyJpNews({ posts: scouts, jp, cards, global, trainees });
  const changed = !sameJson(result.jp, jp);

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
