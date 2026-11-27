// Questions for a language model about the fields of an event the rules aren't sure of (its `doubts`, from events/doubts.ts),
// or left empty: which fields are asked, and the prompt in the question set of the post's language (ai/questionsEn.ts,
// ai/questionsJp.ts; shared parts in ai/questionsSpec.ts). Pure: `pnpm news:ai` asks; ai/answers.ts checks and
// applies the stored answers (buildEvents()).

import type { AiAnswer } from '../../../shared/schemas/news.ts';
import type { Question } from './client.ts';
import { en } from '../news/lang/en.ts';
import type { Lexicon } from '../news/lang/index.ts';
import type { Server } from '../news/text.ts';
import { EXAMPLES, FIELDS, questionsEn } from './questionsEn.ts';
import { questionsJp } from './questionsJp.ts';
import { DATE, type AskedEvent, type Examples, type Field, type Questions } from './questionsSpec.ts';

// Each question's version: bump one when its wording or examples change, so only stored answers to it are asked
// again (an answer stored with one `version` for every field, before these, counts as version 1 of each).
export const FIELD_VERSIONS: Record<Field, number> = { items: 2, cards: 2, name: 1, kind: 1, dates: 1, scouts: 1 };

// A stored answer's question versions per field.
const versionsOf = (stored: AiAnswer | null | undefined): Record<string, number> =>
  stored?.versions ?? (stored ? Object.fromEntries(Object.keys(FIELD_VERSIONS).map((f) => [f, 1])) : {});

// The asked fields whose stored answer (data/news/gl/ai_answers.json) is missing or for an older question.
export function staleFields(event: AskedEvent, stored: AiAnswer | null | undefined): Field[] {
  const versions = versionsOf(stored);
  return askedFields(event).filter((f) => versions[f] !== FIELD_VERSIONS[f]);
}

// A stored answer with a newer answer about `fields` merged in.
export function mergeAnswer(
  stored: AiAnswer | null | undefined,
  fields: Field[],
  answer: Record<string, unknown>,
  model: string
): AiAnswer {
  const keys = (f: Field) => (f === 'dates' ? ['start', 'end'] : [f]);
  const old = stored?.answer ?? {};
  return {
    model,
    at: new Date().toISOString(),
    versions: { ...versionsOf(stored), ...Object.fromEntries(fields.map((f) => [f, FIELD_VERSIONS[f]])) },
    answer: { ...old, ...Object.fromEntries(fields.flatMap(keys).map((k) => [k, answer[k] ?? null])) },
  };
}

// Kinds whose posts never name the event (the kind says what it is).
export const UNNAMED_KINDS = ['legend_race', 'transfer_requests', 'league_of_heroes'];

const QUESTIONS: Record<Server, Questions> = { gl: questionsEn, jp: questionsJp };

// (An example with a post date, [text, answer, posted]: JP's, whose dates leave the year out.)
const examplesFor = (fields: Field[], examples: Examples = EXAMPLES) =>
  fields.flatMap((f) =>
    examples[f].map(
      ([text, answer, posted]) =>
        `${posted ? `Posted: ${posted}\n` : ''}Text: ${JSON.stringify(text)}\nAnswer: ${JSON.stringify(answer)}`
    )
  );

// Why the rules' name for an event looks wrong, or null: a kind's generic word ("events" from "X! events are here!"),
// or (English) a piece of a sentence, which a title-cased name never starts lowercase.
export function nameDoubt(name: string | null, lang: Lexicon = en): string | null {
  if (!name) return null;
  if (questionsOf(lang).generic.test(name.trim())) return 'the name is a generic word, not a name';
  if (lang.server === 'gl' && /^[a-z]/.test(name)) return 'the name starts lowercase: a piece of a sentence';
  return null;
}

export const questionsOf = (lang: Lexicon = en): Questions => QUESTIONS[lang.server];

// Asked only where the post may hold an answer the rules couldn't read: an item named without an amount ("rewards
// like carats") or a Legend Race / Transfer Request without a name has none, so they aren't asked.
export function askedFields(event: AskedEvent): Field[] {
  const empty: Partial<Record<Field, boolean>> = {
    cards: event.cards.some((c) => c.copies == null),
    name: !event.name && !UNNAMED_KINDS.includes(event.kind),
  };
  return (Object.keys(FIELDS) as Field[]).filter((f) => f in event.doubts || empty[f]);
}

export function question(
  event: AskedEvent,
  { all = false, fields: only, lang = en }: { all?: boolean; fields?: Field[]; lang?: Lexicon } = {}
): Question {
  const q = questionsOf(lang);
  // Copies need cards; kinds are asked where a model may correct one.
  const askable = (f: Field) =>
    (f !== 'cards' || event.cards.length) && (f !== 'kind' || q.kindAsked(event)) && (f !== 'scouts' || event.scouts);
  const fields = all ? (Object.keys(q.fields) as Field[]).filter(askable) : (only ?? askedFields(event));
  const properties: Record<string, unknown> = {};
  for (const f of fields) {
    if (f === 'dates') Object.assign(properties, { start: DATE, end: DATE });
    else properties[f] = q.fields[f].schema;
  }
  const asks = fields.map((f) => (typeof q.fields[f].ask === 'function' ? q.fields[f].ask(event) : q.fields[f].ask));
  const user = [
    ...q.header(event),
    'Answer these:',
    ...asks.map((a) => `- ${a}`),
    '',
    'Examples from other posts (answer only about the post below):',
    ...examplesFor(fields, q.examples),
    '',
    'Post text:',
    event.text,
    ...(event.context?.length
      ? ['', "Elsewhere in the same post (about other events, for this event's share):", ...event.context]
      : []),
  ].join('\n');
  return {
    system: q.system,
    user,
    schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  };
}
