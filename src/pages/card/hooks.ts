import { useMemo } from 'react';
import { rankByUsefulness, scenarioOptions } from '../../../tierlist/index.ts';
import type { Ranked, Stat } from '../../../tierlist/index.ts';
import { cards } from '../../../tierlist/cards.ts';
import type { Server } from '../../../tierlist/cards.ts';
import type { PredictionsFile } from '../../../shared/schemas/predictions.ts';
import type { Entry } from '../../timeline/entries.ts';
import { cardOrigins } from '../../lib/cardOrigins.ts';
import type { Origin } from '../../lib/cardOrigins.ts';
import { loadPredictions } from '../../lib/predictions.ts';
import { rankHistory } from '../../lib/rankHistory.ts';
import { loadEntries } from '../../timeline/data.ts';
import { useAsync } from '../../hooks/useAsync.ts';
import { useRanking } from '../../hooks/useRanking.ts';
import { useLanguage } from '../../lib/translations.ts';

// The server's predicted release dates (only Global has them): undefined while loading, null without any.
export function usePredictions(server: Server): PredictionsFile | null | undefined {
  const { data, pending } = useAsync(() => (server === 'gl' ? loadPredictions() : Promise.resolve(null)), [server]);
  return pending ? undefined : data;
}

// The ranking with the server's upcoming cards in it, computed after the page has painted.
function useUpcomingRanking(server: Server, scenario: string, stat: Stat | undefined, enabled: boolean) {
  return useRanking(
    async () => (enabled && stat ? rankByUsefulness(server, scenario, stat, { upcoming: true }) : null),
    [server, scenario, stat, enabled]
  );
}

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

const NONE: Record<string, Ranked[]> = {};

// Rankings for every scenario, then the averaged ones (cheap once the real ones
// are cached), filled in one at a time so rows appear as they finish.
// `upcoming`: with the server's cards still to come in them (for a card not out yet, ranked by its JP stats).
export function useScenarioRankings(server: Server, stat: Stat | undefined, enabled: boolean, upcoming = false) {
  const rankings = useRanking<Record<string, Ranked[]>>(
    async (next, show) => {
      let done: Record<string, Ranked[]> = NONE;
      if (!enabled || !stat) return done;
      for (const [i, scenario] of scenarioOptions(server).entries()) {
        if (i > 0) await next();
        done = { ...done, [scenario]: await rankByUsefulness(server, scenario, stat, { upcoming }) };
        show(done);
      }
      return done;
    },
    [server, stat, enabled, upcoming]
  );
  return rankings ?? NONE;
}

export type EntryOrigin = Origin<Entry>;
export type Origins = EntryOrigin[];

// Where the card comes from on the selected server (cardOrigins(), oldest first), null while loading.
export function useOrigins(cardId: number, server: Server): Origins | null | undefined {
  const language = useLanguage(server);
  const { data, pending } = useAsync(
    async () => cardOrigins(cardId, await loadEntries(server, language), server),
    [cardId, server, language]
  );
  return pending ? null : data;
}
