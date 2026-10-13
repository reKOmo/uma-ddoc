// Every data file and the schema it fits (test/schemas.test.ts parses each), and the JSON Schemas written into
// schemas/ (`pnpm build-schemas`).

import type { z } from 'zod';
import { BannerFileSchema } from './banner.ts';
import {
  CardStatsFileSchema,
  CardsFileSchema,
  GlobalCardsFileSchema,
  JpCardsFileSchema,
  JpPendingFileSchema,
} from './card.ts';
import { CmRewardsFileSchema, EventPairsFileSchema, EventsFileSchema, PredictedEventsFileSchema } from './event.ts';
import { GametoraCardsFileSchema, GametoraEventsFileSchema, GametoraTraineesFileSchema } from './gametora.ts';
import { AiAnswersFileSchema, PostsFileSchema } from './news.ts';
import { KnownDatesFileSchema, PredictionsFileSchema } from './predictions.ts';
import { PullGuideSchema } from './pullGuide.ts';
import { ScenariosFileSchema } from './scenario.ts';
import { SourcesFileSchema } from './sources.ts';

// Committed: always there.
export const DATA_FILES: Record<string, z.ZodType> = {
  'data/global_banners.json': BannerFileSchema,
  'data/global_cards.json': GlobalCardsFileSchema,
  'data/global_events.json': EventsFileSchema,
  'data/jp_banners.json': BannerFileSchema,
  'data/jp_cards.json': JpCardsFileSchema,
  'data/jp_cards_pending.json': JpPendingFileSchema,
  'data/jp_events.json': EventsFileSchema,
  'data/scenarios.json': ScenariosFileSchema,
  'data/known_dates.json': KnownDatesFileSchema,
  'data/champions_meeting_rewards.json': CmRewardsFileSchema,
  'data/news/gl/posts.json': PostsFileSchema,
  'data/news/jp/posts.json': PostsFileSchema,
  'data/news/gl/ai_answers.json': AiAnswersFileSchema,
  'data/news/jp/ai_answers.json': AiAnswersFileSchema,
};

// Built (generated/, gitignored): checked when present.
export const GENERATED_FILES: Record<string, z.ZodType> = {
  'generated/cards.json': CardsFileSchema,
  'generated/card_stats/gl_card_stats.json': CardStatsFileSchema,
  'generated/card_stats/jp_card_stats.json': CardStatsFileSchema,
  'generated/sources.json': SourcesFileSchema,
  'generated/pull_guide.json': PullGuideSchema,
  'generated/predicted_gl_releases.json': PredictionsFileSchema,
  'generated/predicted_global_banners.json': BannerFileSchema,
  'generated/predicted_global_events.json': PredictedEventsFileSchema,
  'generated/event_pairs.json': EventPairsFileSchema,
  'generated/raw/gametora_cards.json': GametoraCardsFileSchema,
  'generated/raw/gametora_trainees.json': GametoraTraineesFileSchema,
  'generated/raw/gametora_events.json': GametoraEventsFileSchema,
};

// schemas/<name>: JSON Schemas for editors and other tools (pull_guide.json points at its own with `$schema`).
export const JSON_SCHEMAS: Record<string, z.ZodType> = {
  'cards.schema.json': CardsFileSchema,
  'pull_guide.schema.json': PullGuideSchema,
};
