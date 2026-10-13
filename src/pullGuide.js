// Pull advice per card from Luh's Umamusume Support Card Encyclopedia (`pnpm fetch-pull-guide`,
// see scripts/fetch-pull-guide.js). Optional: the glob is empty when the file hasn't been generated,
// and loadPullGuide() gives null.
import sources from '../generated/sources.json';

const FILES = import.meta.glob('../generated/pull_guide.json', { import: 'default' });
const SHEET_URL = sources['pull_guide.json']?.url;

let loaded;
export function loadPullGuide() {
  const [load] = Object.values(FILES);
  loaded ??= load ? load() : Promise.resolve(null);
  return loaded;
}

// The card's next Global banner, real or predicted: the first featuring it that hasn't ended at `now`
// (ms), or null.
export function upcomingBanner(banners, cardId, now) {
  return (
    banners
      .filter((banner) => Date.parse(banner.end) >= now && banner.featured.some((item) => item.id === cardId))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0] ?? null
  );
}

// An event / story / shop card (on no banner) runs about two weeks; one that started less than that ago
// may still be on.
const RUNNING_DAYS = 14;

// Whether a card on no banner is still to come (or running) on `today` ("YYYY-MM-DD"), counting the
// author's month estimates as ahead through their month.
export function releaseAhead({ date, month }, today) {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - RUNNING_DAYS * 86400000).toISOString().slice(0, 10);
  return date ? date >= since : month ? month >= today.slice(0, 7) : false;
}

// The guide's advice for a card now: for `banner` (its next one) if the guide covers it, else, for a card
// on no banner, while its release is ahead. Null if none.
export function currentAdvice(guide, cardId, banner, today) {
  if (banner) return guide.banners[banner.id]?.[cardId] ?? null;
  const entry = guide.noBanner[cardId];
  return entry && releaseAhead(entry.release, today) ? entry : null;
}

// The card's latest advice in the guide (by banner id, roughly by date), or null when the guide doesn't
// cover the card.
export function latestAdvice(guide, cardId) {
  const onBanners = Object.values(guide.banners)
    .map((cards) => cards[cardId])
    .filter(Boolean);
  return guide.noBanner[cardId] ?? onBanners.at(-1) ?? null;
}

// The pills an advice can have, then 'none' for advice without one (or no advice).
export const VERDICTS = ['yes', 'no', 'free', 'whale', 'dolphin', 'none'];

// An advice's pill without its "+"s ("whale++" → 'whale'), or 'none'.
export const verdictOf = (advice) => advice?.shouldPull?.match(/^[a-z]+/)[0] ?? 'none';

// The verdicts the guide gives a banner's cards (`cardIds`), each once: 'none' for a card it has no advice on (and a
// banner without known cards).
export const bannerVerdicts = (guide, bannerId, cardIds) =>
  cardIds.length ? new Set(cardIds.map((id) => verdictOf(guide.banners[bannerId]?.[id]))) : new Set(['none']);

// A link to an entry's row in the sheet (its tab, at least), or to the sheet.
export function sheetLink(entry, url = SHEET_URL) {
  const { gid, row } = entry?.googleSheetsSrc ?? {};
  if (gid == null) return url;
  return `${url}/edit#gid=${gid}${row ? `&range=B${row}` : ''}`;
}
