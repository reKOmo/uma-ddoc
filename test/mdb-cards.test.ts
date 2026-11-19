import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { UpstreamCard } from '../scripts/lib/cards/build.ts';
import { convertMdb, toRows, toStored, withUpstreamForSkipped } from '../scripts/lib/cards/mdb.ts';

// The four tables convertMdb reads, with master.mdb's columns; made-up cards.
const LEVELS = ['init', ...[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((l) => `limit_lv${l}`)];
const UNIQUE = [
  'id',
  'lv',
  ...[0, 1].flatMap((s) => [`type_${s}`, `value_${s}`, ...[1, 2, 3, 4].map((k) => `value_${s}_${k}`)]),
];

type CardRow = { id: number; chara_id: number; rarity: number; command_id: number; support_card_type: number };

function mdb({
  cards,
  effects = [],
  uniques = [],
  names = [],
}: {
  cards: CardRow[];
  effects?: [id: number, type: number, values: number[]][];
  uniques?: number[][];
  names?: [index: number, text: string][];
}): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE support_card_data (id, chara_id, rarity, command_id, support_card_type);
    CREATE TABLE support_card_effect_table (id, type, ${LEVELS.join(', ')});
    CREATE TABLE support_card_unique_effect (${UNIQUE.join(', ')});
    CREATE TABLE text_data (id, category, [index], text);`);
  const insert = (table: string, values: (number | string)[]): void => {
    db.prepare(`INSERT INTO ${table} VALUES (${values.map(() => '?').join(', ')})`).run(...values);
  };
  for (const c of cards) insert('support_card_data', [c.id, c.chara_id, c.rarity, c.command_id, c.support_card_type]);
  for (const [id, type, values] of effects) insert('support_card_effect_table', [id, type, ...values]);
  for (const u of uniques) insert('support_card_unique_effect', u);
  for (const [index, text] of names) insert('text_data', [170, 170, index, text]);
  return db;
}

const SSR_SPEED: CardRow = { id: 30001, chara_id: 1001, rarity: 3, command_id: 101, support_card_type: 1 };
// SSR: LB0…LB4 read limit_lv30…limit_lv50.
const ssrLevels = (lb: number[]): number[] => [1, 2, 3, 4, 5, 6, ...lb];

describe('convertMdb', () => {
  it('fills a level without a value (-1) between the levels around it, rounding down', () => {
    const { rows } = convertMdb(mdb({ cards: [SSR_SPEED], effects: [[30001, 14, ssrLevels([10, -1, -1, 16, 20])]] }));
    expect(rows.map((r) => r.sb)).toEqual([10, 12, 14, 16, 20]);
  });

  it('keeps the last value past the highest level that has one', () => {
    const { rows } = convertMdb(mdb({ cards: [SSR_SPEED], effects: [[30001, 8, ssrLevels([5, 10, -1, -1, -1])]] }));
    expect(rows.map((r) => r.tb)).toEqual([1.05, 1.1, 1.1, 1.1, 1.1]);
  });

  it("gives every limit break the card's fields and name, sorted by id", () => {
    const group: CardRow = { id: 30002, chara_id: 9001, rarity: 3, command_id: 0, support_card_type: 3 };
    const { rows } = convertMdb(mdb({ cards: [group, SSR_SPEED], names: [[1001, 'Made-up Runner']] }));
    expect(rows.map((r) => [r.id, r.limit_break])).toEqual(
      [0, 1, 2, 3, 4, 0, 1, 2, 3, 4].map((lb, i) => [i < 5 ? 30001 : 30002, lb])
    );
    expect(rows[0]).toMatchObject({
      type: 0,
      group: false,
      rarity: 3,
      char_name: 'Made-up Runner',
      offstat_appearance_denominator: 4,
    });
    expect(rows[5]).toMatchObject({ type: 6, group: true, char_name: '', offstat_appearance_denominator: 5 });
  });

  it('reads both unique effect slots', () => {
    // Slot 0: 101 with bonuses 3 (+2 speed) and 41 (+1 to each stat); slot 1: 103 (highlander 3 cards, 20%).
    const unique = [30001, 1, 101, 0, 3, 2, 41, 1, 103, 3, 20, 0, 0, 0];
    const { rows } = convertMdb(mdb({ cards: [SSR_SPEED], uniques: [unique] }));
    expect(rows[0]).toMatchObject({ fs_stats: [3, 1, 1, 1, 1, 0], highlander_threshold: 3, highlander_training: 0.2 });
  });

  it("skips a card with an effect the converter doesn't know, naming it", () => {
    const other: CardRow = { ...SSR_SPEED, id: 30003 };
    const unknownCommand: CardRow = { ...SSR_SPEED, id: 30004, command_id: 999 };
    const { rows, skipped } = convertMdb(
      mdb({
        cards: [SSR_SPEED, other, unknownCommand],
        effects: [[30001, 999, ssrLevels([1, 1, 1, 1, 1])]],
        uniques: [[30003, 1, 101, 0, 77, 5, 0, 0, 0, 0, 0, 0, 0, 0]],
      })
    );
    expect(rows).toEqual([]);
    expect(skipped).toEqual([
      { id: 30001, unknown: ['effect 999'] },
      { id: 30003, unknown: ['unique 101 bonus 77'] },
      { id: 30004, unknown: ['command_id 999'] },
    ]);
  });
});

describe('withUpstreamForSkipped', () => {
  const row = (id: number, limit_break: number, sb: number) => ({ id, limit_break, sb }) as UpstreamCard;

  it("adds upstream's rows for the cards we skipped, and only those", () => {
    const ours = [row(10001, 0, 9), row(30010, 0, 9)];
    const upstream = [row(10001, 0, 1), row(20001, 0, 1), row(30005, 0, 1)];
    const skipped = [
      { id: 20001, unknown: ['effect 999'] },
      { id: 30020, unknown: ['effect 999'] },
    ];
    expect(withUpstreamForSkipped(ours, skipped, upstream).map((c) => [c.id, c.sb])).toEqual([
      [10001, 9],
      [30010, 9],
      [20001, 1],
    ]);
  });
});

describe('toStored / toRows', () => {
  it('stores a card once with its five limit breaks, and gives back the same rows sorted', () => {
    const db = mdb({
      cards: [{ ...SSR_SPEED, id: 30005 }, SSR_SPEED],
      effects: [[30001, 14, ssrLevels([10, 11, 12, 13, 14])]],
      names: [[1001, 'Made-up Runner']],
    });
    const { rows } = convertMdb(db);
    const stored = toStored([...rows].reverse());
    expect(Object.keys(stored)).toEqual(['30001', '30005']);
    expect(stored['30001']).toMatchObject({ type: 0, group: false, rarity: 3, charName: 'Made-up Runner' });
    expect(stored['30001'].lb.map((s) => s.sb)).toEqual([10, 11, 12, 13, 14]);
    expect(toRows(stored)).toEqual(rows);
  });
});
