import { z } from 'zod';
import { DatedMoment } from './common.ts';

// A launch: from its post (news), known still ahead (confirmed) or predicted (with a lo–hi range, ml/scenarios.py).
export const StartDateSchema = DatedMoment;
export type StartDate = DatedMoment;

export const ScenarioSchema = z.strictObject({
  // The tier list's key where it ranks the scenario, else ours: an id, never shown.
  key: z.string(),
  // The names shown (scenarioName() + the Scenario names setting); Global's null until Global has one.
  short: z.strictObject({ jp: z.string(), en: z.string().nullable() }),
  full_en: z.string().nullable(),
  full_jp: z.string(),
  en_start_date: StartDateSchema.nullable(),
  jp_start_date: StartDateSchema.nullable(),
  links: z.strictObject({
    gametora: z.string(),
    cover: z.string(),
    // The launch post's id in that server's news (umapyoi.net's copy).
    umapyoi_jp: z.int().optional(),
    umapyoi_gl: z.int().optional(),
  }),
  // The cover's main colour, "#rrggbb".
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ScenariosFileSchema = z.strictObject({
  source: z.strictObject({ jp: z.string(), en: z.string() }),
  scenarios: z.array(ScenarioSchema),
});
export type ScenariosFile = z.infer<typeof ScenariosFileSchema>;
