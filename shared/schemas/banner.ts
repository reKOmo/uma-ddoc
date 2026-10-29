import { z } from 'zod';
import { DatedMoment, GametoraType, Moment } from './common.ts';

// A featured trainee or card. `id` / `char_id` null: a card or trainee not resolved yet (a JP news card GameTora
// doesn't list, a debuting trainee). `type`: cards only (null: a JP news card the data doesn't type yet). `rate` null where the post gives none. `from_news`: an R card
// the JP post lists that GameTora's banner leaves out.
export const BannerItemSchema = z.strictObject({
  id: z.int().nullable(),
  char_id: z.int().nullable(),
  name: z.string(),
  title: z.string(),
  rarity: z.int(),
  type: GametoraType.nullable().optional(),
  rate: z.int().nullable(),
  new: z.boolean(),
  from_news: z.boolean().optional(),
});
export type BannerItem = z.infer<typeof BannerItemSchema>;

// Ids are the game's gacha ids; JP's re-runs without one of their own are "<id>-rerun" (the only string ids).
export const BannerIdSchema = z.union([z.int(), z.string().regex(/^\d+-rerun$/)]);
export type BannerId = z.infer<typeof BannerIdSchema>;

export const BannerSchema = z.strictObject({
  id: BannerIdSchema,
  start: DatedMoment,
  // null: open-ended (JP's 終了日時未定).
  end: DatedMoment.nullable(),
  // The highest rarity, then highest rate featured item (pickMain()); null with no featured list (JP's paid scouts).
  main: BannerItemSchema.nullable(),
  featured: z.array(BannerItemSchema),
  // A news-made banner's official art.
  image: z.string().optional(),
  // From the news: the post, its art; `from_news` made from the post.
  news_url: z.string().optional(),
  news_image: z.string().optional(),
  from_news: z.boolean().optional(),
  // JP: the scout's name from its post, a note on what a paid scout draws from, paid (gacha id ≥ 50000), re-runs.
  name: z.string().optional(),
  note: z.string().optional(),
  paid: z.boolean().optional(),
  rerunOf: z.int().optional(),
  // (end null: an open-ended re-run)
  rerun: z.strictObject({ id: BannerIdSchema, start: DatedMoment, end: DatedMoment.nullable() }).optional(),
  // Free pulls the news' free scout campaigns give on it (scripts/lib/free-scouts.ts' withFreePulls(); a predicted
  // Global banner keeps its JP banner's: what JP gave).
  free_pulls: z.int().min(1).optional(),
  // Predicted (generated/predicted_global_banners.json): JP's dates it's predicted from.
  predicted: z.boolean().optional(),
  jp_start: Moment.optional(),
  jp_end: Moment.optional(),
});
export type Banner = z.infer<typeof BannerSchema>;

// A banner file: trainee banners, then support card banners, and where they came from.
export const BannerFileSchema = z.strictObject({
  source: z.union([
    z.strictObject({ site: z.string(), server: z.string(), scraped_at: Moment }),
    z.strictObject({ predicted_from: z.string(), fitted_at: Moment }),
  ]),
  characters: z.array(BannerSchema),
  cards: z.array(BannerSchema),
});
export type BannerFile = z.infer<typeof BannerFileSchema>;
