import { z } from 'zod';
import { IdKey } from './common.ts';

// The parts of UmaTL's translations read here (scripts/fetch-umatl.ts). raw/umatl_text_data.json: hachimi-tl-en's
// text table, category → game id → English (only UMATL_CATEGORIES); raw/umatl_mdb.json: the original
// umamusu-translate repo's tables, table → Japanese text → English (only UMATL_TABLES).
export const UmatlTextDataSchema = z.record(z.string(), z.record(IdKey, z.string()));
export const UmatlMdbSchema = z.record(z.string(), z.record(z.string(), z.string()));
export type UmatlRaw = { text_data: z.infer<typeof UmatlTextDataSchema>; mdb: z.infer<typeof UmatlMdbSchema> };

// Whether a name is (partly) Japanese: only those are translated.
const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;
export const hasJapanese = (text: string): boolean => JAPANESE.test(text);

// English for a JP name: `fan` when it's UmaTL's fan translation, else official (Global's own name, or GameTora's).
export const TlText = z.strictObject({ en: z.string(), fan: z.boolean() });
export type TlText = z.infer<typeof TlText>;

export const TranslationsFileSchema = z
  .strictObject({
    cards: z
      .record(IdKey, z.string())
      .describe('Support card titles ("[…]") UmaTL has where cards.json has no English title: all fan.'),
    trainees: z.record(IdKey, TlText).describe("Trainee outfit titles by trainee id: Global's, else UmaTL's."),
    chars: z.record(IdKey, TlText).describe("Character names by character id: Global's or GameTora's, else UmaTL's."),
    events: z
      .record(z.string(), TlText)
      .describe(
        "JP event names by JP event id: the paired Global event's, else UmaTL's (story events by game id), else by name: a paired event's of that name, else UmaTL's."
      ),
    text: z
      .record(z.string(), TlText)
      .describe(
        "Other JP names as our data writes them (titles, banner names, items): UmaTL's (a piece's from its outfit and character, Global's where it has them)."
      ),
  })
  .meta({
    title: 'Translations',
    description:
      'English for the JP names the site shows (generated/translations.json, `pnpm fetch-umatl`). Never read by news:ai or ml/: UmaTL forbids its use with generative models.',
  });
export type TranslationsFile = z.infer<typeof TranslationsFileSchema>;
