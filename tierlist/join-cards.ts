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

export type JoinedCard = LbStats & {
  id: number;
  type: number;
  group: boolean;
  rarity: number;
  limit_break: number;
  char_name: string;
  events: number[] | null;
};

// `events` (the card's event rewards or null) is what the calculation reads beyond upstream's list; withoutEvents()
// gives that list exactly.
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
