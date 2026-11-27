// What Global's and JP's banner files (banners/global.ts, banners/jp.ts) share.

import { writeFileSync } from 'node:fs';
import type { Banner, BannerFile, BannerItem } from '../../../shared/schemas/banner.ts';
import { jsonEnvelope, jsonLines } from '../json.ts';
import type { BannerPost } from './posts.ts';

// The two lists of a banner file.
export type Kind = 'characters' | 'cards';
export const BANNER_KINDS: Kind[] = ['characters', 'cards'];

export type ScoutPost = BannerPost;
export type ScoutBanner = BannerPost['banners'][number];

// The highest rarity, then the highest rate (our heuristic for `main`, as when the banners were seeded).
export function pickMain<T extends Pick<BannerItem, 'rarity' | 'rate'>>(featured: T[]): T | null {
  return featured.reduce<T | null>(
    (best, item) =>
      !best || item.rarity > best.rarity || (item.rarity === best.rarity && (item.rate ?? 0) > (best.rate ?? 0))
        ? item
        : best,
    null
  );
}

// Posts end banners at "9:59 p.m."; scraped banners end on the last second of that minute.
export function endOfMinute(iso: string): string;
export function endOfMinute(iso: string | null | undefined): string | undefined;
export function endOfMinute(iso: string | null | undefined): string | undefined {
  return iso?.replace(/:00(\.000)?Z$/, ':59.000Z');
}

// The keys the news adds to a seeded banner, taken off before each rebuild (which adds them again: idempotent).
const NEWS_KEYS = ['news_url', 'news_image', 'rerun', 'rerunOf', 'paid', 'name', 'note'] as const;
export function withoutNews(banner: Banner): Banner {
  const seeded = { ...banner };
  for (const key of NEWS_KEYS) delete seeded[key];
  return seeded;
}

// Each gacha id's banner from the newest post naming it, as `pick` takes it (null: not this post's to give). Posts go
// oldest first, so a later one wins (the same time: the higher id).
export function newestPerBanner<T>(
  posts: ScoutPost[],
  pick: (banner: ScoutBanner) => T | null
): Map<number, { post: ScoutPost; b: T }> {
  const newest = new Map<number, { post: ScoutPost; b: T }>();
  // (every stored post has a time: posts.json's post_at)
  for (const post of [...posts].sort((a, b) => (a.posted ?? '').localeCompare(b.posted ?? '') || a.id - b.id))
    for (const banner of post.banners) {
      const b = pick(banner);
      if (b !== null) newest.set(banner.gachaId, { post, b });
    }
  return newest;
}

// A banner file, one banner per line (an empty list `[]`).
const bannerList = (banners: Banner[]): string => (banners.length ? jsonLines(banners) : '[]');
export const writeBannerFile = (file: string, { source, characters, cards }: BannerFile): void =>
  writeFileSync(
    file,
    `${jsonEnvelope({ source: JSON.stringify(source), characters: bannerList(characters), cards: bannerList(cards) })}\n`
  );
