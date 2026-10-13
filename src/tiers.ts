import type { CardType, GametoraType } from '../shared/schemas/common.ts';
import type { Ranked, Stat } from '../tierlist/index.ts';

export const TIER_NAMES = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

// A support card's id (cards.json's keys are strings, a card's `id` a number).
export type RankedCard = Pick<Ranked, 'id' | 'lb' | 'score'>;

// Support card types → the tier list's stat tabs (banner files say GameTora's `intelligence`, cards.json `wisdom`).
export const STAT_OF_TYPE: Record<GametoraType | CardType, Stat> = {
  speed: 'speed',
  stamina: 'stamina',
  power: 'power',
  guts: 'guts',
  intelligence: 'wisdom',
  wisdom: 'wisdom',
  friend: 'friend',
  group: 'friend',
};

// Same banding as upstream TierList.jsx: split the score range into 7 steps.
export function toTiers<T extends { score: number }>(ranking: T[]): T[][] {
  if (ranking.length === 0) return [];
  const top = ranking[0].score;
  const step = (top - ranking[ranking.length - 1].score) / 7;
  let boundary = top - step;
  const tiers: T[][] = [[]];
  for (const card of ranking) {
    while (card.score < boundary - 1) {
      tiers.push([]);
      boundary -= step;
    }
    tiers[tiers.length - 1].push(card);
  }
  return tiers;
}

export type Rank = { tier: number; position: number; total: number };

// "id/lb" → { tier, position, total } for one ranking, computed once per ranking.
const ranksCache = new WeakMap<RankedCard[], Map<string, Rank>>();
export function cardRanks(ranking: RankedCard[]): Map<string, Rank> {
  const cached = ranksCache.get(ranking);
  if (cached) return cached;
  const ranks = new Map<string, Rank>();
  let position = 0;
  toTiers(ranking).forEach((tier, i) => {
    for (const card of tier)
      ranks.set(`${card.id}/${card.lb}`, { tier: i, position: ++position, total: ranking.length });
  });
  ranksCache.set(ranking, ranks);
  return ranks;
}
