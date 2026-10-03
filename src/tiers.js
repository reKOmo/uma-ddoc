// Tier grouping shared by the tier list page and the banner sheet.

export const TIER_NAMES = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

// GameTora's support card types → the tier list's stat tabs.
export const STAT_OF_TYPE = {
  speed: 'speed',
  stamina: 'stamina',
  power: 'power',
  guts: 'guts',
  intelligence: 'wisdom',
  friend: 'friend',
  group: 'friend',
};

// Same banding as upstream TierList.jsx: split the score range into 7 steps.
export function toTiers(ranking) {
  if (ranking.length === 0) return [];
  const top = ranking[0].score;
  const step = (top - ranking[ranking.length - 1].score) / 7;
  let boundary = top - step;
  const tiers = [[]];
  for (const card of ranking) {
    while (card.score < boundary - 1) {
      tiers.push([]);
      boundary -= step;
    }
    tiers[tiers.length - 1].push(card);
  }
  return tiers;
}

// "id/lb" → { tier, position, total } for one ranking, computed once per ranking.
const ranksCache = new WeakMap();
export function cardRanks(ranking) {
  if (!ranksCache.has(ranking)) {
    const ranks = new Map();
    let position = 0;
    toTiers(ranking).forEach((tier, i) => {
      for (const card of tier)
        ranks.set(`${card.id}/${card.lb}`, { tier: i, position: ++position, total: ranking.length });
    });
    ranksCache.set(ranking, ranks);
  }
  return ranksCache.get(ranking);
}
