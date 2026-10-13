import { useEffect, useState } from 'react';
import { type Stat, rankByUsefulness } from '../../tierlist/index.ts';
import { STAT_OF_TYPE, cardRanks } from '../tiers.ts';
import { cards } from '../../tierlist/cards.ts';
import { SHEET_ANIMATION_MS } from '../Sheet.tsx';
import type { CardsFile } from '../../shared/schemas/card.ts';
import type { SERVERS } from '../servers.ts';

// Where these support cards (ids) rank at MLB in the server's tier list, computed once the sheet has slid in (a
// ranking blocks the page for a few hundred ms):
// { ranks: id → { tier, position, stat } | null, upcoming }, null while computing. The server's own ranking unless
// it lacks one of them (a card the server doesn't have yet: an announced or predicted banner on Global); then
// the one that also ranks JP's cards it doesn't have (`upcoming`: the card page's dashed future does the same), the
// server's own cards scored as before. A card no ranking has (JP's newest, without stats yet) is null.
// A card's rank at MLB: its tier (0 is S), its position in the ranking, the stat tab it ranks in.
export type CardRank = { tier: number; position: number; stat: string };
export type RankResult = { ranks: Map<number, CardRank | null>; upcoming: boolean };

// TODO(ts): cards.json's type (a JSON import) is wider than the schema (strings for enums); test/schemas.test.ts checks it
const CARDS = cards as CardsFile;

export function useRankings(server: keyof typeof SERVERS, scenario: string, ids: number[]): RankResult | null {
  const [result, setResult] = useState<RankResult | null>(null);
  const key = ids.join();
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    const wanted = key
      ? key
          .split(',')
          .map(Number)
          .filter((id) => STAT_OF_TYPE[CARDS[id]?.type])
      : [];
    const statOf = (id: number): Stat => STAT_OF_TYPE[CARDS[id].type];
    const stats = [...new Set(wanted.map(statOf))];
    const rank = async (options?: { upcoming: boolean }): Promise<Map<number, CardRank | null>> => {
      const rankings = await Promise.all(stats.map((stat) => rankByUsefulness(server, scenario, stat, options)));
      const byStat = Object.fromEntries(stats.map((stat, i) => [stat, cardRanks(rankings[i])]));
      return new Map(
        wanted.map((id): [number, CardRank | null] => {
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
      if (!cancelled) setResult({ ranks: upcoming && ahead ? ahead : own, upcoming });
    }, SHEET_ANIMATION_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [server, scenario, key]);
  return result;
}
