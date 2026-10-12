import { withPredicted } from './eventStrip.js';
import { cards } from '../tierlist/cards.js';
import { withArt } from './gametora.js';

// Banner (and event) files for the Timeline and the card page, only downloaded when one of them asks.
const BANNERS = {
  global: () => import('../data/global_banners.json'), // ours: seeded from GameTora, kept up from the news
  jp: () => import('../data/jp_banners.json'), // ours: GameTora's history + the JP news (scripts/lib/jp-banners.js)
};
// Global's future banners, predicted from JP's by `pnpm predict-gl` (ml/). Optional: the glob is
// empty when the file hasn't been generated, and the page goes without. (Banners announced in the
// news are real ones in data/, with `announced` + `news_url`.)
export const PREDICTED = {
  global: Object.values(import.meta.glob('../generated/predicted_global_banners.json', { import: 'default' })),
};

// A server's real banners alone (`name`: a banner file name, see src/servers.js), with their art and icons
// (src/gametora.js: the files store no GameTora URLs).
export const loadRealBanners = (name) => BANNERS[name]().then((m) => withArt(m.default, name, cards));

// A server's banners, real then predicted: { characters, cards }.
export async function loadBanners(name) {
  const [real, ...predicted] = await Promise.all([
    loadRealBanners(name),
    // JP's banners at Global's dates: JP's art.
    ...(PREDICTED[name] ?? []).map((load) => load().then((file) => withArt(file, 'jp', cards))),
  ]);
  return predicted.reduce(
    (all, more) => ({ characters: [...all.characters, ...more.characters], cards: [...all.cards, ...more.cards] }),
    real
  );
}

// Each server's in-game events (scripts/lib/events.js: built from the news by `update-global` / `update-jp`), only
// downloaded when the Timeline shows that server.
const EVENTS = {
  global: () => import('../data/global_events.json'),
  jp: () => import('../data/jp_events.json'),
};
// Global's future events, predicted from JP's by `pnpm predict-gl` (ml/): { source, events }. Optional like the
// predicted banners: without the file, Global has its real events alone.
const PREDICTED_EVENTS = {
  global: Object.values(import.meta.glob('../generated/predicted_global_events.json', { import: 'default' })),
};
// A server's events, real then predicted (see withPredicted()).
export async function loadEvents(name) {
  const [real, ...predicted] = await Promise.all([
    EVENTS[name]().then((m) => m.default),
    ...(PREDICTED_EVENTS[name] ?? []).map((load) => load()),
  ]);
  return predicted.reduce((all, more) => withPredicted(all, more.events), real);
}

// Where a banner stands, as its badge (.badge.<status>) and banners.status.<status> say.
export function bannerStatus(banner, now = Date.now()) {
  if (banner.confirmed) return 'confirmed';
  if (banner.predicted) return 'predicted';
  if (now < Date.parse(banner.start)) return 'upcoming';
  if (now > Date.parse(banner.end)) return 'ended';
  return 'live';
}
