import { useEffect, useMemo, useState } from 'react';
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
import { useLanguage } from '../../lib/translations.ts';

// The server's predicted release dates (only Global has them): undefined while loading, null without any.
export function usePredictions(server: Server): PredictionsFile | null | undefined {
  const { data, pending } = useAsync(() => (server === 'gl' ? loadPredictions() : Promise.resolve(null)), [server]);
  return pending ? undefined : data;
}

// The ranking with the server's upcoming cards in it, computed after the page has painted.
export function useUpcomingRanking(server: Server, scenario: string, stat: Stat | undefined, enabled: boolean) {
  const [ranking, setRanking] = useState<Ranked[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRanking(null);
    if (!enabled || !stat) return;
    const timer = setTimeout(async () => {
      const result = await rankByUsefulness(server, scenario, stat, { upcoming: true });
      if (!cancelled) setRanking(result);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [server, scenario, stat, enabled]);
  return ranking;
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

// Rankings for every scenario, then the averaged ones (cheap once the real ones
// are cached), filled in one at a time so rows appear as they finish.
// `upcoming`: with the server's cards still to come in them (for a card not out yet, ranked by its JP stats).
export function useScenarioRankings(server: Server, stat: Stat | undefined, enabled: boolean, upcoming = false) {
  const [rankings, setRankings] = useState<Record<string, Ranked[]>>({});
  useEffect(() => {
    let cancelled = false;
    setRankings({});
    if (!enabled || !stat) return;
    (async () => {
      for (const scenario of scenarioOptions(server)) {
        // Each ranking blocks for ~40-150 ms; yield first so the page paints.
        await new Promise((resolve) => setTimeout(resolve));
        if (cancelled) return;
        const ranking = await rankByUsefulness(server, scenario, stat, { upcoming });
        if (cancelled) return;
        setRankings((prev) => ({ ...prev, [scenario]: ranking }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [server, stat, enabled, upcoming]);
  return rankings;
}

export type EntryOrigin = Origin<Entry, Server>;
export type Origins = EntryOrigin[];

// Where the card comes from on the selected server (cardOrigins(), oldest first), null while loading.
export function useOrigins(cardId: number, server: Server): Origins | null | undefined {
  const language = useLanguage(server);
  const { data, pending } = useAsync(
    async () => cardOrigins<Entry, Server>(cardId, { [server]: await loadEntries(server, { language }) }),
    [cardId, server, language]
  );
  return pending ? null : data;
}
