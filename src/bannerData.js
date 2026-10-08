// Banner files for the Timeline and the card page, only downloaded when one of them asks.
const BANNERS = {
  global: () => import('../data/global_banners.json'), // ours: seeded from GameTora, kept up from the news
  jp: () => import('../generated/jp_banners.json'),
};
// Global's future banners, predicted from JP's by `pnpm predict-gl` (ml/). Optional: the glob is
// empty when the file hasn't been generated, and the page goes without. (Banners announced in the
// news are real ones in data/, with `announced` + `news_url`.)
export const PREDICTED = {
  global: Object.values(import.meta.glob('../generated/predicted_global_banners.json', { import: 'default' })),
};

// A server's real banners alone (`name`: a banner file name, see src/servers.js).
export const loadRealBanners = (name) => BANNERS[name]().then((m) => m.default);

// A server's banners, real then predicted: { characters, cards }.
export async function loadBanners(name) {
  const [real, ...predicted] = await Promise.all([
    loadRealBanners(name),
    ...(PREDICTED[name] ?? []).map((load) => load()),
  ]);
  return predicted.reduce(
    (all, more) => ({ characters: [...all.characters, ...more.characters], cards: [...all.cards, ...more.cards] }),
    real
  );
}

// Where a banner stands, as its badge (.badge.<status>) and banners.status.<status> say.
export function bannerStatus(banner, now = Date.now()) {
  if (banner.confirmed) return 'confirmed';
  if (banner.predicted) return 'predicted';
  if (now < Date.parse(banner.start)) return 'upcoming';
  if (now > Date.parse(banner.end)) return 'ended';
  return 'live';
}
