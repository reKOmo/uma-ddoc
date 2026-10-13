// @ts-nocheck
// Predicted Global release dates of JP's cards (`pnpm predict-gl`, see ml/). Optional:
// the glob is empty when the file hasn't been generated, and loadPredictions() gives null.
const FILES = import.meta.glob('../generated/predicted_gl_releases.json', { import: 'default' });

let loaded: Promise<unknown> | undefined;
export function loadPredictions() {
  const [load] = Object.values(FILES);
  loaded ??= load ? load() : Promise.resolve(null);
  return loaded;
}
