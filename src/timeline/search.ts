// The Timeline's search: chips picked from what this calendar has (characters, card types, pull advice, names, kinds,
// items, races) or typed as text. Chips of one type are alternatives; chips of different types must all match.
import i18n from '../i18n/index.ts';
import type { Verdict } from '../pullGuide.ts';
import { STAT_OF_TYPE } from '../tiers.ts';
import type { CardsFile } from '../../shared/schemas/card.ts';
import type { Entry } from './entries.ts';
import { courseName, kindName } from './format.ts';
import { spanOf } from './layout.ts';

export const TERM_TYPES = ['character', 'type', 'pull', 'name', 'kind', 'item', 'race', 'text'] as const;
export type TermType = (typeof TERM_TYPES)[number];
// `aliases`: other names it's found by (a character's Japanese name, an item's JP one). `tone`: its chip's colour, the
// calendar's (a `data-tone` of global.css: a kind's, a card type's, a name its entry's).
export type Term = { type: TermType; value: string; label: string; aliases: string[]; tone: string | null };
type Indexed = { keys: Set<string>; text: string };
export type SearchIndex = { terms: Term[]; entries: Map<string, Indexed> };

export const textTerm = (text: string): Term => ({ type: 'text', value: text, label: text, aliases: [], tone: null });
export const termKey = (term: Pick<Term, 'type' | 'value'>): string => `${term.type}:${term.value}`;

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();

// A character by id, with their names: JP's banners and events name them in Japanese, the card data has both.
const characterNames = (cards: CardsFile): Map<number | null, CardsFile[string]['name']> =>
  new Map(Object.values(cards).map((card) => [card.charId, card.name]));

// `verdictsOf`: a support card banner's pull advice (the filter's: one of its cards has it), when the guide covers the
// calendar.
export function searchIndex(
  entries: Entry[],
  cards: CardsFile,
  verdictsOf: ((entry: Entry) => Set<Verdict>) | null = null
): SearchIndex {
  const names = characterNames(cards);
  const terms = new Map<string, Term>();
  const indexed = new Map<string, Indexed>();
  for (const entry of entries) {
    const own: Term[] = [];
    const add = (
      type: TermType,
      value: string,
      label: string,
      { aliases = [], tone = null }: { aliases?: (string | null | undefined)[]; tone?: string | null } = {}
    ) => own.push({ type, value, label, aliases: aliases.filter((a): a is string => !!a && a !== label), tone });
    for (const item of entry.featured) {
      const card = item.card && item.id != null ? cards[item.id] : undefined;
      // A trainee's id is their character's and the outfit's (100101: Special Week's first).
      const charId = card?.charId ?? (!item.card && item.id != null ? Math.floor(item.id / 100) : null);
      const name = charId != null ? names.get(charId) : undefined;
      add('character', charId != null ? String(charId) : item.name, name?.en ?? item.name, {
        aliases: [name?.jp, item.name],
      });
      if (card) {
        const stat = STAT_OF_TYPE[card.type];
        add('type', stat, i18n.t(`stat.${stat}`), { tone: `type-${stat}` });
      }
    }
    if (entry.group === 'cards' && verdictsOf)
      for (const verdict of verdictsOf(entry))
        add('pull', verdict, i18n.t(verdict === 'none' ? 'timeline.filter.noAdvice' : `pullGuide.verdict.${verdict}`), {
          tone: `filter-pull-${verdict}`,
        });
    if (entry.name) add('name', entry.name, entry.name, { tone: entry.tone });
    add('kind', entry.kind, kindName(entry), { tone: `kind-${entry.kind}` });
    for (const item of entry.items) add('item', item.name, item.name, { aliases: [item.local] });
    for (const race of entry.races) if (race.distance) add('race', courseName(race), courseName(race));
    for (const term of own) if (!terms.has(termKey(term))) terms.set(termKey(term), term);
    const titles = entry.featured.map((item) => item.title ?? '');
    indexed.set(entry.key, {
      keys: new Set(own.map(termKey)),
      text: normalize([...own.flatMap((term) => [term.label, ...term.aliases]), ...titles].join(' ')),
    });
  }
  return { terms: [...terms.values()], entries: indexed };
}

export function matches(indexed: Indexed | undefined, chips: Term[]): boolean {
  if (!indexed) return false;
  return [...Map.groupBy(chips, (chip) => chip.type).values()].every((group) =>
    group.some((chip) =>
      chip.type === 'text' ? indexed.text.includes(normalize(chip.value)) : indexed.keys.has(termKey(chip))
    )
  );
}

// What the search keeps: the matches, their parents (unfolded down to them, for context) and their parts.
export function searchResults(
  entries: Entry[],
  chips: Term[],
  index: SearchIndex
): { matched: Entry[]; shown: Set<string>; unfold: Set<string> } {
  const byKey = new Map(entries.map((e) => [e.key, e] as const));
  const matched = entries.filter((e) => matches(index.entries.get(e.key), chips));
  const shown = new Set<string>();
  const unfold = new Set<string>();
  const addParts = (entry: Entry) => {
    for (const key of entry.parts) {
      shown.add(key);
      const part = byKey.get(key);
      if (part) addParts(part);
    }
  };
  for (const entry of matched) {
    shown.add(entry.key);
    addParts(entry);
    for (let parent = entry.parent; parent; parent = byKey.get(parent)?.parent ?? null) {
      shown.add(parent);
      unfold.add(parent);
    }
  }
  return { matched, shown, unfold };
}

// Where a search jumps: the first match still running or to come, else the last one before.
export function jumpTarget(matched: Entry[], now = Date.now()): Entry | null {
  const ahead = matched.filter((e) => e.openEnded || spanOf(e).end >= now);
  if (ahead.length) return ahead.reduce((a, b) => (Date.parse(b.start) < Date.parse(a.start) ? b : a));
  return matched.reduce<Entry | null>((a, b) => (!a || Date.parse(b.start) > Date.parse(a.start) ? b : a), null);
}
