// Global reruns JP's banners under JP's ids, so each Global banner pairs a Global start with a JP start. Global is
// somewhere between the last pair that has started and the next, estimated linearly in time. `toKnown` is false when
// the window's end is predicted.
import type { Banner, BannerFile } from '../../shared/schemas/banner.ts';

type Banners = Pick<BannerFile, 'characters' | 'cards'>;

export type GlobalProgress = { estimate: number; from: number; to: number; toKnown: boolean };

const all = (banners: Partial<Banners> | null | undefined): Banner[] => [
  ...(banners?.characters ?? []),
  ...(banners?.cards ?? []),
];
const regular = (banners: Partial<Banners> | null | undefined): Banner[] =>
  all(banners).filter((b) => !b.paid && typeof b.id === 'number');

export function globalProgress({
  global,
  jp,
  predicted,
  now = Date.now(),
}: {
  global: Partial<Banners> | undefined;
  jp: Partial<Banners> | undefined;
  predicted?: Partial<Banners> | null;
  now?: number;
}): GlobalProgress | null {
  const jpBanners = new Map(regular(jp).map((b) => [b.id, b] as const));
  const pairs = [
    ...all(global).flatMap((b) => {
      const jpStart = jpBanners.get(b.id);
      return jpStart ? [{ gl: Date.parse(b.start.date), jp: Date.parse(jpStart.start.date), known: true }] : [];
    }),
    ...all(predicted).flatMap((b) =>
      b.jp_start
        ? [{ gl: Date.parse(b.start.date), jp: Date.parse(b.jp_start), known: b.start.status !== 'predicted' }]
        : []
    ),
  ].sort((a, b) => a.gl - b.gl || a.jp - b.jp);

  const started = pairs.filter((p) => p.gl <= now);
  if (!started.length) return null;
  // The furthest JP point among banners that have started (a rerun of an old JP banner mustn't pull it back).
  const prev = started.reduce((best, p) => (p.jp > best.jp || (p.jp === best.jp && p.gl > best.gl) ? p : best));
  const next = pairs.find((p) => p.gl > now && p.jp > prev.jp);

  if (!next) {
    // No later banner known at all: the window is the JP banner Global is running.
    const current = regular(jp).find((b) => Date.parse(b.start.date) === prev.jp);
    const to = current ? (current.end ? Date.parse(current.end.date) : Number.NaN) : prev.jp;
    return { estimate: prev.jp, from: prev.jp, to, toKnown: false };
  }
  const progress = Math.min(1, Math.max(0, (now - prev.gl) / (next.gl - prev.gl)));
  return { estimate: prev.jp + progress * (next.jp - prev.jp), from: prev.jp, to: next.jp, toKnown: next.known };
}
