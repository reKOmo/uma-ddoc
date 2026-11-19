// Checks a model's answer to an event's questions and applies the parts that check out (pure, like ai/questions.ts).

import { type FoundWindow, type ScoutWindow, counted, dailyLines } from '../events/free-scouts.ts';
import { norm } from '../events/rewards.ts';
import { en } from '../news/lang/en.ts';
import type { Lexicon } from '../news/lang/index.ts';
import type { EventCard, EventItem, GameEvent } from '../../../shared/schemas/event.ts';
import { questionsOf } from './questions.ts';
import { type AskedEvent, type Field, type Questions, inText, isMissionSet } from './questions-spec.ts';

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

// What a model sent back, not trusted: any field may be missing or of another type.
type LooseItem = { name?: unknown; each?: unknown; times?: unknown; total?: unknown };
type LooseCard = { title?: unknown; copies?: unknown };
type LooseWindow = { scout?: unknown; start?: unknown; end?: unknown; days?: unknown };
type LooseAnswer = {
  name?: unknown;
  kind?: unknown;
  start?: unknown;
  end?: unknown;
  items?: unknown;
  cards?: unknown;
  scouts?: { windows?: unknown; total?: unknown } | null;
};

// The model's free scout windows, counted as the rules count them, or null unless they check out.
function answerScouts(
  event: AskedEvent,
  raw: LooseAnswer['scouts'],
  q: Questions,
  lang: Lexicon
): ScoutWindow[] | null {
  const words = lang.scouts;
  if (!words || !Array.isArray(raw?.windows) || !raw.windows.length) return null;
  const lines = event.text.split('\n');
  // A number the text states where the pattern says (a window's days, the total).
  const stated = (re: RegExp, n: unknown): n is number =>
    count(n, 1000) && lines.some((l) => Number(l.match(re)?.[1]) === n);
  const found: FoundWindow[] = [];
  // TODO(ts): each window is checked below
  for (const w of raw.windows as (LooseWindow | null)[]) {
    const start = q.isoOf(w?.start, event);
    const end = q.isoOf(w?.end, event, start);
    if (!inText(event, w?.scout) || !start || !end || start >= end) return null;
    if (w?.days != null && !stated(words.days, w.days)) return null;
    found.push({ scout: w.scout, type: words.named(w.scout), start, end, days: w?.days ?? null });
  }
  const { scouts, total } = counted(found, dailyLines(lines, words), words, true);
  if (raw?.total != null && !(stated(words.total, raw.total) && raw.total === total)) return null;
  return scouts;
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
  // TODO(ts): the model's JSON isn't validated; every field is checked below before it's used
  const answer = (raw ?? {}) as LooseAnswer;
  const take = (field: Field, empty: boolean) => trustModel || field in event.doubts || empty;
  const next = { ...event };

  // Small models put card copies among the items ("SSR Support Card [U & Me] Mihono Bourbon"): an item naming one of
  // the event's cards is its copies.
  const cardOf = (name: string) => event.cards.find((c) => norm(name).includes(norm(c.title)));
  // TODO(ts): elements of the model's arrays are checked one by one below
  const cards = [...(Array.isArray(answer.cards) ? (answer.cards as (LooseCard | null)[]) : [])];
  const items: (EventItem & { local?: string })[] = [];
  // TODO(ts): as above
  for (const a of Array.isArray(answer.items) ? (answer.items as (LooseItem | null)[]) : []) {
    if (typeof a?.name !== 'string') continue;
    const card = cardOf(a.name);
    // A mission set (<event>-m<n>) takes names only: its post's amounts are other things'.
    const amount = isMissionSet(event) ? null : amountOf(a);
    const item = card ? null : q.item(event, a.name, lang);
    if (card) {
      if (!cards.some((c) => typeof c?.title === 'string' && norm(c.title).includes(norm(card.title))))
        cards.push({ title: card.title, copies: amount });
    } else if (item) {
      // A number that doesn't check out drops the item; an amount the text leaves open (each, but not how many
      // times) lists it without one.
      const invalid = (n: unknown) => n != null && !count(n, 10_000_000);
      if (amount != null || !(invalid(a.each) || invalid(a.total) || invalid(a.times)))
        items.push({ ...item, count: amount });
    }
  }

  if (items.length) {
    // Both named by itemName(): the same item, singular or plural ("Alarm Clock" / "Alarm Clocks").
    const keyOf = (name: string) => norm(name).replace(/s$/, '');
    const byName = new Map(next.items.map((i) => [keyOf(i.name), i]));
    for (const a of items) {
      const key = keyOf(a.name);
      const old = byName.get(key);
      if (old ? take('items', old.count == null) && a.count != null : take('items', true)) {
        const local = old?.local ?? a.local;
        byName.set(key, { name: old?.name ?? a.name, count: a.count ?? old?.count ?? null, ...(local && { local }) });
      }
    }
    next.items = [...byName.values()];
  }
  if (cards.length)
    next.cards = next.cards.map((c) => {
      // Models write the title as they like ("SSR Support Card [U & Me] Mihono Bourbon", "Winning Dream Silence
      // Suzuka"): it matches a card whose title it contains.
      const a = cards.find((x) => typeof x?.title === 'string' && norm(x.title).includes(norm(c.title)));
      return a && count(a.copies, 20) && copiesGiven(event, c, a.copies, q) && take('cards', c.copies == null)
        ? { ...c, copies: a.copies }
        : c;
    });
  if (inText(event, answer.name) && !q.generic.test(answer.name.trim()) && take('name', !next.name))
    next.name = answer.name;
  if (typeof answer.kind === 'string' && q.kinds.includes(answer.kind) && q.kindTaken(event) && take('kind', false))
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
