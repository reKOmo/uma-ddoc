import { z } from 'zod';
import { DatedDay, Day, Moment } from './common.ts';

// `dates`: a JP release day → its announced Global day (everything on it, or with `only` just the JP events / scenario
// keys it names: the rest of the day still moves there, predicted); `banners`: a JP banner's announced Global dates, by
// gacha id.
export const KnownDatesFileSchema = z.strictObject({
  dates: z.array(
    z.strictObject({
      release_jp: Day,
      release_gl: Day,
      only: z
        .strictObject({ events: z.array(z.string()).optional(), scenarios: z.array(z.string()).optional() })
        .optional(),
      source: z.string().optional(),
    })
  ),
  banners: z.array(z.strictObject({ id: z.int(), start: Moment, end: Moment, source: z.string() })),
});
export type KnownDatesFile = z.infer<typeof KnownDatesFileSchema>;

export const PredictedCardSchema = z.strictObject({
  release_jp: Day,
  // predicted (lo–hi), or confirmed by data/known_dates.json
  release_gl: DatedDay,
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
