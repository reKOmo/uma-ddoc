// Banner files load only when a page asks for them.
import { cards } from '../../tierlist/cards.ts';
import { SERVERS } from '../servers.ts';
import { type ArtBannerFile, withArt } from '../gametora.ts';
import { withPredicted } from './events.ts';
import { type Counterpart, type Entry, bannerEntries, eventEntries, linkFreeScouts } from './entries.ts';
import { globalProgress } from './globalProgress.ts';
import type { BannerFile } from '../../shared/schemas/banner.ts';
import type {
  EventPairsFile,
  EventsFile,
  GameEvent,
  PredictedEvent,
  PredictedEventsFile,
} from '../../shared/schemas/event.ts';

type Server = keyof typeof SERVERS;
type BannerName = 'global' | 'jp';
type Banners = Pick<ArtBannerFile, 'characters' | 'cards'>;
export type Mark = { key: string; at: number; window: { from: number; to: number; open: boolean } | null };

const BANNERS = {
  global: () => import('../../data/global_banners.json'), // ours: seeded from GameTora, kept up from the news
  jp: () => import('../../data/jp_banners.json'), // ours: GameTora's history + the JP news (scripts/lib/jp-banners.js)
};
// Optional: an empty glob when the file hasn't been generated.
const PREDICTED: Partial<Record<BannerName, (() => Promise<BannerFile>)[]>> = {
  global: Object.values(
    import.meta.glob<BannerFile>('../../generated/predicted_global_banners.json', { import: 'default' })
  ),
};

// The files store no GameTora URLs: withArt() adds the art.
export const loadRealBanners = (name: BannerName): Promise<ArtBannerFile> =>
  // TODO(ts): a JSON import's type is wider than the schema (strings for enums); test/schemas.test.ts checks the file
  BANNERS[name]().then((m) => withArt(m.default as BannerFile, name, cards));

const loadPredictedBanners = (name: BannerName): Promise<ArtBannerFile> | null =>
  PREDICTED[name]?.[0]?.().then((file) => withArt(file, 'jp', cards)) ?? null;

export async function loadBanners(name: BannerName): Promise<Banners> {
  const [real, predicted] = await Promise.all([loadRealBanners(name), loadPredictedBanners(name)]);
  if (!predicted) return real;
  // A banner the news announced after the last predict-gl run is in both: the real one wins.
  const known = bannerIds(real);
  const unknown = <T extends { id: string | number }>(list: T[]): T[] => list.filter((b) => !known.has(String(b.id)));
  return {
    characters: [...real.characters, ...unknown(predicted.characters)],
    cards: [...real.cards, ...unknown(predicted.cards)],
  };
}

const EVENTS = {
  global: () => import('../../data/global_events.json'),
  jp: () => import('../../data/jp_events.json'),
};
// Optional like the predicted banners.
const PREDICTED_EVENTS: Partial<Record<BannerName, (() => Promise<PredictedEventsFile>)[]>> = {
  global: Object.values(
    import.meta.glob<PredictedEventsFile>('../../generated/predicted_global_events.json', { import: 'default' })
  ),
};
export async function loadEvents(name: BannerName): Promise<EventsFile> {
  const [real, predicted] = await Promise.all([
    // TODO(ts): a JSON import's type is wider than the schema (strings for enums); test/schemas.test.ts checks the file
    EVENTS[name]().then((m) => m.default as EventsFile),
    Promise.all((PREDICTED_EVENTS[name] ?? []).map((load) => load())),
  ]);
  return predicted.reduce((all, more) => withPredicted(all, more.events), real);
}

// `open`: the window's end is only predicted.
// i18n: timeline.mark.<key>.button / .title / .line.
const MARKS: Partial<Record<Server, (jp: Banners) => Promise<Mark[]>>> = {
  jp: async (jp) => {
    const [global, predicted] = await globalBanners();
    const progress = globalProgress({ global, predicted, jp });
    if (!progress) return [];
    const { estimate, from, to, toKnown } = progress;
    return [{ key: 'global', at: estimate, window: { from, to, open: !toKnown } }];
  },
};

// Global's banners, real and predicted (JP's marks and counterparts both read them; loaded once a page).
let globalBannersPromise: Promise<[ArtBannerFile, ArtBannerFile | null]> | null = null;
const globalBanners = (): Promise<[ArtBannerFile, ArtBannerFile | null]> =>
  (globalBannersPromise ??= Promise.all([loadRealBanners('global'), loadPredictedBanners('global')]));

// Optional like the predictions: without it, real events have no counterpart.
const PAIRS = Object.values(
  import.meta.glob<EventPairsFile>('../../generated/event_pairs.json', { import: 'default' })
);
const loadPairs = async (): Promise<EventPairsFile['pairs']> => (PAIRS[0] ? (await PAIRS[0]()).pairs : []);
const bannerIds = (...files: (Banners | null | undefined)[]): Set<string> =>
  new Set(files.flatMap((f) => (f ? [...f.characters, ...f.cards] : [])).map((b) => String(b.id)));

// The same banner or event on the other server: own id → the other's id. Banners share their gacha id across
// servers; events are paired (PAIRS), and a predicted Global event is a JP one (`jp_id`, parts too: on JP, its
// predicted Global copy is 'jp-<id>').
type Counterparts = (banners: Banners, events: (GameEvent | PredictedEvent)[]) => Promise<Map<string, string>>;
const COUNTERPARTS: Record<Server, Counterparts> = {
  gl: async (banners, events) => {
    const [jp, pairs] = await Promise.all([loadRealBanners('jp'), loadPairs()]);
    const jpBanners = bannerIds(jp);
    const map = new Map<string, string>();
    for (const id of bannerIds(banners)) if (jpBanners.has(id)) map.set(id, id);
    for (const pair of pairs) map.set(pair.gl, pair.jp);
    for (const event of events) if ('jp_id' in event && event.jp_id) map.set(event.id, event.jp_id);
    return map;
  },
  jp: async (banners) => {
    const [[global, predicted], pairs, predictedEvents] = await Promise.all([
      globalBanners(),
      loadPairs(),
      PREDICTED_EVENTS.global?.[0]?.() ?? null,
    ]);
    const globalIds = bannerIds(global, predicted);
    const map = new Map<string, string>();
    for (const id of bannerIds(banners)) if (globalIds.has(id)) map.set(id, id);
    for (const event of predictedEvents?.events ?? []) map.set(event.jp_id, event.id);
    for (const pair of pairs) map.set(pair.jp, pair.gl); // Global's own event over a prediction of it
    return map;
  },
};
const OTHER: Record<Server, Server> = { gl: 'jp', jp: 'gl' };

const loadFiles = (server: Server): Promise<[Banners, EventsFile]> => {
  // TODO(ts): servers.ts is still untyped, so its banners are plain strings (the names in BannerName)
  const name = SERVERS[server].banners as BannerName;
  return Promise.all([loadBanners(name), loadEvents(name)]);
};
const toEntries = (banners: Banners, events: EventsFile, now: number): Entry[] =>
  linkFreeScouts([...bannerEntries(banners, { now }), ...eventEntries(events, { cards, now })]);

export async function loadEntries(server: Server, now = Date.now()): Promise<Entry[]> {
  const [banners, events] = await loadFiles(server);
  return toEntries(banners, events, now);
}

// The calendar draws from `entries`; `others()` loads what needs the other server's files (large, and needed only
// by the marks and the sheet's link to the other server), after it's drawn. `counterparts`: by entry id.
export type Others = { marks: Mark[]; counterparts: Map<string, Counterpart> };
export async function loadTimeline(
  server: Server,
  now = Date.now()
): Promise<{ entries: Entry[]; others: () => Promise<Others> }> {
  const [banners, events] = await loadFiles(server);
  return {
    entries: toEntries(banners, events, now),
    others: async () => {
      const [marks, ids] = await Promise.all([MARKS[server]?.(banners) ?? [], COUNTERPARTS[server](banners, events)]);
      const counterparts = new Map([...ids].map(([own, id]) => [own, { server: OTHER[server], id }]));
      return { marks, counterparts };
    },
  };
}
