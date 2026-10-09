// Pure: the card data the site, the tier list calculation and ml/ read, built from the raw inputs
// (see scripts/build-cards.js):
//   upstream     upstream's card lists ({ gl, jp }: arrays of one object per card × limit break) and
//                card events ({ [id]: [8 numbers] }), from generated/raw/upstream/
//   gametora     GameTora's support cards (generated/raw/gametora_cards.json; optional: [] without it)
//   globalCards  Global's own record (data/global_cards.json): { [id]: { title_en, release_gl } }
//   iconBase     upstream's card images at the same commit
// into
//   cards        { [id]: card } for every card upstream or GameTora has (shape: schemas/cards.schema.json)
//   stats        { gl, jp }: { [id]: { charName, events, lb: [stats at LB0…LB4] } } for the server's
//                cards upstream has stats for
// Throws if the outputs don't join back to upstream's exact lists (tierlist/join-cards.js).

import { isDeepStrictEqual } from 'node:util';
import { joinCards, rarityOf, typeOf, withoutEvents } from '../../tierlist/join-cards.js';

const GAMETORA = 'https://gametora.com';

// GameTora's type names → ours (the tier list's stat keys, plus group).
const GAMETORA_TYPES = { intelligence: 'wisdom' };

// Upstream's per-card fields; the rest of a card object is its stats at that limit break.
const statsOf = ({ id, limit_break, char_name, type, group, rarity, ...stats }) => stats;

export function buildCards({ upstream, gametora = [], globalCards = {}, iconBase }) {
  const gt = new Map(gametora.map((c) => [c.support_id, c]));
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
    const charId = gt.get(Number(id))?.char_id;
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
      charId: g?.char_id ?? null,
      // Upstream's where it has the card (the calculation's), else GameTora's.
      type: up?.type ?? GAMETORA_TYPES[g.type] ?? g.type,
      rarity: up?.rarity ?? rarityOf(g.rarity),
      name: {
        en: (!group && (up?.name.gl ?? globalName.get(g?.char_id))) || (g?.char_name ?? up?.name.gl ?? null),
        jp: g?.name_jp ?? up?.name.jp ?? null,
      },
      title: { en: gl?.title_en ?? g?.title_en ?? null, jp: g?.title_ja ?? null },
      release: { gl: gl?.release_gl ?? null, jp: g?.release ?? null },
      source: g?.obtained ? [g.obtained] : [],
      links: { gametora: g ? `${GAMETORA}/umamusume/supports/${g.url_name}` : null },
      images: {
        icon: up
          ? `${iconBase}support_card_s_${id}.png`
          : `${GAMETORA}/images/umamusume/supports/support_card_s_${id}.png`,
        art: `${GAMETORA}/images/umamusume/supports/tex_support_card_${id}.png`,
      },
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
