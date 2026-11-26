// JP's support cards (data/jp_cards.json, committed): our history, keyed by id, one card per line. Its first 563 are a
// frozen record of GameTora's list (2026-10) and never change. Newer cards come from the JP news, augmented from
// GameTora once its list has them (`pnpm update-jp`). Cards GameTora doesn't list yet go to jp_cards_pending.json.
// Upstream's jp.js isn't used for ids: it adds a card only once its stats are known, after GameTora lists it.

import { writeFileSync } from 'node:fs';
import { rarityOf } from '../../../tierlist/join-cards.ts';
import { type CardSource, type Rarity, dated } from '../../../shared/schemas/common.ts';
import type { JpCard, JpCardsFile, JpPendingCard } from '../../../shared/schemas/card.ts';
import type { GametoraCard } from '../../../shared/schemas/gametora.ts';
import type { NewsPost } from '../../../shared/schemas/news.ts';
import { type BannerPost, bannerPost } from '../banners/posts.ts';
import { fromGametora } from './build.ts';
import { eventFragments } from '../events/fragments.ts';
import type { JapaneseLexicon } from '../news/lang/index.ts';
import { jp as jpLexicon } from '../news/lang/jp.ts';
import { bareTitle, cardKey, jstDay, norm, toLines } from '../news/text.ts';
import { jsonEntries, jsonLines, readJson, sameJson } from '../json.ts';
import { DATA_DIR, dataFile } from '../paths.ts';

export const JP_PENDING_FILE = `${DATA_DIR}jp_cards_pending.json`;

// Where a card's first appearance came from.
type Source = 'gacha' | 'story_event' | 'gift';
// Which first appearance wins a tie on the same day.
const RANK: Record<Source, number> = { gacha: 0, story_event: 1, gift: 2 };

export type NewsCard = {
  rarity: Rarity;
  title: string;
  name: string;
  release: string;
  source: Source;
  news_url: string;
};
// A card the news shows, with the day it first appears (before the longest title is picked).
type Seen = { rarity: Rarity; title: string; name: string; start: string; source: Source; url: string };
// The news' rarity as the lexicon's patterns capture it.
// TODO(ts): the patterns capture a rarity as the news writes it (R, SR or SSR); not checked here.
const asRarity = (rarity: string): Rarity => rarity as Rarity;

// Every support card the JP news shows, at its first appearance (see above). `scouts`: each post's bannerPost(), when
// the caller has them already (in the posts' order).
export function newsCards(
  posts: NewsPost[],
  lang: JapaneseLexicon = jpLexicon,
  scouts: (BannerPost | null)[] = posts.map((post) => bannerPost(post, lang))
): NewsCard[] {
  const seen: Seen[] = [];
  for (const [i, post] of posts.entries()) {
    const scout = scouts[i];
    const supports = (scout?.banners ?? []).filter(
      (b): b is typeof b & { start: string } => b.type === 'support' && !!b.start
    );
    if (!scout || !supports.length) continue;
    const add = (f: { rarity: string; title: string; name: string }, start: string) =>
      seen.push({ rarity: asRarity(f.rarity), title: f.title, name: f.name, start, source: 'gacha', url: scout.url });
    // (a support scout lists cards only)
    for (const b of supports) for (const f of b.featured) if ('rarity' in f) add(f, b.start);
    // A card listed after a banner's own list (a select-pickup scout's new R card, under its own heading after the
    // candidates): from the post's first support scout.
    const listed = new Set(
      supports.flatMap((b) => b.featured.map((f: { title: string; name: string }) => cardKey(f.title, f.name)))
    );
    const first = supports.map((b) => b.start).sort()[0];
    for (const line of toLines(lang.clean(post.message ?? ''))) {
      const m = line.match(lang.bannerCard);
      if (m && !listed.has(cardKey(m[2], m[3]))) add({ rarity: m[1], title: m[2], name: m[3] }, first);
    }
  }
  for (const f of eventFragments(posts, {}, lang)) {
    const start = f.start;
    if (!start || f.undated) continue;
    const source: Source = f.kind === 'story' ? 'story_event' : 'gift';
    const add = (rarity: string, title: string, name: string) =>
      seen.push({
        rarity: asRarity(rarity),
        title: title.trim(),
        name: name.trim(),
        start,
        source,
        url: f.news_url,
      });
    for (const line of f.text.split('\n')) {
      for (const m of line.matchAll(lang.eventCard)) add(m[1], m[2] ?? m[4], m[3] ?? m[5]);
      if (!lang.newCardGiven.test(line) || lang.notGiven.test(line)) continue;
      for (const m of line.matchAll(lang.giftCard)) if (m[1] || m[2]) add(m[1] ?? m[2], m[3], m[4]);
    }
  }
  const earliest = new Map<string, NewsCard>();
  for (const s of seen) {
    const key = cardKey(s.title, s.name);
    const old = earliest.get(key);
    const date = jstDay(s.start);
    const better = !old || date < old.release || (date === old.release && RANK[s.source] < RANK[old.source]);
    const card: NewsCard = better
      ? {
          rarity: s.rarity,
          title: `[${bareTitle(s.title ?? '')}]`,
          name: s.name,
          release: date,
          source: s.source,
          news_url: s.url,
        }
      : old;
    // the longest spelling of the title (posts cut some short)
    if (old && bareTitle(old.title ?? '').length > bareTitle(card.title ?? '').length) card.title = old.title;
    earliest.set(key, card);
  }
  // A title cut short ("[掲げよ、燃え盛る灯]") joins the card with the full one, keeping the earliest appearance.
  const cards = [...earliest.values()];
  const titled = cards.map((c) => ({ title: c.title, name: c.name, ref: c }));
  return cards
    .filter((c) => {
      const full = longerTitle(c, titled);
      if (!full) return true;
      if (c.release < full.release || (c.release === full.release && RANK[c.source] < RANK[full.source]))
        Object.assign(full, { release: c.release, source: c.source, news_url: c.news_url });
      return false;
    })
    .sort(
      (a, b) => a.release.localeCompare(b.release) || cardKey(a.title, a.name).localeCompare(cardKey(b.title, b.name))
    );
}

// A card of some list (`ref`) by its title and name.
type Titled<T> = { title: string; name: string; ref: T };

// The one card among `list` with this card's name and a longer title starting with its title, or null.
function longerTitle<T>(card: NewsCard, list: Titled<T>[]): T | null {
  const title = norm(bareTitle(card.title ?? ''));
  if (title.length < 4) return null;
  const found = list.filter((c) => {
    const t = norm(bareTitle(c.title ?? ''));
    return c.ref !== card && t.length > title.length && t.startsWith(title) && norm(c.name) === norm(card.name);
  });
  return found.length === 1 ? found[0].ref : null;
}

export type ApplyNewsCardsResult = {
  history: JpCardsFile;
  pending: JpPendingCard[];
  added: number[];
  gametoraOnly: GametoraCard[];
  rarityDiffers: { id: number; card: NewsCard }[];
};

export function applyNewsCards({
  history,
  found,
  gametora = [],
}: {
  history: JpCardsFile;
  found: NewsCard[];
  gametora?: GametoraCard[];
}): ApplyNewsCardsResult {
  const frozen = Object.entries(history).filter(([, c]) => !c.news_url);
  const madeBefore = new Map(
    Object.entries(history)
      .filter(([, c]) => c.news_url)
      .map(([id, c]) => [cardKey(c.title.jp, c.name.jp), { id: Number(id), entry: c }] as const)
  );
  const known = new Map(frozen.map(([id, c]) => [cardKey(c.title.jp, c.name.jp), Number(id)] as const));
  const frozenTitled = frozen.map(([, c]) => ({ title: c.title.jp, name: c.name.jp, ref: c }));
  const gtByKey = new Map(gametora.map((g) => [cardKey(g.title_ja, g.name_jp), g] as const));
  const gtTitled = gametora.map((g) => ({ title: g.title_ja, name: g.name_jp, ref: g }));

  const made: Record<string, JpCard> = {};
  const pending: JpPendingCard[] = [];
  const rarityDiffers: { id: number; card: NewsCard }[] = [];
  for (const card of found) {
    const key = cardKey(card.title, card.name);
    // in the history already (its title in full, or cut short)
    if (known.has(key) || longerTitle(card, frozenTitled)) continue;
    const g = gtByKey.get(key) ?? longerTitle(card, gtTitled);
    if (g && known.has(cardKey(g.title_ja, g.name_jp))) continue;
    const before = madeBefore.get(key);
    const news = {
      rarity: card.rarity,
      jp: { name: card.name, title: card.title },
      release: card.release,
      source: card.source,
      news_url: card.news_url,
    };
    if (g) {
      if (rarityOf(g.rarity) && rarityOf(g.rarity) !== card.rarity) rarityDiffers.push({ id: g.support_id, card });
      made[g.support_id] = entry(fromGametora(g), news, g.obtained);
    } else if (before) {
      // (augmented before: its GameTora fields kept)
      made[before.id] = entry(before.entry, news, before.entry.source[0]);
    } else
      pending.push({
        rarity: card.rarity,
        name: { en: null, jp: card.name },
        title: { en: null, jp: card.title },
        release: dated(card.release, 'news'),
        source: [card.source === 'gift' ? 'promo' : card.source],
        news_url: card.news_url,
      });
  }

  const out = Object.fromEntries(frozen);
  for (const [id, e] of Object.entries(made)) if (!out[id]) out[id] = e;
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => Number(a) - Number(b)));
  const ids = new Set(Object.keys(sorted).map(Number));
  return {
    history: sorted,
    pending,
    added: Object.keys(made)
      .map(Number)
      .filter((id) => !history[id]),
    gametoraOnly: gametora.filter((g) => !ids.has(g.support_id)),
    rarityDiffers,
  };
}

// A history entry: GameTora's fields (fromGametora()'s shape, or those kept), the news' over them. A gift's source is
// GameTora's (promo or limited_quest), else promo.
function entry(
  g: {
    charId?: number | null;
    type?: JpCard['type'] | null;
    name?: { en?: string | null };
    title?: { en?: string | null };
    slug?: string | null;
  },
  news: { rarity: Rarity; jp: { name: string; title: string }; release: string; source: Source; news_url: string },
  obtained: CardSource
): JpCard {
  const source = news.source === 'gift' ? (obtained ?? 'promo') : news.source;
  // TODO(ts): name.en, charId and slug are null where GameTora's fields lack them (JpCard's schema wants them set).
  return {
    charId: g.charId ?? null,
    type: g.type ?? null,
    rarity: news.rarity,
    name: { en: g.name?.en ?? null, jp: news.jp.name },
    title: { en: g.title?.en ?? null, jp: news.jp.title },
    release: dated(news.release, 'news'),
    source: [source],
    slug: g.slug ?? null,
    news_url: news.news_url,
  } as JpCard;
}

export const readJpCards = (file = dataFile('jp', 'cards')): JpCardsFile => readJson<JpCardsFile>(file, {});
export const readPending = (file = JP_PENDING_FILE): JpPendingCard[] => readJson<JpPendingCard[]>(file, []);

export const writeJpCards = (cards: JpCardsFile, file = dataFile('jp', 'cards')): void =>
  writeFileSync(file, `${jsonEntries(cards)}\n`);
// (none pending: `[]`)
export const writePending = (pending: JpPendingCard[], file = JP_PENDING_FILE): void =>
  writeFileSync(file, `${pending.length ? jsonLines(pending) : '[]'}\n`);

const cardName = (c: JpPendingCard): string => `${c.title.jp ?? c.title}${c.name.jp ?? c.name}`;

// The JP news' cards into data/jp_cards.json (+ data/jp_cards_pending.json); returns { ...result, lines } for
// summary.md. `gametora`: generated/raw/gametora_cards.json's list, or null without it; `scouts`: as newsCards() takes.
export function updateJpCards({
  posts,
  scouts,
  gametora,
}: {
  posts: NewsPost[];
  scouts?: (BannerPost | null)[];
  gametora: GametoraCard[] | null;
}): ApplyNewsCardsResult & { lines: string[] } {
  const history = readJpCards();
  const result = applyNewsCards({ history, found: newsCards(posts, jpLexicon, scouts), gametora: gametora ?? [] });
  const changed = !sameJson([history, readPending()], [result.history, result.pending]);
  writeJpCards(result.history);
  writePending(result.pending);
  const made = Object.values(result.history).filter((c) => c.news_url).length;
  const lines = [
    `JP cards: ${Object.keys(result.history).length} (${made} from the news), ${result.pending.length} pending (not on GameTora yet)${result.added.length ? `, added: ${result.added.join(', ')}` : ''}${changed ? '' : ', nothing changed'}.`,
  ];
  if (result.pending.length) lines.push(`JP cards pending: ${result.pending.map(cardName).join(', ')}.`);
  if (!gametora) lines.push('JP cards: no generated/raw/gametora_cards.json (pnpm scrape-gametora): none augmented.');
  if (result.gametoraOnly.length)
    lines.push(
      `JP cards on GameTora but not in the news (not added): ${result.gametoraOnly.map((g) => `${g.support_id} ${g.title_ja}${g.name_jp}`).join(', ')}.`
    );
  for (const { id, card } of result.rarityDiffers)
    lines.push(`JP card ${id}: the news says ${card.rarity}, GameTora doesn't (${card.news_url}).`);
  return { ...result, lines };
}
