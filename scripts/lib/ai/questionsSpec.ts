// What the English and Japanese question sets share: the field types, the schemas, and the checks on names and times.

import type { JsonSchema } from './client.ts';
import { norm } from '../news/text.ts';
import type { ScoutWindow } from '../events/freeScouts.ts';
import type { GameEvent } from '../../../shared/schemas/event.ts';
import type { Lexicon } from '../news/lang/index.ts';

export type Field = 'items' | 'cards' | 'name' | 'kind' | 'dates' | 'scouts';

// The event fragment events/fragments.ts makes (a minimal local type of the fields read here): an event as read so far, plus
// its post's text, post time, the rules' doubts and the lines elsewhere in the post about its cards.
export type AskedEvent = Pick<GameEvent, 'id' | 'name' | 'parent' | 'cards' | 'items'> & {
  // (events/doubts.ts' Fragment: a kind and dates as read so far, not yet checked)
  kind: string;
  start: string | null;
  end: string | null;
  text: string;
  posted: string;
  doubts: Record<string, string>;
  context?: string[];
  scouts?: ScoutWindow[];
};

// A celebration's sub-event kinds (events/names.ts reads them from the post; a model may correct one).
export const SUB_EVENT_KINDS = ['login_bonus', 'missions', 'sale', 'shop', 'gift', 'campaign'];

export const nullable = (type: string): JsonSchema => ({ type: [type, 'null'] });

export type FieldSpec = { ask: string | ((e: AskedEvent) => string); schema: JsonSchema | null };
export const DATE = { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$' };

// Free scout windows (the code counts the scouts).
export const SCOUTS: JsonSchema = {
  type: 'object',
  properties: {
    windows: {
      type: 'array',
      items: {
        type: 'object',
        properties: { scout: { type: 'string' }, start: DATE, end: DATE, days: nullable('integer') },
        required: ['scout', 'start', 'end', 'days'],
        additionalProperties: false,
      },
    },
    total: nullable('integer'),
  },
  required: ['windows', 'total'],
  additionalProperties: false,
};

// (An example with a post date, [text, answer, posted]: JP's, whose dates leave the year out.)
export type Examples = Record<Field, [string, unknown, string?][]>;

// A name the text has (singular or plural: "150-carat gifts" has Carats).
export const inText = (event: AskedEvent, name: unknown): name is string =>
  typeof name === 'string' && name.length <= 80 && norm(event.text).includes(norm(name).replace(/s$/, ''));
export const valid = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s);

export const isMissionSet = (event: AskedEvent) => /-m\d+$/.test(event.id);
// (A doubted name isn't shown: a model shown it repeats it.)
export const shownName = (event: AskedEvent) => ('name' in event.doubts ? null : event.name) ?? '?';

// Per server (the lexicon's `server`): what's asked and how answers are checked.
export type Questions = {
  system: string;
  fields: Record<Field, FieldSpec>;
  examples: Examples;
  kinds: string[];
  kindAsked: (event: AskedEvent) => boolean;
  kindTaken: (event: AskedEvent) => boolean;
  header: (event: AskedEvent) => string[];
  item: (event: AskedEvent, raw: string, lang: Lexicon) => { name: string; local?: string } | null;
  copiesLine: RegExp;
  numberWord: (n: number) => string | null | undefined;
  generic: RegExp;
  isoOf: (s: unknown, event: AskedEvent, after?: string | null) => string | null;
};
