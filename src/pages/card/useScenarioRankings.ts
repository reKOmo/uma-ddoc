import { rankByUsefulness, scenarioOptions } from '../../../tierlist/index.ts';
import type { Ranked, Stat } from '../../../tierlist/index.ts';
import type { Server } from '../../../tierlist/cards.ts';
import { useRanking } from '../../hooks/useRanking.ts';

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
