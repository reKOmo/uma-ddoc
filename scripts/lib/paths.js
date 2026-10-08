// Where things live. generated/ is build-time output, gitignored and rebuilt by every deploy;
// data/ is ours and committed (Global's banners + card releases, known dates, the official news),
// since nothing can regenerate it.

export const ROOT = new URL('../../', import.meta.url).pathname;
export const GENERATED_DIR = `${ROOT}generated/`;
export const DATA_DIR = `${ROOT}data/`;
export const NEWS_DIR = `${DATA_DIR}news/`;
