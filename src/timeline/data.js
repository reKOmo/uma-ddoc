// What the Timeline shows for a server, and the banner files the card page reads too. Files are only downloaded when
// a page asks for them.
//
// loadTimeline(server) → { entries, marks }: every banner and event as an entry (./entries.js), and the marks
//   drawn over the calendar (MARKS)
// loadBanners(name) → a server's banners, real then predicted: { characters, cards } (`name`: a banner file name,
//   src/servers.js)
// loadRealBanners(name), loadEvents(name)

import { cards } from '../../tierlist/cards.js';
import { SERVERS } from '../servers.js';
import { withArt } from '../gametora.js';
import { withPredicted } from './events.js';
import { bannerEntries, eventEntries } from './entries.js';
import { globalProgress } from './globalProgress.js';

const BANNERS = {
  global: () => import('../../data/global_banners.json'), // ours: seeded from GameTora, kept up from the news
  jp: () => import('../../data/jp_banners.json'), // ours: GameTora's history + the JP news (scripts/lib/jp-banners.js)
};
// Global's future banners, predicted from JP's by `pnpm predict-gl` (ml/). Optional: the glob is
// empty when the file hasn't been generated, and the page goes without. (Banners announced in the
// news are real ones in data/, with `announced` + `news_url`.)
const PREDICTED = {
  global: Object.values(import.meta.glob('../../generated/predicted_global_banners.json', { import: 'default' })),
};

// A server's real banners alone, with their art and icons (src/gametora.js: the files store no GameTora URLs).
export const loadRealBanners = (name) => BANNERS[name]().then((m) => withArt(m.default, name, cards));

// A server's predicted banners alone (JP's banners at Global's dates: JP's art), or null without the file.
const loadPredictedBanners = (name) => PREDICTED[name]?.[0]?.().then((file) => withArt(file, 'jp', cards)) ?? null;

export async function loadBanners(name) {
  const [real, predicted] = await Promise.all([loadRealBanners(name), loadPredictedBanners(name)]);
  if (!predicted) return real;
  return {
    characters: [...real.characters, ...predicted.characters],
    cards: [...real.cards, ...predicted.cards],
  };
}

// Each server's in-game events (scripts/lib/events.js: built from the news by `update-global` / `update-jp`).
const EVENTS = {
  global: () => import('../../data/global_events.json'),
  jp: () => import('../../data/jp_events.json'),
};
// Global's future events, predicted from JP's by `pnpm predict-gl` (ml/): { source, events }. Optional like the
// predicted banners: without the file, Global has its real events alone.
const PREDICTED_EVENTS = {
  global: Object.values(import.meta.glob('../../generated/predicted_global_events.json', { import: 'default' })),
};
// A server's events, real then predicted (see withPredicted()).
export async function loadEvents(name) {
  const [real, ...predicted] = await Promise.all([
    EVENTS[name]().then((m) => m.default),
    ...(PREDICTED_EVENTS[name] ?? []).map((load) => load()),
  ]);
  return predicted.reduce((all, more) => withPredicted(all, more.events), real);
}

// Marks drawn over a server's calendar, each with a toolbar button that scrolls to it:
//   { key, at (ms), window: { from, to, open } | null }, `open`: the window's end is only predicted.
// i18n: timeline.mark.<key>.button / .title / .line.
// JP: where Global is in JP's history (./globalProgress.js), from Global's banners, real and predicted.
const MARKS = {
  jp: async (jp) => {
    const [global, predicted] = await Promise.all([loadRealBanners('global'), loadPredictedBanners('global')]);
    const progress = globalProgress({ global, predicted, jp });
    if (!progress) return [];
    const { estimate, from, to, toKnown } = progress;
    return [{ key: 'global', at: estimate, window: { from, to, open: !toKnown } }];
  },
};

export async function loadTimeline(server, now = Date.now()) {
  const name = SERVERS[server].banners;
  const [banners, events] = await Promise.all([loadBanners(name), loadEvents(name)]);
  const marks = (await MARKS[server]?.(banners)) ?? [];
  return {
    entries: [...bannerEntries(banners, { now }), ...eventEntries(events, { cards, now })],
    marks,
  };
}
