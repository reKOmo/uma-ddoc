// rankHistory replays a ranking as cards are released.

import { describe, it, expect } from 'vitest';
import { rankHistory } from '../src/rankHistory.js';

// Sorted by score, as rankByUsefulness returns it; card 2 also has an LB0 copy.
const ranking = [
  { id: 4, lb: 4, score: 100 },
  { id: 2, lb: 4, score: 80 },
  { id: 1, lb: 4, score: 60 },
  { id: 3, lb: 4, score: 40 },
  { id: 2, lb: 0, score: 30 },
  { id: 5, lb: 4, score: 20 },
];
const RELEASES = { 1: '2025-01-01', 2: '2024-06-01', 3: '2025-03-01', 4: '2025-05-01', 5: null };
const releaseOf = (id) => RELEASES[id];

describe('rankHistory', () => {
  it("starts at the card's release and adds a point per later release date", () => {
    const history = rankHistory(ranking, 1, 4, releaseOf);
    expect(history.map((p) => [p.date, p.position, p.total])).toEqual([
      ['2025-01-01', 2, 2],
      ['2025-03-01', 2, 3],
      ['2025-05-01', 3, 4],
    ]);
  });

  it('names the cards that overtook it, and only on their release date', () => {
    const history = rankHistory(ranking, 1, 4, releaseOf);
    expect(history.map((p) => p.overtakenBy.map((c) => c.id))).toEqual([[], [], [4]]);
  });

  it('only compares against the same limit break', () => {
    const history = rankHistory(ranking, 2, 0, releaseOf);
    expect(history).toEqual([{ date: '2024-06-01', position: 1, total: 1, tier: 0, overtakenBy: [] }]);
  });

  it('returns null for cards without a release date or ranking', () => {
    expect(rankHistory(ranking, 5, 4, releaseOf)).toBeNull();
    expect(rankHistory(ranking, 9, 4, releaseOf)).toBeNull();
  });
});
