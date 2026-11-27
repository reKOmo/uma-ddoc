import { rankByUsefulness } from '../../../tierlist/index.ts';
import type { Stat } from '../../../tierlist/index.ts';
import type { Server } from '../../../tierlist/cards.ts';
import { useRanking } from '../../hooks/useRanking.ts';

// The ranking with the server's upcoming cards in it, computed after the page has painted.
export function useUpcomingRanking(server: Server, scenario: string, stat: Stat | undefined, enabled: boolean) {
  return useRanking(
    async () => (enabled && stat ? rankByUsefulness(server, scenario, stat, { upcoming: true }) : null),
    [server, scenario, stat, enabled]
  );
}
