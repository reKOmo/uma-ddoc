// Rebuilds upstream-format card objects (one per id × limit break, in upstream's id/LB order) from
// generated/cards.json (type, rarity) plus one server's generated/card_stats/<server>_card_stats.json
// (the character's name in that server's language, which scenarioLink relies on, event rewards and
// the stats per limit break).

import { CARD_TYPES, type CardType, RARITIES, type Rarity } from '../shared/schemas/common.ts';
import type { CardsFile, CardStatsFile, LbStats } from '../shared/schemas/card.ts';

// cards.json's readable types and rarities → upstream's codes. Group cards are friend-type (6) with
// `group: true`.
export const TYPE_CODES: Record<CardType, number> = {
  speed: 0,
  stamina: 1,
  power: 2,
  guts: 3,
  wisdom: 4,
  friend: 6,
  group: 6,
};
export const RARITY_CODES: Record<Rarity, number> = { R: 1, SR: 2, SSR: 3 };
export const typeOf = (code: number, group: boolean): CardType | undefined =>
  group ? 'group' : CARD_TYPES.find((t) => TYPE_CODES[t] === code);
export const rarityOf = (code: number): Rarity | undefined => RARITIES.find((r) => RARITY_CODES[r] === code);

// One upstream card object: a limit break's stats (LbStats) plus the card's fields, and `events`.
export type JoinedCard = LbStats & {
  id: number;
  type: number;
  group: boolean;
  rarity: number;
  limit_break: number;
  char_name: string;
  events: number[] | null;
};

// Upstream's card objects, plus `events` (the card's event rewards or null), which the calculation
// reads; without it they're exactly upstream's list (see withoutEvents).
export function joinCards(cards: CardsFile, stats: CardStatsFile): JoinedCard[] {
  const joined: JoinedCard[] = [];
  // Integer keys iterate in ascending order, so cards come out sorted by id.
  for (const [id, { charName, events, lb }] of Object.entries(stats)) {
    const card = cards[id];
    lb.forEach((levelStats, limit_break) => {
      joined.push({
        id: card.id,
        type: TYPE_CODES[card.type],
        group: card.type === 'group',
        rarity: RARITY_CODES[card.rarity],
        limit_break,
        ...levelStats,
        char_name: charName,
        events,
      });
    });
  }
  return joined;
}

export const withoutEvents = (joined: JoinedCard[]): Omit<JoinedCard, 'events'>[] =>
  joined.map(({ events, ...card }) => card);
