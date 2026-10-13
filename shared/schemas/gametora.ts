import { z } from 'zod';
import { CardSource, Day, GametoraType } from './common.ts';

// raw/gametora_cards.json: the support card list. `rarity` 1–3 (R, SR, SSR); `url_name` the page's slug.
export const GametoraCardSchema = z.strictObject({
  support_id: z.int(),
  char_id: z.int(),
  char_name: z.string(),
  name_jp: z.string(),
  title_en: z.string().nullable(),
  title_ja: z.string(),
  type: GametoraType,
  rarity: z.int(),
  release: Day,
  obtained: CardSource,
  url_name: z.string(),
});
export type GametoraCard = z.infer<typeof GametoraCardSchema>;
export const GametoraCardsFileSchema = z.array(GametoraCardSchema);

// raw/gametora_trainees.json: trainee outfits (Japanese names), for debuting trainees' ids.
export const GametoraTraineeSchema = z.strictObject({
  id: z.int(),
  char_id: z.int(),
  name: z.string(),
  title: z.string(),
});
export type GametoraTrainee = z.infer<typeof GametoraTraineeSchema>;
export const GametoraTraineesFileSchema = z.array(GametoraTraineeSchema);

// raw/gametora_events.json: JP's story events, Champions Meetings and Legend Races (times in unix seconds).
export const GametoraEventsFileSchema = z.strictObject({
  story: z.array(
    z.strictObject({
      id: z.int(),
      name_ja: z.string(),
      start_ja: z.int(),
      end_ja: z.int(),
      event_support_ids: z.array(z.int()),
    })
  ),
  champions_meeting: z.array(z.strictObject({ id: z.int(), name: z.string(), start: z.int(), end: z.int() })),
  legend_race: z.array(
    z.strictObject({
      id: z.int().nullable(),
      name_ja: z.string(),
      start: z.int(),
      end: z.int(),
      races: z.array(z.strictObject({ card_id: z.int(), start: z.int(), end: z.int() })),
    })
  ),
});
export type GametoraEventsFile = z.infer<typeof GametoraEventsFileSchema>;
