// @ts-nocheck
// JP's support cards (data/jp_cards.json, committed): our history of every JP card, keyed by id, one card per line.
// Its first 563 cards are a frozen record of GameTora's support card list (2026-10); they never change. Newer cards
// come from the JP news (scripts/update-jp.js), and GameTora augments them once its list has them. Pure, except the
// readers/writers at the bottom.
//
//   newsCards(posts)    every support card the JP news shows, with where it first appeared:
//                       [{ rarity, title, name, release, source, news_url }]
//     from              scout posts' support cards (bannerPost(post, ja)'s featured lists: every rarity, R cards too,
//                       paid scouts too; and any other card line in a scout post, ja.bannerCard: a select-pickup scout's
//                       new R card under its own heading), and the cards events give, named with their rarity (ja.eventCard: a story event's
//                       own SSR; ja.giftCard on a line that says it's given: a campaign's or gift's card)
//     title / name      as the post writes them (title in brackets, as the history keeps titles); a title a post cut
//                       short is the longest spelling another mention or the history has
//     release           the JST date ("YYYY-MM-DD") of its first appearance: the earliest start of a banner featuring it
//                       or of an event giving it (an event announced without dates doesn't count)
//     source            what that first appearance was: 'gacha' (a scout banner; a banner wins a tie), 'story_event' (a
//                       story event), 'gift' (any other event: a campaign, login bonus, missions…), which becomes
//                       GameTora's `obtained` once augmented (promo or limited_quest: the news can't tell them apart),
//                       else 'promo'
//
//   applyNewsCards({ history, found, gametora })  → { history, pending, added, gametoraOnly, rarityDiffers }
//     history           the frozen cards as they are, then each news card the history lacks (by title.jp + name.jp,
//                       normalised) that GameTora lists (by the same; a cut title by prefix): GameTora gives its id,
//                       charId, type, slug and English name/title, the news everything else (title.jp, name.jp, rarity,
//                       release, source but for gifts); `news_url` marks it news-made. Rebuilt from all posts each time
//                       (idempotent); without GameTora's list (or once it drops the card) its GameTora fields are kept.
//     pending           news cards GameTora doesn't list yet: no id, so not in generated/cards.json (no card page, not
//                       ranked; banners show them by name). [{ rarity, name: { en: null, jp }, title: { en: null, jp },
//                       release, source, news_url }]
//     added             ids of the news-made cards that weren't in the history before
//     gametoraOnly      GameTora's cards neither the history nor the news has: never added (a parser gap shows here)
//     rarityDiffers     news cards whose rarity isn't GameTora's (the news' is kept)
//
// Upstream's jp.js isn't used for ids: it adds a card once its stats are known, after GameTora lists it.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { rarityOf } from '../../tierlist/join-cards.ts';
import { bannerPost } from './banner-posts.ts';
import { fromGametora } from './cards.ts';
import { eventFragments } from './events.ts';
import { ja } from './news-lang/ja.ts';
import { norm, toLines } from './news-text.ts';
import { DATA_DIR } from './paths.ts';

export const JP_CARDS_FILE = `${DATA_DIR}jp_cards.json`;
export const JP_PENDING_FILE = `${DATA_DIR}jp_cards_pending.json`;

const HOUR = 3600 * 1000;
const jstDate = (iso) => new Date(Date.parse(iso) + 9 * HOUR).toISOString().slice(0, 10);
const bare = (title) => (title ?? '').replace(/^\[|\]$/g, '');
const keyOf = (title, name) => `${norm(bare(title))}|${norm(name)}`;
// Which first appearance wins a tie on the same day.
const RANK = { gacha: 0, story_event: 1, gift: 2 };

// Every support card the JP news shows, at its first appearance (see above).
export function newsCards(posts, lang = ja) {
  const seen = []; // { rarity, title, name, start, source, news_url }
  for (const post of posts) {
    const scout = bannerPost(post, lang);
    const supports = (scout?.banners ?? []).filter((b) => b.type === 'support' && b.start);
    if (!supports.length) continue;
    const add = (f, start) =>
      seen.push({ rarity: f.rarity, title: f.title, name: f.name, start, source: 'gacha', url: scout.url });
    for (const b of supports) for (const f of b.featured) add(f, b.start);
    // A card listed after a banner's own list (a select-pickup scout's new R card, under its own heading after the
    // candidates): from the post's first support scout.
    const listed = new Set(supports.flatMap((b) => b.featured.map((f) => keyOf(f.title, f.name))));
    const first = supports.map((b) => b.start).sort()[0];
    for (const line of toLines(lang.clean(post.message ?? ''))) {
      const m = line.match(lang.bannerCard);
      if (m && !listed.has(keyOf(m[2], m[3]))) add({ rarity: m[1], title: m[2], name: m[3] }, first);
    }
  }
  for (const f of eventFragments(posts, {}, lang)) {
    if (!f.start || f.undated) continue;
    const source = f.kind === 'story' ? 'story_event' : 'gift';
    const add = (rarity, title, name) =>
      seen.push({ rarity, title: title.trim(), name: name.trim(), start: f.start, source, url: f.news_url });
    for (const line of f.text.split('\n')) {
      for (const m of line.matchAll(lang.eventCard)) add(m[1], m[2] ?? m[4], m[3] ?? m[5]);
      if (!lang.newCardGiven.test(line) || lang.notGiven.test(line)) continue;
      for (const m of line.matchAll(lang.giftCard)) if (m[1] || m[2]) add(m[1] ?? m[2], m[3], m[4]);
    }
  }
  const earliest = new Map();
  for (const s of seen) {
    const key = keyOf(s.title, s.name);
    const old = earliest.get(key);
    const date = jstDate(s.start);
    const better = !old || date < old.release || (date === old.release && RANK[s.source] < RANK[old.source]);
    const card = better
      ? {
          rarity: s.rarity,
          title: `[${bare(s.title)}]`,
          name: s.name,
          release: date,
          source: s.source,
          news_url: s.url,
        }
      : old;
    // the longest spelling of the title (posts cut some short)
    if (old && bare(old.title).length > bare(card.title).length) card.title = old.title;
    earliest.set(key, card);
  }
  // A title cut short ("[掲げよ、燃え盛る灯]") joins the card with the full one, keeping the earliest appearance.
  const cards = [...earliest.values()];
  return cards
    .filter((c) => {
      const full = longerTitle(c, cards);
      if (!full) return true;
      if (c.release < full.release || (c.release === full.release && RANK[c.source] < RANK[full.source]))
        Object.assign(full, { release: c.release, source: c.source, news_url: c.news_url });
      return false;
    })
    .sort((a, b) => a.release.localeCompare(b.release) || keyOf(a.title, a.name).localeCompare(keyOf(b.title, b.name)));
}

// The one card among `list` with this card's name and a longer title starting with its title, or null.
function longerTitle(card, list, titleOf = (c) => c.title, nameOf = (c) => c.name) {
  const title = norm(bare(card.title));
  if (title.length < 4) return null;
  const found = list.filter((c) => {
    const t = norm(bare(titleOf(c)));
    return c !== card && t.length > title.length && t.startsWith(title) && norm(nameOf(c)) === norm(card.name);
  });
  return found.length === 1 ? found[0] : null;
}

export function applyNewsCards({ history, found, gametora = [] }) {
  const frozen = Object.entries(history).filter(([, c]) => !c.news_url);
  const madeBefore = new Map(
    Object.entries(history)
      .filter(([, c]) => c.news_url)
      .map(([id, c]) => [keyOf(c.title.jp, c.name.jp), { id: Number(id), entry: c }])
  );
  const known = new Map(frozen.map(([id, c]) => [keyOf(c.title.jp, c.name.jp), Number(id)]));
  const frozenList = frozen.map(([, c]) => c);
  const byTitle = (c) => c.title.jp;
  const byName = (c) => c.name.jp;
  const gtByKey = new Map(gametora.map((g) => [keyOf(g.title_ja, g.name_jp), g]));
  const gtTitle = (g) => g.title_ja;
  const gtName = (g) => g.name_jp;

  const made = {};
  const pending = [];
  const rarityDiffers = [];
  for (const card of found) {
    const key = keyOf(card.title, card.name);
    // in the history already (its title in full, or cut short)
    if (known.has(key) || longerTitle(card, frozenList, byTitle, byName)) continue;
    const g = gtByKey.get(key) ?? longerTitle(card, gametora, gtTitle, gtName);
    if (g && known.has(keyOf(g.title_ja, g.name_jp))) continue;
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
        release: card.release,
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
function entry(g, news, obtained) {
  const source = news.source === 'gift' ? (obtained ?? 'promo') : news.source;
  return {
    charId: g.charId ?? null,
    type: g.type ?? null,
    rarity: news.rarity,
    name: { en: g.name?.en ?? null, jp: news.jp.name },
    title: { en: g.title?.en ?? null, jp: news.jp.title },
    release: news.release,
    source: [source],
    slug: g.slug ?? null,
    news_url: news.news_url,
  };
}

// --- files ---------------------------------------------------------------------------------------------------------

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
export const readJpCards = (file = JP_CARDS_FILE) => readJson(file, {});
export const readPending = (file = JP_PENDING_FILE) => readJson(file, []);

// One card per line (excluded from Biome), as the history has always been written.
export function writeJpCards(cards, file = JP_CARDS_FILE) {
  const lines = Object.entries(cards).map(([id, c]) => `${JSON.stringify(id)}: ${JSON.stringify(c)}`);
  writeFileSync(file, `{\n${lines.join(',\n')}\n}\n`);
}
export function writePending(pending, file = JP_PENDING_FILE) {
  writeFileSync(file, pending.length ? `[\n${pending.map((c) => JSON.stringify(c)).join(',\n')}\n]\n` : '[]\n');
}

const cardName = (c) => `${c.title.jp ?? c.title}${c.name.jp ?? c.name}`;

// The JP news' cards into data/jp_cards.json (+ data/jp_cards_pending.json); returns { ...result, lines } for
// summary.md. `gametora`: generated/raw/gametora_cards.json's list, or null without it.
export function updateJpCards({ posts, gametora }) {
  const history = readJpCards();
  const result = applyNewsCards({ history, found: newsCards(posts), gametora: gametora ?? [] });
  const before = JSON.stringify([history, readPending()]);
  writeJpCards(result.history);
  writePending(result.pending);
  const changed = JSON.stringify([result.history, result.pending]) !== before;
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
