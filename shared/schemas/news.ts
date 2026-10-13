// The official news, stored as the APIs send each post (data/news/<gl|jp>/posts.json), and a model's answers about
// doubted event fields (data/news/<gl|jp>/ai_answers.json).

import { z } from 'zod';
import { Moment } from './common.ts';

// "YYYY-MM-DD HH:MM:SS", UTC on Global, JST on JP (apiDate() turns both into UTC).
const ApiDate = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

// A post's `detail` + the ids the detail gave + fetched_at. `source: 'umapyoi'`: from umapyoi.net's mirror.
export const NewsPostSchema = z.strictObject({
  announce_id: z.int(),
  title: z.string(),
  message: z.string(),
  post_at: ApiDate,
  update_at: ApiDate.nullable(),
  announce_label: z.int(),
  image_big: z.string(),
  og_image: z.string().optional(),
  post_platform_flag: z.int(),
  from_date: ApiDate.nullable(),
  to_date: ApiDate.nullable(),
  // Global: the next older post; JP: the next higher id (next) and lower id (prev) the site serves.
  next_announce_id: z.int().nullable(),
  prev_announce_id: z.int().nullable().optional(),
  fetched_at: Moment,
  source: z.literal('umapyoi').optional(),
});
export type NewsPost = z.infer<typeof NewsPostSchema>;
export const PostsFileSchema = z.array(NewsPostSchema);

// A model's answer about an event (by its aiKey): only the fields it was asked. Amounts come in parts (each × times,
// or a total the text states); dates as the post writes them.
const AnswerSchema = z.strictObject({
  name: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  items: z
    .array(
      z.strictObject({
        name: z.string().nullable(),
        each: z.number().nullable(),
        times: z.number().nullable(),
        total: z.number().nullable(),
      })
    )
    .optional(),
  cards: z.array(z.strictObject({ title: z.string().nullable(), copies: z.number().nullable() })).optional(),
});
export const AiAnswerSchema = z.strictObject({
  model: z.string(),
  at: Moment,
  // Per-field question versions (FIELD_VERSIONS); `version`: older answers' single version.
  versions: z.record(z.string(), z.int()).optional(),
  version: z.int().optional(),
  answer: AnswerSchema,
});
export type AiAnswer = z.infer<typeof AiAnswerSchema>;
export const AiAnswersFileSchema = z.record(z.string(), AiAnswerSchema);
export type AiAnswersFile = z.infer<typeof AiAnswersFileSchema>;
