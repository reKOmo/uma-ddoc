import type { Server } from '../../../tierlist/cards.ts';
import type { Entry } from '../../timeline/entries.ts';
import { cardOrigins } from '../../lib/cardOrigins.ts';
import type { Origin } from '../../lib/cardOrigins.ts';
import { loadEntries } from '../../timeline/data.ts';
import { useAsync } from '../../hooks/useAsync.ts';
import { useLanguage } from '../../hooks/useLanguage.ts';

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
