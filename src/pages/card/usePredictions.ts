import type { Server } from '../../../tierlist/cards.ts';
import type { PredictionsFile } from '../../../shared/schemas/predictions.ts';
import { loadPredictions } from '../../lib/predictions.ts';
import { useAsync } from '../../hooks/useAsync.ts';

// The server's predicted release dates (only Global has them): undefined while loading, null without any.
export function usePredictions(server: Server): PredictionsFile | null | undefined {
  const { data, pending } = useAsync(() => (server === 'gl' ? loadPredictions() : Promise.resolve(null)), [server]);
  return pending ? undefined : data;
}
