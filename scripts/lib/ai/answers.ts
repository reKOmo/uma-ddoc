// Checks a model's answer to an event's questions and applies the parts that check out (pure, like ai/questions.ts).

import { z } from 'zod';
import { type FoundWindow, type ScoutWindow, counted, dailyLines } from '../events/freeScouts.ts';
import { norm } from '../news/text.ts';
import { en } from '../news/lang/en.ts';
import type { Lexicon } from '../news/lang/index.ts';
import type { EventCard, EventItem, GameEvent } from '../../../shared/schemas/event.ts';
import { questionsOf } from './questions.ts';
import { type AskedEvent, type Field, type Questions, inText, isMissionSet } from './questionsSpec.ts';

const count = (n: unknown, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= max;

// A number of copies the post gives for a card: in a line that names the card or talks of copies / times, as a digit
// or a word ("up to three times"); a "1." list number elsewhere doesn't count. (JP: a digit, in a line naming the card
// or with 枚 / 回.)
function copiesGiven(event: AskedEvent, card: EventCard, n: number, q: Questions): boolean {
  const lines = [...event.text.split('\n'), ...(event.context ?? [])];
  const said = new RegExp(`(^|[^\\d.\\w])${n}(?![\\d.\\w])|\\b${q.numberWord(n) ?? '\\0'}\\b`, 'i'); // not "1st"
  return lines.some((line) => (norm(line).includes(norm(card.title)) || q.copiesLine.test(line)) && said.test(line));
}

// An item's amount: the total the text states, else each × times.
const amountOf = (a: { total?: unknown; each?: unknown; times?: unknown }): number | null =>
  count(a.total, 10_000_000) ? a.total : count(a.each, 10_000_000) && count(a.times, 1000) ? a.each * a.times : null;

// What a model sent back, not trusted: a field of another type counts as missing, but a number is checked where it's
// used (count()): one that doesn't check out drops what it's in, so it stays unknown here.
const NUMBER = z.unknown().optional();
const TEXT = z.string().optional().catch(undefined);
const ModelAnswer = z
  .object({
    name: TEXT,
    kind: TEXT,
    start: TEXT,
    end: TEXT,
    items: z
      .array(z.object({ name: z.string(), each: NUMBER, times: NUMBER, total: NUMBER }).nullable().catch(null))
      .catch([]),
    cards: z.array(z.object({ title: z.string(), copies: NUMBER }).nullable().catch(null)).catch([]),
    scouts: z
      .object({
        windows: z
          .array(
            z.object({ scout: z.string(), start: z.string(), end: z.string(), days: NUMBER }).nullable().catch(null)
          )
          .catch([]),
        total: NUMBER,
      })
      .nullable()
      .catch(null)
      .optional(),
  })
  .catch({ items: [], cards: [] });
type ModelAnswer = z.infer<typeof ModelAnswer>;
type AnsweredCard = { title: string; copies?: unknown };
type Take = (field: Field, empty: boolean) => boolean;

// The model's free scout windows, counted as the rules count them, or null unless they check out.
function answerScouts(
  event: AskedEvent,
  answer: ModelAnswer['scouts'],
  q: Questions,
  lang: Lexicon
): ScoutWindow[] | null {
  const words = lang.scouts;
  if (!words || !answer?.windows.length) return null;
  const lines = event.text.split('\n');
  // A number the text states where the pattern says (a window's days, the total).
  const stated = (re: RegExp, n: unknown): n is number =>
    count(n, 1000) && lines.some((l) => Number(l.match(re)?.[1]) === n);
  const found: FoundWindow[] = [];
  for (const w of answer.windows) {
    const start = q.isoOf(w?.start, event);
    const end = q.isoOf(w?.end, event, start);
    if (!w || !inText(event, w.scout) || !start || !end || start >= end) return null;
    if (w.days != null && !stated(words.days, w.days)) return null;
    found.push({ scout: w.scout, type: words.named(w.scout), start, end, days: w.days ?? null });
  }
  const { scouts, total } = counted(found, dailyLines(lines, words), words, true);
  if (answer.total != null && !(stated(words.total, answer.total) && answer.total === total)) return null;
  return scouts;
}

// The answer's items the text has, and its cards with the copies it put among the items: small models do ("SSR
// Support Card [U & Me] Mihono Bourbon"), an item naming one of the event's cards is its copies.
function answeredItems(event: AskedEvent, answer: ModelAnswer, q: Questions, lang: Lexicon) {
  const cardOf = (name: string) => event.cards.find((c) => norm(name).includes(norm(c.title)));
  const cards: AnsweredCard[] = answer.cards.filter((c) => c !== null);
  const items: (EventItem & { local?: string })[] = [];
  for (const a of answer.items) {
    if (!a) continue;
    const card = cardOf(a.name);
    // A mission set (<event>-m<n>) takes names only: its post's amounts are other things'.
    const amount = isMissionSet(event) ? null : amountOf(a);
    const item = card ? null : q.item(event, a.name, lang);
    if (card) {
      if (!cards.some((c) => norm(c.title).includes(norm(card.title))))
        cards.push({ title: card.title, copies: amount });
    } else if (item) {
      // A number that doesn't check out drops the item; an amount the text leaves open (each, but not how many
      // times) lists it without one.
      const invalid = (n: unknown) => n != null && !count(n, 10_000_000);
      if (amount != null || !(invalid(a.each) || invalid(a.total) || invalid(a.times)))
        items.push({ ...item, count: amount });
    }
  }
  return { items, cards };
}

function mergeItems(old: EventItem[], answered: (EventItem & { local?: string })[], take: Take): EventItem[] {
  // Both named by itemName(): the same item, singular or plural ("Alarm Clock" / "Alarm Clocks").
  const keyOf = (name: string) => norm(name).replace(/s$/, '');
  const byName = new Map(old.map((i) => [keyOf(i.name), i]));
  for (const a of answered) {
    const key = keyOf(a.name);
    const was = byName.get(key);
    if (was ? take('items', was.count == null) && a.count != null : take('items', true)) {
      const local = was?.local ?? a.local;
      byName.set(key, { name: was?.name ?? a.name, count: a.count ?? was?.count ?? null, ...(local && { local }) });
    }
  }
  return [...byName.values()];
}

function mergeCards(event: AskedEvent, answered: AnsweredCard[], q: Questions, take: Take): EventCard[] {
  return event.cards.map((c) => {
    // Models write the title as they like ("SSR Support Card [U & Me] Mihono Bourbon", "Winning Dream Silence
    // Suzuka"): it matches a card whose title it contains.
    const a = answered.find((x) => norm(x.title).includes(norm(c.title)));
    return a && count(a.copies, 20) && copiesGiven(event, c, a.copies, q) && take('cards', c.copies == null)
      ? { ...c, copies: a.copies }
      : c;
  });
}

// Amounts are asked in parts (each time × how many times, or a total the text states): small models read numbers well
// but multiply badly, so the code does the arithmetic.
// Rules come first: a doubted or empty field takes the model's answer, a value the rules are sure of is never touched
// (`trustModel`, for comparing a model with the rules, lets the answer win wherever it's valid).
// An answer is used only if it checks out: names appear in the text, amounts are whole and up to 10 million, copies are
// of a card the rules found (1–20) and the post gives them, the kind is known, dates are in order and within ~200 days
// of the post; free scout windows name a scout the text names, the days and total they give are in the text, and the
// windows, counted as the rules count them, add up to that total.
export function applyAnswer<E extends AskedEvent>(
  event: E,
  raw: unknown,
  { trustModel = false, lang = en }: { trustModel?: boolean; lang?: Lexicon } = {}
): E {
  const q = questionsOf(lang);
  const answer = ModelAnswer.parse(raw);
  const take: Take = (field, empty) => trustModel || field in event.doubts || empty;
  const next = { ...event };

  const { items, cards } = answeredItems(event, answer, q, lang);
  if (items.length) next.items = mergeItems(next.items, items, take);
  if (cards.length) next.cards = mergeCards(event, cards, q, take);
  if (inText(event, answer.name) && !q.generic.test(answer.name.trim()) && take('name', !next.name))
    next.name = answer.name;
  if (answer.kind && q.kinds.includes(answer.kind) && q.kindTaken(event) && take('kind', false))
    // TODO(ts): q.kinds holds only EventKinds, but is typed as strings
    next.kind = answer.kind as GameEvent['kind'];
  const scouts = answerScouts(event, answer.scouts, q, lang);
  if (scouts && take('scouts', !next.scouts?.length)) next.scouts = scouts;
  const start = q.isoOf(answer.start, event);
  const end = q.isoOf(answer.end, event, start);
  if (start && (!end || start < end)) {
    if (take('dates', !next.start)) next.start = start;
    if (end && take('dates', !next.end)) next.end = end;
  }
  return next;
}
