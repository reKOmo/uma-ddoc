import { z } from 'zod';
import { Moment } from './common.ts';
import { EVENT_KINDS } from './event.ts';

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

// The hand-checked label of a Global post (data/news/gl/gold.json, `pnpm gold:review`): what the categorizer and the
// event extraction should make of it. Pre-filled from today's rules, `reviewed` once a person has checked it.
export const OTHER_KINDS = [
  'update',
  'issue',
  'maintenance',
  'sale',
  'scenario',
  'roundup',
  'community',
  'misc',
] as const;
export const POST_PHASES = ['announced', 'league_selection', 'started', 'ending', 'ended'] as const;
// A unit's role: the post's own event (a celebration's intro, a one-event post's text), a part of it with an event of
// its own, more of the unit before (a song, stamps), or nothing (a scout, a summary).
export const UNIT_ROLES = ['event', 'part', 'continues', 'none'] as const;
// Units: the post cut at its header art, its intro (text before the first art) a unit of its own (gold.ts' units()).
const GoldUnitSchema = z.strictObject({
  role: z.enum(UNIT_ROLES),
  kind: z.enum(EVENT_KINDS).nullable(),
  name: z.string().nullable(),
});
export const GoldLabelSchema = z.strictObject({
  id: z.int(),
  category: z.enum(['banner', 'event', 'other']),
  kind: z.enum([...EVENT_KINDS, ...OTHER_KINDS]).nullable(),
  phase: z.enum(POST_PHASES).nullable(),
  name: z.string().nullable(),
  // An event post's units, in order ([] for other posts).
  units: z.array(GoldUnitSchema),
  note: z.string().nullable(),
  reviewed: z.boolean(),
  // The post's update_at when it was labelled: a post edited since (a gift note added to a maintenance notice) wants
  // labelling again, its label meanwhile no gold (gold.ts' stale()).
  post_updated: NewsPostSchema.shape.update_at,
});
export type GoldLabel = z.infer<typeof GoldLabelSchema>;
export type GoldUnit = z.infer<typeof GoldUnitSchema>;
export const GoldFileSchema = z.array(GoldLabelSchema);

// What ml/categorize.py makes of each Global post (data/news/gl/categories.json, `pnpm news:categorize`): the gold
// label where there is one, else the rules' category + kind and the models' phase and units. `confidence`: the post
// model's probability for that category + kind; `flag`: its own answer where it differs (the post wants labelling).
export const PostCategorySchema = z.strictObject({
  id: z.int(),
  category: GoldLabelSchema.shape.category,
  kind: GoldLabelSchema.shape.kind,
  phase: GoldLabelSchema.shape.phase,
  // The gold name; null: the rules' (a new post).
  name: z.string().nullable(),
  source: z.enum(['gold', 'model']),
  confidence: z.number().nullable(),
  flag: z.string().nullable(),
  units: z.array(z.strictObject({ role: z.enum(UNIT_ROLES), kind: z.enum(EVENT_KINDS).nullable() })),
});
export type PostCategory = z.infer<typeof PostCategorySchema>;
export const CategoriesFileSchema = z.array(PostCategorySchema);
