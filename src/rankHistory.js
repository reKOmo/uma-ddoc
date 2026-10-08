import { toTiers } from './tiers.js';

// A card's place in one stat's tier list over time. Each card's score is
// independent of the other candidates (it's scored against fixed decks), so
// the tier list on any past date is just the ranking filtered to the cards
// released by then.
//
// ranking:   rankByUsefulness() result (sorted by score, every id × LB)
// releaseOf: id → "YYYY-MM-DD" on the server, or null (left out of the history)
// isPredicted: id → whether releaseOf's date is a prediction, not a real release
// Compares the card against every other card at the same limit break.
// Returns one point per date the field changed, from the card's own release:
//   { date, position, total, tier, overtakenBy: [entry…], predicted }
// where overtakenBy lists the cards released that day that score higher, and
// predicted says a card released that day only has a predicted date.
// Returns null if the card isn't ranked or has no release date.
export function rankHistory(ranking, cardId, lb, releaseOf, isPredicted = () => false) {
  const field = ranking.filter((c) => c.lb === lb && releaseOf(c.id));
  const self = field.find((c) => c.id === cardId);
  if (!self) return null;
  const start = releaseOf(cardId);
  const later = field.map((c) => releaseOf(c.id)).filter((date) => date > start);
  const dates = [start, ...[...new Set(later)].sort()];

  return dates.map((date) => {
    const available = field.filter((c) => releaseOf(c.id) <= date);
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
