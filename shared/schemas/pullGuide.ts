import { z } from 'zod';
import { IdKey } from './common.ts';

const AdviceFields = {
  googleSheetsSrc: z
    .strictObject({
      gid: z.string().regex(/^\d+$/).nullable().describe("The sheet tab's id."),
      row: z.int().min(1).nullable().describe('The row number (1-based).'),
    })
    .describe('Where the entry is in the sheet, for links to its row.'),
  freePulls: z.int().min(0).nullable().describe('Free pulls the banner gives.'),
  shouldPull: z
    .string()
    .regex(/^(yes|no|free|(whale|dolphin)\+*)$/)
    .nullable()
    .describe(
      'The "Should pull?" pill: yes, no, free, whale or dolphin, with the advice\'s pluses ("whale++"); null when the advice starts with none.'
    ),
  comment: z
    .string()
    .min(1)
    .nullable()
    .describe('The line under the pill: the whole advice when it says more than the pill, or long advice without one.'),
  advice: z
    .string()
    .min(1)
    .nullable()
    .describe('The notes as one paragraph, led by short advice without a pill ("With Kitasan").'),
};

export const AdviceSchema = z.strictObject(AdviceFields);
export type Advice = z.infer<typeof AdviceSchema>;

// A card on no banner: what it is and when, as the sheet gives it (an exact date, the author's estimate of a month and
// part of it, or the sheet's text when it can't be read).
const label = z.string().nullable().describe('"Event", "Story", "Friend Points Shop"…');
export const ReleaseSchema = z
  .union([
    z.strictObject({ label, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    z.strictObject({
      label,
      month: z.string().regex(/^\d{4}-\d{2}$/),
      part: z.enum(['early', 'mid', 'late']).nullable(),
    }),
    z.strictObject({ label, dateText: z.string().nullable() }),
  ])
  .describe('A card on no banner: what it is and when, as the sheet gives it.');
export type Release = z.infer<typeof ReleaseSchema>;

export const NoBannerAdviceSchema = z.strictObject({ ...AdviceFields, release: ReleaseSchema });
export type NoBannerAdvice = z.infer<typeof NoBannerAdviceSchema>;

export const PullGuideSchema = z
  .strictObject({
    $schema: z.string().optional(),
    banners: z
      .record(IdKey, z.record(IdKey, AdviceSchema))
      .describe(
        "Advice per Global banner (real in data/global_banners.json, or predicted), then per card featured on it. Whether it's the card's rerun is on the banner (`featured[].new`)."
      ),
    noBanner: z
      .record(IdKey, NoBannerAdviceSchema)
      .describe('Advice for cards on no gacha banner (event, story and shop cards), per card.'),
  })
  .meta({
    title: 'Pull guide',
    description:
      "Pull advice from Luh's Umamusume Support Card Encyclopedia, per Global banner and card (generated/pull_guide.json, written by `pnpm fetch-pull-guide`; its source is in generated/sources.json).",
  });
export type PullGuide = z.infer<typeof PullGuideSchema>;
