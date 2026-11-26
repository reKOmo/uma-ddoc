import type { Advice, NoBannerAdvice, PullGuide } from '../../../shared/schemas/pullGuide.ts';
import type { ArtBanner } from '../../lib/gametora.ts';
import { currentAdvice, loadPullGuide, upcomingBanner } from '../../lib/pullGuide.ts';
import type { Server } from '../../../tierlist/cards.ts';
import { loadBanners } from '../../timeline/data.ts';
import { useAsync } from '../../hooks/useAsync.ts';

export type UpcomingAdvice = {
  guide: PullGuide | null;
  // The card's next Global banner, real or predicted (or the one running), or null.
  banner: ArtBanner | null;
  // The guide's advice for that banner (or, on no banner, while its release is ahead).
  entry: Advice | NoBannerAdvice | null;
};

// Global only: the guide advises on Global's banners (null elsewhere, nothing loaded). Undefined while loading.
export function useUpcomingAdvice(cardId: number, server: Server): UpcomingAdvice | null | undefined {
  const gl = server === 'gl';
  const guide = useAsync(() => (gl ? loadPullGuide() : Promise.resolve(null)), [gl]);
  const banners = useAsync(() => (gl ? loadBanners('global').then((b) => b.cards) : Promise.resolve(null)), [gl]);
  if (guide.pending || banners.pending) return undefined;
  if (!gl) return null;
  const now = Date.now();
  const upcoming = banners.data ? upcomingBanner(banners.data, cardId, now) : null;
  const banner = (upcoming && banners.data?.find((b) => b.id === upcoming.id)) || null;
  const data = guide.data ?? null;
  return {
    guide: data,
    banner,
    entry: data && currentAdvice(data, cardId, upcoming, new Date(now).toISOString().slice(0, 10)),
  };
}
