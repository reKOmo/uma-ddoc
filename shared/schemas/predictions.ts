import { z } from 'zod';
import { Day, Moment } from './common.ts';

// `dates`: a JP release day → its announced Global day (everything on it); `banners`: a JP banner's announced Global
// dates, by gacha id.
export const KnownDatesFileSchema = z.strictObject({
  dates: z.array(z.strictObject({ release_jp: Day, release_gl: Day, source: z.string().optional() })),
  banners: z.array(z.strictObject({ id: z.int(), start: Moment, end: Moment, source: z.string() })),
});
export type KnownDatesFile = z.infer<typeof KnownDatesFileSchema>;

export const PredictedCardSchema = z.strictObject({
  release_jp: Day,
  predicted_gl: Day,
  lo: Day,
  hi: Day,
  confirmed: z.boolean(),
});
export type PredictedCard = z.infer<typeof PredictedCardSchema>;

export const PredictionsFileSchema = z.strictObject({
  model: z.string(),
  fitted_at: Moment,
  anchor: z.strictObject({ release_jp: Day, release_gl: Day }),
  global_days_per_jp_day: z.number(),
  known_dates: z.array(z.strictObject({ release_jp: Day, release_gl: Day })),
  backtest: z.record(z.string(), z.array(z.number())),
  cards: z.record(z.string().regex(/^\d+$/), PredictedCardSchema),
});
export type PredictionsFile = z.infer<typeof PredictionsFileSchema>;
