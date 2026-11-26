// Computed once the sheet has slid in: a ranking blocks the page for a few hundred ms.
// The server's own ranking, unless it lacks one of these cards (an announced or predicted Global banner's): then the
// one that also ranks JP's upcoming cards, as the card page's dashed future does. A card no ranking has (JP's newest,
// without stats yet) is null.
import { type Stat, rankByUsefulness } from '../../tierlist/index.ts';
import { STAT_OF_TYPE, cardRanks } from '../lib/tiers.ts';
import { cards } from '../../tierlist/cards.ts';
import { SHEET_ANIMATION_MS } from '../ui/Sheet.tsx';
import type { CardsFile } from '../../shared/schemas/card.ts';
import type { SERVERS } from '../lib/servers.ts';
import { useRanking } from '../hooks/useRanking.ts';

export type CardRank = { tier: number; position: number; stat: Stat };
export type RankResult = { ranks: Map<number, CardRank | null>; upcoming: boolean };

// TODO(ts): cards.json's type (a JSON import) is wider than the schema (strings for enums); test/schemas.test.ts checks it
const CARDS = cards as CardsFile;

// A card's stat (from its type), known before any ranking is; undefined for a card the data lacks.
export const cardStat = (id: number): Stat | undefined => STAT_OF_TYPE[CARDS[id]?.type];

export function useRankings(server: keyof typeof SERVERS, scenario: string, ids: number[]): RankResult | null {
  return useRanking(
    async () => {
      const wanted = ids.filter((id) => cardStat(id));
      // TODO(ts): `wanted` holds only cards with a stat
      const statOf = (id: number): Stat => cardStat(id) as Stat;
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
      const own = await rank();
      const missing = [...own.values()].includes(null);
      const ahead = missing ? await rank({ upcoming: true }) : null;
      // Looking ahead only counts when it ranked a card the server's own ranking lacks.
      const upcoming = !!ahead && [...own].some(([id, r]) => !r && ahead.get(id));
      return { ranks: upcoming && ahead ? ahead : own, upcoming };
    },
    // (`ids` is a new array each render: its contents are what count)
    [server, scenario, ids.join()],
    SHEET_ANIMATION_MS
  );
}
