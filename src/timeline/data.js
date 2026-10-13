// What the Timeline shows for a server, and the banner files the card page reads too. Files are only downloaded when
// a page asks for them.
//
// loadTimeline(server) → { entries, marks }: every banner and event as an entry (./entries.js), each with its
//   counterpart on the other server (COUNTERPARTS), and the marks drawn over the calendar (MARKS)
// loadBanners(name) → a server's banners, real then predicted: { characters, cards } (`name`: a banner file name,
//   src/servers.js)
// loadEntries(server) → its banners and events as entries alone (no marks or counterparts: the card page)
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
    const [global, predicted] = await globalBanners();
    const progress = globalProgress({ global, predicted, jp });
    if (!progress) return [];
    const { estimate, from, to, toKnown } = progress;
    return [{ key: 'global', at: estimate, window: { from, to, open: !toKnown } }];
  },
};

// Global's banners, real and predicted (JP's marks and counterparts both read them; loaded once a page).
let globalBannersPromise = null;
const globalBanners = () =>
  (globalBannersPromise ??= Promise.all([loadRealBanners('global'), loadPredictedBanners('global')]));

// Global ↔ JP event pairs, by `pnpm predict-gl` (ml/events.py: [{ gl, jp, … }], top-level events). Optional like the
// predictions: without it, real events have no counterpart.
const PAIRS = Object.values(import.meta.glob('../../generated/event_pairs.json', { import: 'default' }));
const loadPairs = async () => (PAIRS[0] ? (await PAIRS[0]()).pairs : []);
const bannerIds = (...files) =>
  new Set(files.flatMap((f) => (f ? [...f.characters, ...f.cards] : [])).map((b) => String(b.id)));

// The same banner or event on the other server: own id → the other's id. Banners share their gacha id across
// servers; events are paired (PAIRS), and a predicted Global event is a JP one (`jp_id`, parts too: on JP, its
// predicted Global copy is 'jp-<id>').
const COUNTERPARTS = {
  gl: async (banners, events) => {
    const [jp, pairs] = await Promise.all([loadRealBanners('jp'), loadPairs()]);
    const jpBanners = bannerIds(jp);
    const map = new Map();
    for (const id of bannerIds(banners)) if (jpBanners.has(id)) map.set(id, id);
    for (const pair of pairs) map.set(pair.gl, pair.jp);
    for (const event of events) if (event.jp_id) map.set(event.id, event.jp_id);
    return map;
  },
  jp: async (banners) => {
    const [[global, predicted], pairs, predictedEvents] = await Promise.all([
      globalBanners(),
      loadPairs(),
      PREDICTED_EVENTS.global[0]?.() ?? null,
    ]);
    const globalIds = bannerIds(global, predicted);
    const map = new Map();
    for (const id of bannerIds(banners)) if (globalIds.has(id)) map.set(id, id);
    for (const event of predictedEvents?.events ?? []) map.set(event.jp_id, event.id);
    for (const pair of pairs) map.set(pair.jp, pair.gl); // Global's own event over a prediction of it
    return map;
  },
};
const OTHER = { gl: 'jp', jp: 'gl' };

const loadFiles = (server) => {
  const name = SERVERS[server].banners;
  return Promise.all([loadBanners(name), loadEvents(name)]);
};
const toEntries = (banners, events, now) => [
  ...bannerEntries(banners, { now }),
  ...eventEntries(events, { cards, now }),
];

export async function loadEntries(server, now = Date.now()) {
  const [banners, events] = await loadFiles(server);
  return toEntries(banners, events, now);
}

export async function loadTimeline(server, now = Date.now()) {
  const [banners, events] = await loadFiles(server);
  const [marks, counterparts] = await Promise.all([
    MARKS[server]?.(banners) ?? [],
    COUNTERPARTS[server](banners, events),
  ]);
  const entries = toEntries(banners, events, now);
  for (const entry of entries) {
    const id = counterparts.get(String(entry.id));
    if (id) entry.counterpart = { server: OTHER[server], id };
  }
  return { entries, marks };
}
