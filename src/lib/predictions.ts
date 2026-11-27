// Optional: null until `pnpm predict-gl` has written the file.
import type { PredictionsFile } from '../../shared/schemas/predictions.ts';
import { optionalJson } from './optional.ts';

export const loadPredictions = optionalJson(
  import.meta.glob<PredictionsFile>('../../generated/predicted_gl_releases.json', { import: 'default' })
);
