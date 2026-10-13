// @ts-nocheck
import { useEffect, useState } from 'react';
import { rankByUsefulness } from '../../tierlist/index.ts';
import { STAT_OF_TYPE, cardRanks } from '../tiers.ts';
import { cards } from '../../tierlist/cards.ts';
import { SHEET_ANIMATION_MS } from '../Sheet.tsx';

// Where these support cards (ids) rank at MLB in the server's tier list, computed once the sheet has slid in (a
// ranking blocks the page for a few hundred ms):
// { ranks: id → { tier, position, stat } | null, upcoming }, null while computing. The server's own ranking unless
// it lacks one of them (a card the server doesn't have yet: an announced or predicted banner on Global); then
// the one that also ranks JP's cards it doesn't have (`upcoming`: the card page's dashed future does the same), the
// server's own cards scored as before. A card no ranking has (JP's newest, without stats yet) is null.
export function useRankings(server, scenario, ids) {
  const [result, setResult] = useState(null);
  const key = ids.join();
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    const wanted = key
      ? key
          .split(',')
          .map(Number)
          .filter((id) => STAT_OF_TYPE[cards[id]?.type])
      : [];
    const statOf = (id) => STAT_OF_TYPE[cards[id].type];
    const stats = [...new Set(wanted.map(statOf))];
    const rank = async (options) => {
      const rankings = await Promise.all(stats.map((stat) => rankByUsefulness(server, scenario, stat, options)));
      const byStat = Object.fromEntries(stats.map((stat, i) => [stat, cardRanks(rankings[i])]));
      return new Map(
        wanted.map((id) => {
          const rank = byStat[statOf(id)].get(`${id}/4`);
          return [id, rank ? { ...rank, stat: statOf(id) } : null];
        })
      );
    };
    const timer = setTimeout(async () => {
      const own = await rank();
      const missing = [...own.values()].includes(null);
      const ahead = missing ? await rank({ upcoming: true }) : null;
      // Looking ahead only counts when it ranked a card the server's own ranking lacks.
      const upcoming = !!ahead && [...own].some(([id, r]) => !r && ahead.get(id));
      if (!cancelled) setResult({ ranks: upcoming ? ahead : own, upcoming });
    }, SHEET_ANIMATION_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [server, scenario, key]);
  return result;
}
