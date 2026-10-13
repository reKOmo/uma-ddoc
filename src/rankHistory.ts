import { type RankedCard, toTiers } from './tiers.ts';

// A card's score doesn't depend on the other candidates (each is scored against fixed decks), so the tier list on a past
// date is the ranking filtered to the cards released by then. Compares the card with the others at the same limit break.
// One point per date its place changed, from its release: { date, position, total, tier, overtakenBy, predicted }
// (overtakenBy: the cards released that day that score higher). Null if the card isn't ranked or has no release date.

export type HistoryPoint = {
  date: string;
  position: number;
  total: number;
  tier: number;
  overtakenBy: RankedCard[];
  predicted: boolean;
};

export function rankHistory(
  ranking: RankedCard[],
  cardId: number,
  lb: number,
  releaseOf: (id: number) => string | null,
  isPredicted: (id: number) => boolean = () => false
): HistoryPoint[] | null {
  const field = ranking.filter((c) => c.lb === lb && releaseOf(c.id));
  const self = field.find((c) => c.id === cardId);
  if (!self) return null;
  const start = releaseOf(cardId);
  if (!start) return null;
  const later = field.map((c) => releaseOf(c.id)).filter((date): date is string => date != null && date > start);
  const dates = [start, ...[...new Set(later)].sort()];

  return dates.map((date) => {
    const available = field.filter((c) => (releaseOf(c.id) ?? '') <= date);
    return {
      date,
      position: available.indexOf(self) + 1,
      total: available.length,
      tier: toTiers(available).findIndex((tier) => tier.includes(self)),
      overtakenBy: available.filter((c) => c.score > self.score && releaseOf(c.id) === date && date > start),
      predicted: available.some((c) => releaseOf(c.id) === date && isPredicted(c.id)),
    };
  });
}
