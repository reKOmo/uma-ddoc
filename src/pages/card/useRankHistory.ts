import { useMemo } from 'react';
import type { Ranked, Stat } from '../../../tierlist/index.ts';
import { cards } from '../../../tierlist/cards.ts';
import type { Server } from '../../../tierlist/cards.ts';
import type { PredictionsFile } from '../../../shared/schemas/predictions.ts';
import { rankHistory } from '../../lib/rankHistory.ts';
import { useUpcomingRanking } from './useUpcomingRanking.ts';

type RankHistoryOptions = {
  cardId: number;
  server: Server;
  scenario: string;
  lb: number;
  stat: Stat | undefined;
  rankings: Record<string, Ranked[]>;
  // undefined = still loading them, null = the server has none.
  predictions: PredictionsFile | null | undefined;
};

// The card's rank history in one scenario at one LB; with predictions, continued into the predicted releases.
// ranking is null while it computes; history null when the card has no release date there.
export function useRankHistory({ cardId, server, scenario, lb, stat, rankings, predictions }: RankHistoryOptions) {
  const upcoming = useUpcomingRanking(server, scenario, stat, !!predictions);
  const ranking = predictions === undefined ? null : predictions ? upcoming : (rankings[scenario] ?? null);

  // O(dates × cards): kept across the page's many re-renders (each scenario's ranking arriving, zoom, picks).
  return useMemo(() => {
    const released = (id: number) => cards[id]?.release[server]?.date ?? null;
    const releaseOf = (id: number) => released(id) ?? predictions?.cards[id]?.release_gl.date ?? null;
    const isPredicted = (id: number) => !released(id) && !!predictions?.cards[id];
    const history = ranking && rankHistory(ranking, cardId, lb, releaseOf, isPredicted);
    const passes = history ? history.filter((p) => p.overtakenBy.length > 0) : [];
    const now = history?.filter((p) => !p.predicted).at(-1);
    // The first predicted date it sits in a lower tier than it does today.
    const drop = now && history?.find((p) => p.predicted && p.tier > now.tier);
    return { ranking, history, passes, now, first: history?.[0], end: history?.at(-1), drop };
  }, [ranking, cardId, lb, server, predictions]);
}
