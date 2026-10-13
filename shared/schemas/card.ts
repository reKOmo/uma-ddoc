// Support cards: what the site shows (generated/cards.json), the calculation's inputs (generated/card_stats/), and our
// records they're built from (data/jp_cards.json, data/jp_cards_pending.json, data/global_cards.json).

import { z } from 'zod';
import { CardSource, CardType, Day, IdKey, Rarity, Texts } from './common.ts';

export const CardSchema = z
  .strictObject({
    id: z.int().describe('The card id (the same on both servers and on GameTora).'),
    charId: z
      .int()
      .nullable()
      .describe("GameTora's character id (for group cards, one member's; from data/jp_cards.json); null without it."),
    type: CardType.describe(
      "The tier list's stat key, or group (ranked with friend cards). Codes: tierlist/join-cards TYPE_CODES."
    ),
    rarity: Rarity,
    name: Texts.describe(
      "The character's name (a group card's: the group's). en: Global's where it has the character, else GameTora's."
    ),
    title: Texts.describe(
      "The card's title, e.g. \"[Tracen Academy]\". en: Global's (data/global_cards.json), else GameTora's."
    ),
    release: z
      .strictObject({ gl: Day.nullable(), jp: Day.nullable() })
      .describe(
        'Release dates per server (gl: data/global_cards.json, jp: data/jp_cards.json), null when not out (or unknown).'
      ),
    source: z.array(CardSource).describe("How the card is obtained (GameTora's `obtained`); empty when unknown."),
    links: z.strictObject({
      gametora: z
        .string()
        .regex(/^\d+-[a-z0-9-]+$/)
        .nullable()
        .describe(
          "GameTora's page slug (its url_name, e.g. 30321-duramente): the app links https://gametora.com/umamusume/supports/<slug>."
        ),
    }),
    images: z.strictObject({
      icon: z
        .string()
        .nullable()
        .describe(
          "Upstream's square icon (at upstream's commit) where it has the card, else null: the app builds GameTora's from the id, as it does the full art."
        ),
    }),
  })
  .meta({ title: 'Card' });
export type Card = z.infer<typeof CardSchema>;

// generated/cards.json: every card, by id.
export const CardsFileSchema = z.record(IdKey, CardSchema).meta({
  title: 'Cards',
  description:
    "Every support card upstream or data/jp_cards.json has, with what the site shows (generated/cards.json, built by `pnpm build-cards`, see scripts/lib/cards). The tier list calculation's inputs are in generated/card_stats/.",
});
export type CardsFile = z.infer<typeof CardsFileSchema>;

// One limit break's numbers, as upstream's card lists have them (the calculation reads them by name).
export const LbStatsSchema = z.strictObject({
  starting_stats: z.array(z.number()),
  type_stats: z.number(),
  stat_bonus: z.array(z.number()),
  race_bonus: z.number(),
  sb: z.number(),
  specialty_rate: z.number(),
  unique_specialty: z.number(),
  offstat_appearance_denominator: z.number(),
  tb: z.number(),
  fs_bonus: z.number(),
  mb: z.number(),
  unique_fs_bonus: z.number(),
  fs_stats: z.array(z.number()),
  fs_training: z.number(),
  fs_motivation: z.number(),
  fs_specialty: z.number(),
  fs_ramp: z.array(z.number()),
  fs_energy: z.number(),
  wisdom_recovery: z.number(),
  effect_size_up: z.number(),
  energy_up: z.number(),
  energy_discount: z.number(),
  fail_rate_down: z.number(),
  hint_rate: z.number(),
  highlander_threshold: z.number(),
  highlander_training: z.number(),
  crowd_bonus: z.number(),
  fan_bonus: z.number(),
});
export type LbStats = z.infer<typeof LbStatsSchema>;

// generated/card_stats/<gl|jp>_card_stats.json: the calculation's inputs per server, by id. `charName`: upstream's
// per-server name (in the server's language); `events`: the card's event rewards (upstream's codes) or null; `lb`:
// LB0…LB4.
export const CardStatsSchema = z.strictObject({
  charName: z.string(),
  events: z.array(z.int()).nullable(),
  lb: z.array(LbStatsSchema).length(5),
});
export type CardStats = z.infer<typeof CardStatsSchema>;
export const CardStatsFileSchema = z.record(IdKey, CardStatsSchema);
export type CardStatsFile = z.infer<typeof CardStatsFileSchema>;

// data/jp_cards.json: our history of JP's cards, by id (the first 563 frozen from GameTora, newer ones from the JP
// news, augmented from GameTora: those carry news_url).
export const JpCardSchema = z.strictObject({
  charId: z.int(),
  type: CardType,
  rarity: Rarity,
  name: z.strictObject({ en: z.string(), jp: z.string() }),
  title: z.strictObject({ en: z.string().nullable(), jp: z.string() }),
  release: Day,
  source: z.array(CardSource),
  slug: z.string(),
  news_url: z.string().optional(),
});
export type JpCard = z.infer<typeof JpCardSchema>;
export const JpCardsFileSchema = z.record(IdKey, JpCardSchema);
export type JpCardsFile = z.infer<typeof JpCardsFileSchema>;

// data/jp_cards_pending.json: the JP news' cards GameTora doesn't list yet (no id).
export const JpPendingCardSchema = z.strictObject({
  rarity: Rarity,
  name: z.strictObject({ en: z.null(), jp: z.string() }),
  title: z.strictObject({ en: z.null(), jp: z.string() }),
  release: Day,
  source: z.array(CardSource),
  news_url: z.string(),
});
export type JpPendingCard = z.infer<typeof JpPendingCardSchema>;
export const JpPendingFileSchema = z.array(JpPendingCardSchema);

// data/global_cards.json: Global's card titles and release days, by id (a news-made release: its post's `news_url`;
// `title_en` null when the post's list doesn't name it).
export const GlobalCardSchema = z.strictObject({
  title_en: z.string().nullable(),
  release_gl: Day,
  news_url: z.string().optional(),
});
export type GlobalCard = z.infer<typeof GlobalCardSchema>;
export const GlobalCardsFileSchema = z.record(IdKey, GlobalCardSchema);
export type GlobalCardsFile = z.infer<typeof GlobalCardsFileSchema>;
