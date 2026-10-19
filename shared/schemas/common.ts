import { z } from 'zod';

// A day, "2026-10-13".
export const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// A moment, ISO 8601 in UTC: "2026-10-13T22:00:00.000Z" (also without milliseconds, or with an offset as Python writes
// it: "2026-10-13T00:42:30+00:00").
export const Moment = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/);
// Where a date came from: an official post (`news`), Global's release schedule (`confirmed`, data/known_dates.json),
// a prediction from JP's (`predicted`, ml/) or GameTora's history (`gametora`). Whether it's upcoming, live or over is
// the app's to work out from today.
export const DATE_STATUSES = ['news', 'confirmed', 'predicted', 'gametora'] as const;
export const DateStatus = z.enum(DATE_STATUSES);
export type DateStatus = z.infer<typeof DateStatus>;
// Every date an item has, with its status: `lo`–`hi` a predicted date's range, `source` what confirmed it.
const datedSchema = <T extends z.ZodType>(date: T) =>
  z.strictObject({ date, status: DateStatus, lo: Day.optional(), hi: Day.optional(), source: z.string().optional() });
export const DatedMoment = datedSchema(Moment);
export type DatedMoment = z.infer<typeof DatedMoment>;
export const DatedDay = datedSchema(Day);
export type DatedDay = z.infer<typeof DatedDay>;
export const dated = (date: string, status: DateStatus) => ({ date, status });

// A record's key that is a numeric id ("30321").
export const IdKey = z.string().regex(/^\d+$/);

export const RARITIES = ['R', 'SR', 'SSR'] as const;
export const Rarity = z.enum(RARITIES);
export type Rarity = z.infer<typeof Rarity>;

// The tier list's stat keys, plus group (ranked with friend cards). cards.json's types.
export const CARD_TYPES = ['speed', 'stamina', 'power', 'guts', 'wisdom', 'friend', 'group'] as const;
export const CardType = z.enum(CARD_TYPES);
export type CardType = z.infer<typeof CardType>;
// The same as GameTora (and the banner files) name them: wisdom is intelligence.
export const GAMETORA_TYPES = ['speed', 'stamina', 'power', 'guts', 'intelligence', 'friend', 'group'] as const;
export const GametoraType = z.enum(GAMETORA_TYPES);
export type GametoraType = z.infer<typeof GametoraType>;

// How a card is obtained (GameTora's `obtained`).
export const CARD_SOURCES = ['gacha', 'story_event', 'promo', 'limited_quest', 'main_story', 'shop'] as const;
export const CardSource = z.enum(CARD_SOURCES);
export type CardSource = z.infer<typeof CardSource>;

// Text in both languages; null where there's none.
export const Texts = z.strictObject({ en: z.string().nullable(), jp: z.string().nullable() });
export type Texts = z.infer<typeof Texts>;
