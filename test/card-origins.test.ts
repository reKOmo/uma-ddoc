// Where a card comes from: banners and events giving it, oldest first, parts over the events listing them.

import { describe, it, expect } from 'vitest';
import { cardOrigins, originKinds } from '../src/cardOrigins.ts';
import type { Entry } from '../src/timeline/entries.ts';
import { fixture } from './helpers.ts';

type Options = { group?: string; kind?: string; paid?: boolean; parent?: string | null; cards?: [number, boolean?][] };
// (an entry with the fields cardOrigins() reads, and an id the tests name it by)
const entry = (
  key: string,
  start: string | null,
  { group = 'event', kind = group, paid = false, parent = null, cards = [] }: Options = {}
) =>
  fixture<Entry>({
    key,
    id: key.split(':')[1],
    group,
    kind,
    paid,
    parent,
    start,
    featured: cards.map(([id, isNew = true]) => ({ id, card: true, isNew })),
  });

describe('cardOrigins', () => {
  it('finds banners and events by kind, oldest first', () => {
    const entries = [
      entry('cards:1', '2025-01-01', { group: 'cards', cards: [[7]] }),
      entry('cards:2', '2025-06-01', { group: 'cards', cards: [[7, false]] }),
      entry('cards:3', '2025-07-01', { group: 'cards', paid: true, cards: [[7]] }),
      entry('event:s', '2025-03-01', { kind: 'story', cards: [[7]] }),
      entry('event:l', '2025-04-01', { kind: 'login_bonus', cards: [[7]] }),
      entry('event:x', '2025-05-01', { kind: 'shop', cards: [[7]] }),
      entry('event:o', '2025-05-02', { kind: 'special', cards: [[8]] }),
    ];
    const origins = cardOrigins(7, { gl: entries });
    expect(origins.map((o) => [o.entry.id, o.kind, o.rerun])).toEqual([
      ['1', 'banner', false],
      ['s', 'story', false],
      ['l', 'gift', false],
      ['x', 'shop', false],
      ['2', 'banner', true],
      ['3', 'paid_banner', false],
    ]);
    expect(originKinds(origins)).toEqual(['banner', 'story', 'gift', 'shop', 'paid_banner']);
    expect(origins.every((o) => o.server === 'gl')).toBe(true);
  });

  it('counts a part, not the event listing it too; other kinds are other', () => {
    const entries = [
      entry('event:c', '2025-01-01', { kind: 'celebration', cards: [[7]] }),
      entry('event:c-1', '2025-01-02', { kind: 'gift', parent: 'event:c', cards: [[7]] }),
      entry('event:p', '2025-02-01', { kind: 'special', cards: [[7]] }),
    ];
    expect(cardOrigins(7, { gl: entries }).map((o) => [o.entry.id, o.kind])).toEqual([
      ['c-1', 'gift'],
      ['p', 'other'],
    ]);
  });

  it('merges servers by date and skips undated entries', () => {
    const origins = cardOrigins(7, {
      gl: [entry('cards:9', '2026-12-01', { group: 'cards', cards: [[7]] }), entry('event:u', null, { cards: [[7]] })],
      jp: [entry('cards:9', '2026-01-01', { group: 'cards', cards: [[7]] })],
    });
    expect(origins.map((o) => o.server)).toEqual(['jp', 'gl']);
  });
});
