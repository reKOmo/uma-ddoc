// Predicted Global release dates of JP's cards (`pnpm predict-gl`, see ml/). Optional:
// the glob is empty when the file hasn't been generated, and loadPredictions() gives null.
import type { PredictionsFile } from '../shared/schemas/predictions.ts';

const FILES = import.meta.glob('../generated/predicted_gl_releases.json', { import: 'default' });

let loaded: Promise<PredictionsFile | null> | undefined;
export function loadPredictions(): Promise<PredictionsFile | null> {
  const [load] = Object.values(FILES);
  // TODO(ts): import.meta.glob's loader is typed unknown; test/schemas.test.ts checks the file against its schema.
  loaded ??= load ? (load() as Promise<PredictionsFile>) : Promise.resolve(null);
  return loaded;
}
