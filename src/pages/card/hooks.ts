import { useEffect, useState } from 'react';
import { rankByUsefulness, scenarioOptions } from '../../../tierlist/index.ts';
import type { Ranked, Stat } from '../../../tierlist/index.ts';
import { cards } from '../../../tierlist/cards.ts';
import type { Server } from '../../../tierlist/cards.ts';
import type { PredictionsFile } from '../../../shared/schemas/predictions.ts';
import type { Entry } from '../../timeline/entries.ts';
import { cardOrigins } from '../../cardOrigins.ts';
import type { Origin } from '../../cardOrigins.ts';
import { loadPredictions } from '../../predictions.ts';
import { loadEntries } from '../../timeline/data.ts';
import { useAsync } from '../../useAsync.ts';

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

// Rankings for every scenario, then the averaged ones (cheap once the real ones
// are cached), filled in one at a time so rows appear as they finish.
export function useScenarioRankings(server: Server, stat: Stat | undefined, enabled: boolean) {
  const [rankings, setRankings] = useState<Record<string, Ranked[]>>({});
  useEffect(() => {
    let cancelled = false;
    setRankings({});
    if (!enabled || !stat) return;
    (async () => {
      for (const scenario of scenarioOptions(server)) {
        // Each ranking blocks for ~100-300 ms; yield first so the page paints.
        await new Promise((resolve) => setTimeout(resolve));
        if (cancelled) return;
        const ranking = await rankByUsefulness(server, scenario, stat);
        if (cancelled) return;
        setRankings((prev) => ({ ...prev, [scenario]: ranking }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [server, stat, enabled]);
  return rankings;
}

// The servers whose banners and events say where a card comes from: the selected one, and JP's too for a card not on
// Global yet.
const originServers = (card: (typeof cards)[number] | undefined, server: Server): Server[] =>
  server === 'gl' && !card?.release.gl ? ['gl', 'jp'] : [server];

export type EntryOrigin = Origin<Entry, Server>;
export type Origins = { servers: Server[]; list: EntryOrigin[] };

// Where the card comes from (cardOrigins(), oldest first) on originServers(): { servers, list }, null while loading.
export function useOrigins(cardId: number, server: Server): Origins | null | undefined {
  const { data, pending } = useAsync(async () => {
    const servers = originServers(cards[cardId], server);
    const lists = await Promise.all(servers.map((s) => loadEntries(s)));
    const byServer: Partial<Record<Server, Entry[]>> = Object.fromEntries(servers.map((s, i) => [s, lists[i] ?? []]));
    return { servers, list: cardOrigins(cardId, byServer) };
  }, [cardId, server]);
  return pending ? null : data;
}
