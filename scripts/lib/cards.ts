// @ts-nocheck
// Pure: the card data the site, the tier list calculation and ml/ read, built from the raw inputs
// (see scripts/build-cards.js):
//   upstream     upstream's card lists ({ gl, jp }: arrays of one object per card × limit break) and
//                card events ({ [id]: [8 numbers] }), from generated/raw/upstream/
//   history      our history of JP's cards (data/jp_cards.json, committed): { [id]: entry } (entry: see fromGametora()):
//                a frozen record of what GameTora said about each card (2026-10), then the cards the JP news shows,
//                augmented from GameTora (scripts/lib/jp-cards.js, `pnpm update-jp`); it never takes GameTora's values
//   gametora     GameTora's support cards (generated/raw/gametora_cards.json; optional: [] without it), only for every
//                card's page slug: a card GameTora lists that the history lacks isn't added (update-jp warns)
//   globalCards  Global's own record (data/global_cards.json): { [id]: { title_en, release_gl } }
//   iconBase     upstream's card images at the same commit
// into
//   cards        { [id]: card } for every card upstream or the history has (shape: schemas/cards.schema.json)
//   stats        { gl, jp }: { [id]: { charName, events, lb: [stats at LB0…LB4] } } for the server's
//                cards upstream has stats for
// Throws if the outputs don't join back to upstream's exact lists (tierlist/join-cards.js).
// No URLs but upstream's icons: the app builds GameTora's (card page, full art, icons) from the id and the slug.

import { isDeepStrictEqual } from 'node:util';
import { joinCards, rarityOf, typeOf, withoutEvents } from '../../tierlist/join-cards.ts';

// GameTora's type names → ours (the tier list's stat keys, plus group).
const GAMETORA_TYPES = { intelligence: 'wisdom' };

// Upstream's per-card fields; the rest of a card object is its stats at that limit break.
const statsOf = ({ id, limit_break, char_name, type, group, rarity, ...stats }) => stats;

// A GameTora support card (raw/gametora_cards.json) → a history entry (data/jp_cards.json):
// { charId, type, rarity, name: { en, jp }, title: { en, jp }, release (JP's, "YYYY-MM-DD"), source, slug }, in our
// names (type wisdom, rarity SSR…); name.en / title.en are GameTora's English (fallbacks only). The frozen cards are
// exactly this; a card from the news takes its JP fields from the news (+ `news_url`: scripts/lib/jp-cards.js).
export const fromGametora = (g) => ({
  charId: g.char_id ?? null,
  type: GAMETORA_TYPES[g.type] ?? g.type,
  rarity: rarityOf(g.rarity) ?? null,
  name: { en: g.char_name ?? null, jp: g.name_jp ?? null },
  title: { en: g.title_en ?? null, jp: g.title_ja ?? null },
  release: g.release ?? null,
  source: g.obtained ? [g.obtained] : [],
  slug: g.url_name ?? null,
});

export function buildCards({ upstream, history = {}, gametora = [], globalCards = {}, iconBase }) {
  // The history; GameTora only for slugs.
  const gt = new Map(Object.entries(history).map(([id, entry]) => [Number(id), entry]));
  const slugs = new Map();
  for (const c of gametora) if (c.url_name) slugs.set(c.support_id, c.url_name);
  // Upstream's cards: names per server (each in its own language), type and rarity.
  const own = {};
  for (const [server, list] of Object.entries({ gl: upstream.gl, jp: upstream.jp })) {
    for (const card of list) {
      own[card.id] ??= { type: typeOf(card.type, card.group), rarity: rarityOf(card.rarity), name: {} };
      own[card.id].name[server] = card.char_name;
    }
  }
  // A character's Global name, for its cards Global doesn't have yet (group cards are named after
  // the group on GameTora, after a member upstream).
  const globalName = new Map();
  for (const [id, card] of Object.entries(own)) {
    const charId = gt.get(Number(id))?.charId;
    if (card.name.gl && charId && card.type !== 'group') globalName.set(charId, card.name.gl);
  }

  const ids = [...new Set([...Object.keys(own).map(Number), ...gt.keys()])].sort((a, b) => a - b);
  const cards = {};
  for (const id of ids) {
    const up = own[id];
    const g = gt.get(id);
    const group = (up?.type ?? g?.type) === 'group';
    const gl = globalCards[id];
    cards[id] = {
      id,
      charId: g?.charId ?? null,
      // Upstream's where it has the card (the calculation's), else the history's.
      type: up?.type ?? g.type,
      rarity: up?.rarity ?? g.rarity,
      name: {
        en: (!group && (up?.name.gl ?? globalName.get(g?.charId))) || (g?.name.en ?? up?.name.gl ?? null),
        jp: g?.name.jp ?? up?.name.jp ?? null,
      },
      title: { en: gl?.title_en ?? g?.title.en ?? null, jp: g?.title.jp ?? null },
      release: { gl: gl?.release_gl ?? null, jp: g?.release ?? null },
      source: g?.source ?? [],
      // GameTora's page slug (https://gametora.com/umamusume/supports/<slug>; /supports/<id> alone is a 404).
      links: { gametora: slugs.get(id) ?? g?.slug ?? null },
      // Upstream's icon where it has the card; the app falls back to GameTora's, built from the id.
      images: { icon: up ? `${iconBase}support_card_s_${id}.png` : null },
    };
  }

  const stats = {};
  for (const server of ['gl', 'jp']) {
    stats[server] = {};
    for (const card of upstream[server]) {
      stats[server][card.id] ??= { charName: card.char_name, events: upstream.events[card.id] ?? null, lb: [] };
      stats[server][card.id].lb[card.limit_break] = statsOf(card);
    }
    if (!isDeepStrictEqual(withoutEvents(joinCards(cards, stats[server])), upstream[server])) {
      throw new Error(`${server}: the card data doesn't join back to upstream's list`);
    }
  }
  return { cards, stats };
}
