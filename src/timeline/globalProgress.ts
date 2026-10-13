// Where Global is in JP's history, for JP's banner calendar. Global reruns JP's banners under JP's
// ids, so each Global banner pairs a Global start with a JP start. Between the last pair that has
// started and the next one, Global is somewhere in that stretch of JP's history: that's the window,
// and the estimate is linear in time between the two.
//
// globalProgress({ global, jp, predicted, now }) →
//   { estimate, from, to, toKnown } (JP times, ms) or null when no Global banner has started
//   global     data/global_banners.json            jp  data/jp_banners.json (paid scouts and our own re-run entries,
//              which Global never runs, are left out)
//   predicted  generated/predicted_global_banners.json (optional): future banners with jp_start,
//              `confirmed` when their dates are known
// `toKnown` is false when the window's end comes from a prediction (or there is no next banner,
// in which case the window is the current JP banner itself).
import type { Banner, BannerFile } from '../../shared/schemas/banner.ts';

// The banner lists a calendar reads (a file, or the ones that have them).
type Banners = Pick<BannerFile, 'characters' | 'cards'>;

export type GlobalProgress = { estimate: number; from: number; to: number; toKnown: boolean };

const all = (banners: Partial<Banners> | undefined): Banner[] => [
  ...(banners?.characters ?? []),
  ...(banners?.cards ?? []),
];
// JP banners Global could run: not paid, not one of our "<id>-rerun" entries.
const regular = (banners: Partial<Banners> | undefined): Banner[] =>
  all(banners).filter((b) => !b.paid && typeof b.id === 'number');

export function globalProgress({
  global,
  jp,
  predicted,
  now = Date.now(),
}: {
  global: Partial<Banners> | undefined;
  jp: Partial<Banners> | undefined;
  predicted?: Partial<Banners>;
  now?: number;
}): GlobalProgress | null {
  const jpBanners = new Map(regular(jp).map((b) => [b.id, b] as const));
  const pairs = [
    ...all(global).flatMap((b) => {
      const jpStart = jpBanners.get(b.id);
      return jpStart ? [{ gl: Date.parse(b.start), jp: Date.parse(jpStart.start), known: true }] : [];
    }),
    ...all(predicted).flatMap((b) =>
      b.jp_start ? [{ gl: Date.parse(b.start), jp: Date.parse(b.jp_start), known: !b.predicted || !!b.confirmed }] : []
    ),
  ].sort((a, b) => a.gl - b.gl || a.jp - b.jp);

  const started = pairs.filter((p) => p.gl <= now);
  if (!started.length) return null;
  // The furthest JP point among banners that have started (a rerun of an old JP banner mustn't pull it back).
  const prev = started.reduce((best, p) => (p.jp > best.jp || (p.jp === best.jp && p.gl > best.gl) ? p : best));
  const next = pairs.find((p) => p.gl > now && p.jp > prev.jp);

  if (!next) {
    // No later banner known at all: the window is the JP banner Global is running.
    const current = regular(jp).find((b) => Date.parse(b.start) === prev.jp);
    const to = current ? (current.end ? Date.parse(current.end) : Number.NaN) : prev.jp;
    return { estimate: prev.jp, from: prev.jp, to, toKnown: false };
  }
  const progress = Math.min(1, Math.max(0, (now - prev.gl) / (next.gl - prev.gl)));
  return { estimate: prev.jp + progress * (next.jp - prev.jp), from: prev.jp, to: next.jp, toKnown: next.known };
}
