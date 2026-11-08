import { describe, it, expect } from 'vitest';
import { jumpTarget, searchIndex, searchResults, textTerm } from '../src/timeline/search.ts';
import type { Entry } from '../src/timeline/entries.ts';
import type { Term } from '../src/timeline/search.ts';
import type { CardsFile } from '../shared/schemas/card.ts';
import { type Language, languageOf } from '../src/translations.ts';
import { fixture, present } from './helpers.ts';

const cards = fixture<CardsFile>({
  30001: {
    id: 30001,
    charId: 1001,
    type: 'speed',
    name: { en: 'Special Week', jp: 'スペシャルウィーク' },
    release: { gl: { date: '2025-01-01' }, jp: null },
  },
  30002: {
    id: 30002,
    charId: 1002,
    type: 'wisdom',
    name: { en: 'Silence Suzuka', jp: 'サイレンススズカ' },
    release: { gl: null, jp: null },
  },
});
const entry = (fields: Record<string, unknown>): Entry =>
  fixture<Entry>({
    group: 'event',
    kind: 'story',
    name: null,
    start: '2026-01-01T00:00:00Z',
    end: '2026-01-10T00:00:00Z',
    openEnded: false,
    parent: null,
    parts: [],
    featured: [],
    items: [],
    races: [],
    originals: [],
    ...fields,
  });
const card = (id: number, name: string) => ({ id, name, title: '[A Title]', card: true });

// JP's banners and events name characters in Japanese: their ids find the English name.
const jpCards = entry({ key: 'cards:1', group: 'cards', kind: 'cards', featured: [card(30001, 'スペシャルウィーク')] });
const trainees = entry({
  key: 'characters:2',
  group: 'characters',
  kind: 'characters',
  featured: [{ id: 100201, name: 'Silence Suzuka', title: '[Outfit]', card: false }],
});
const celebration = entry({ key: 'event:c', kind: 'celebration', name: 'Anniversary', parts: ['event:m'] });
const missions = entry({
  key: 'event:m',
  kind: 'missions',
  parent: 'event:c',
  featured: [card(30002, 'Silence Suzuka')],
  items: [{ name: 'Support Card Ticket', count: 1 }],
});
const entries = [jpCards, trainees, celebration, missions];
const index = searchIndex(entries, cards);
const term = (type: Term['type'], label: string): Term =>
  present(
    index.terms.find((t) => t.type === type && t.label === label),
    `${type} ${label}`
  );
const keys = (chips: Term[]) => [...searchResults(entries, chips, index).matched.map((e) => e.key)];

describe('the Timeline search', () => {
  it("labels characters in the calendar's language and still finds them by both names", () => {
    const labels = (language: Language) =>
      searchIndex(entries, cards, null, language)
        .terms.filter((t) => t.type === 'character')
        .map((t) => [t.label, t.aliases]);
    expect(labels(languageOf('gl', { fanTlGlobal: 'jp', jpNames: 'jp' }))).toEqual([
      ['スペシャルウィーク', ['Special Week']],
      ['サイレンススズカ', ['Silence Suzuka']],
    ]);
    // Official English: Global's name for a character it has, else Japanese.
    expect(labels(languageOf('jp', { fanTlGlobal: 'all', jpNames: 'official' })).map(([label]) => label)).toEqual([
      'Special Week',
      'サイレンススズカ',
    ]);
  });

  it('suggests one character for all their cards and outfits, by English name, found by the Japanese one too', () => {
    const special = term('character', 'Special Week');
    expect(special.aliases).toContain('スペシャルウィーク');
    expect(index.terms.filter((t) => t.type === 'character').map((t) => t.label)).toEqual([
      'Special Week',
      'Silence Suzuka',
    ]);
    expect(keys([term('character', 'Silence Suzuka')])).toEqual(['characters:2', 'event:m']);
  });

  it('ORs chips of one type and ANDs different types', () => {
    const suzuka = term('character', 'Silence Suzuka');
    const special = term('character', 'Special Week');
    expect(keys([suzuka, special])).toEqual(['cards:1', 'characters:2', 'event:m']);
    expect(keys([suzuka, term('type', 'Wit')])).toEqual(['event:m']);
    expect(keys([special, term('type', 'Wit')])).toEqual([]);
  });

  it('matches text against any field, card titles included', () => {
    expect(keys([textTerm('card tick')])).toEqual(['event:m']);
    expect(keys([textTerm('a title')])).toEqual(['cards:1', 'event:m']);
  });

  it("keeps a part's parent, unfolded, and a match's parts", () => {
    const byItem = searchResults(entries, [term('item', 'Support Card Ticket')], index);
    expect([...byItem.shown]).toEqual(['event:m', 'event:c']);
    expect([...byItem.unfold]).toEqual(['event:c']);
    const byName = searchResults(entries, [term('name', 'Anniversary')], index);
    expect([...byName.shown]).toEqual(['event:c', 'event:m']);
    expect([...byName.unfold]).toEqual([]);
  });

  it('jumps to the first match still running or ahead, else the last one before', () => {
    const at = (key: string, start: string, end: string) => entry({ key, start, end });
    const past = at('past', '2026-01-01T00:00:00Z', '2026-01-05T00:00:00Z');
    const live = at('live', '2026-02-01T00:00:00Z', '2026-03-01T00:00:00Z');
    const next = at('next', '2026-02-10T00:00:00Z', '2026-02-20T00:00:00Z');
    const now = Date.parse('2026-02-05T00:00:00Z');
    expect(jumpTarget([next, past, live], now)?.key).toBe('live');
    expect(jumpTarget([past, at('older', '2025-01-01T00:00:00Z', '2025-01-05T00:00:00Z')], now)?.key).toBe('past');
    expect(jumpTarget([], now)).toBeNull();
  });
});

describe('the Timeline search by pull advice', () => {
  it("suggests the verdicts of support card banners' cards, in the filter's colours", () => {
    const verdicts = new Map([['cards:1', new Set(['yes', 'free'] as const)]]);
    const withAdvice = searchIndex(entries, cards, (e) => verdicts.get(e.key) ?? new Set(['none'] as const));
    const pulls = withAdvice.terms.filter((t) => t.type === 'pull');
    expect(pulls.map((t) => [t.value, t.tone])).toEqual([
      ['yes', 'filter-pull-yes'],
      ['free', 'filter-pull-free'],
    ]);
    const yes = present(pulls[0]);
    expect(searchResults(entries, [yes], withAdvice).matched.map((e) => e.key)).toEqual(['cards:1']);
    expect(index.terms.some((t) => t.type === 'pull')).toBe(false);
  });
});
