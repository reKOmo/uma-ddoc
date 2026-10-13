// Pull advice from Luh's Umamusume Support Card Encyclopedia (`pnpm fetch-pull-guide`,
// see scripts/fetch-pull-guide.js). Optional: the glob is empty when the file hasn't been generated,
// and loadPullGuide() gives null.
import type { Banner } from '../shared/schemas/banner.ts';
import type { SourcesFile } from '../shared/schemas/sources.ts';
import type { Advice, NoBannerAdvice, PullGuide, Release } from '../shared/schemas/pullGuide.ts';
import sourcesJson from '../generated/sources.json' with { type: 'json' };

const sources: SourcesFile = sourcesJson;
const FILES = import.meta.glob('../generated/pull_guide.json', { import: 'default' });
const source = sources['pull_guide.json'];
const SHEET_URL = source && 'url' in source ? source.url : undefined;

let loaded: Promise<PullGuide | null> | undefined;
export function loadPullGuide(): Promise<PullGuide | null> {
  const [load] = Object.values(FILES);
  // TODO(ts): import.meta.glob's loader is typed unknown; test/schemas.test.ts checks the file against its schema.
  loaded ??= load ? (load() as Promise<PullGuide>) : Promise.resolve(null);
  return loaded;
}

// The card's next Global banner, real or predicted: the first featuring it that hasn't ended at `now`
// (ms), or null.
export function upcomingBanner(banners: Banner[], cardId: number, now: number): Banner | null {
  return (
    banners
      .filter(
        (banner) =>
          banner.end != null && Date.parse(banner.end) >= now && banner.featured.some((item) => item.id === cardId)
      )
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0] ?? null
  );
}

// An event / story / shop card (on no banner) runs about two weeks; one that started less than that ago
// may still be on.
const RUNNING_DAYS = 14;

// Whether a card on no banner is still to come (or running) on `today` ("YYYY-MM-DD"), counting the
// author's month estimates as ahead through their month.
export function releaseAhead(release: Release, today: string): boolean {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - RUNNING_DAYS * 86400000).toISOString().slice(0, 10);
  const date = 'date' in release ? release.date : null;
  const month = 'month' in release ? release.month : null;
  return date ? date >= since : month ? month >= today.slice(0, 7) : false;
}

// The guide's advice for a card now: for `banner` (its next one) if the guide covers it, else, for a card
// on no banner, while its release is ahead. Null if none.
export function currentAdvice(
  guide: PullGuide,
  cardId: number,
  banner: Banner | null,
  today: string
): Advice | NoBannerAdvice | null {
  if (banner) return guide.banners[banner.id]?.[cardId] ?? null;
  const entry = guide.noBanner[cardId];
  return entry && releaseAhead(entry.release, today) ? entry : null;
}

// The card's latest advice in the guide (by banner id, roughly by date), or null when the guide doesn't
// cover the card.
export function latestAdvice(guide: PullGuide, cardId: number): Advice | NoBannerAdvice | null {
  const onBanners = Object.values(guide.banners)
    .map((cards) => cards[cardId])
    .filter(Boolean);
  return guide.noBanner[cardId] ?? onBanners.at(-1) ?? null;
}

// The pills an advice can have, then 'none' for advice without one (or no advice).
export const VERDICTS = ['yes', 'no', 'free', 'whale', 'dolphin', 'none'] as const;
export type Verdict = (typeof VERDICTS)[number];

// An advice's pill without its "+"s ("whale++" → 'whale'), or 'none'.
export const verdictOf = (advice: Advice | NoBannerAdvice | null | undefined): Verdict =>
  // TODO(ts): the schema's regex (shared/schemas/pullGuide.ts) allows only the pills above; a type guard would prove it.
  (advice?.shouldPull?.match(/^[a-z]+/)?.[0] ?? 'none') as Verdict;

// The verdicts the guide gives a banner's cards (`cardIds`), each once: 'none' for a card it has no advice on (and a
// banner without known cards).
export const bannerVerdicts = (guide: PullGuide, bannerId: Banner['id'], cardIds: number[]): Set<Verdict> =>
  cardIds.length ? new Set(cardIds.map((id) => verdictOf(guide.banners[bannerId]?.[id]))) : new Set<Verdict>(['none']);

// A link to an entry's row in the sheet (its tab, at least), or to the sheet.
export function sheetLink(
  entry: { googleSheetsSrc?: Advice['googleSheetsSrc'] } | null | undefined,
  url: string | undefined = SHEET_URL
): string | undefined {
  const { gid, row } = entry?.googleSheetsSrc ?? { gid: null, row: null };
  if (gid == null) return url;
  return `${url}/edit#gid=${gid}${row ? `&range=B${row}` : ''}`;
}
