// What a model is asked about the fields the rules doubt, and how its answers fill them in
// (scripts/lib/event-questions.js); the doubts themselves (scripts/lib/events.js, event-rewards.js).

import { describe, expect, it } from 'vitest';
import { copiesDoubt, itemDoubt } from '../scripts/lib/event-rewards.js';
import {
  FIELD_VERSIONS,
  applyAnswer,
  askedFields,
  mergeAnswer,
  question,
  staleFields,
} from '../scripts/lib/event-questions.js';
import { parseJson } from '../scripts/lib/ai.js';
import { ja } from '../scripts/lib/news-lang/ja.js';

const TEXT = [
  'As of 10:00 p.m., Aug 26, 2026 (UTC), an Umayuru Login Bonus has begun!',
  "Over the course of this event, you'll be able to receive a series of 150-carat gifts by logging in during the applicable periods!",
  '10:00 p.m., Aug 26 - 2:59 p.m., Sep 2, 2026 (UTC)',
  '3:00 p.m., Dec 23 - 2:59 p.m., Dec 30, 2026 (UTC)',
  'Trainers will also be gifted with the SSR Support Card "[U & Me] Mihono Bourbon"!',
  'It can be obtained up to two times in the Login Bonus, and up to three times in the Missions, for a maximum of five times!',
];
const event = (fields = {}) => ({
  id: '994-1',
  posted: '2026-08-26T22:00:00.000Z',
  kind: 'login_bonus',
  name: 'Umayuru Login Bonus',
  parent: '994',
  start: '2026-08-26T22:00:00.000Z',
  end: '2026-12-30T14:59:00.000Z',
  cards: [{ id: 30121, rarity: 'SSR', title: 'U & Me', name: 'Mihono Bourbon', copies: 2 }],
  items: [],
  titles: [],
  text: TEXT.join('\n'),
  doubts: { items: 'an amount in a sentence', cards: 'copies in several places' },
  ...fields,
});

describe('doubts', () => {
  it('doubts amounts in sentences the rules left unread, or given per day; not list lines or purchases', () => {
    expect(itemDoubt(TEXT, [])).toMatch(/150-carat/);
    expect(
      itemDoubt(['each day you log in, you will receive a gift of 300 carats'], [{ name: 'Carats', count: 300 }])
    ).toMatch(/per day/);
    expect(itemDoubt(['Login Day 1: Carats × 150'], [{ name: 'Carats', count: 150 }])).toBeNull();
    expect(itemDoubt(['• 1.5-Year Anniv. Celebration 7,500 Carats (3 times only)'], [])).toBeNull();
  });

  it('doubts copies given in several places, or talked about but not read', () => {
    expect(copiesDoubt(TEXT, event().cards)).toMatch(/several/); // "up to two … up to three … five times"
    expect(copiesDoubt(['You can get a total of five copies of it!'], event().cards)).toBeNull();
    expect(
      copiesDoubt(['You can get a total of five copies.', 'Up to two copies from missions.'], event().cards)
    ).toMatch(/several/);
    expect(copiesDoubt(['Get copies of it!'], [{ ...event().cards[0], copies: null }])).toMatch(/didn't read/);
  });
});

describe('question', () => {
  it('asks only the doubted fields, about the event its own text', () => {
    const q = question(event());
    expect(Object.keys(q.schema.properties)).toEqual(['items', 'cards']);
    expect(q.user).toContain('[U & Me] Mihono Bourbon');
    expect(q.user).toContain('series of 150-carat gifts');
  });

  it('asks every field when comparing, kind only for sub-events', () => {
    expect(Object.keys(question(event(), { all: true }).schema.properties)).toEqual([
      'items',
      'cards',
      'name',
      'kind',
      'start',
      'end',
    ]);
    expect(question(event({ kind: 'story', cards: [] }), { all: true }).schema.properties).not.toHaveProperty('kind');
  });
});

describe('applyAnswer', () => {
  const answer = {
    items: [
      { name: '150-carat gifts', each: 150, times: 22, total: null },
      { name: 'Invented Item', each: 5, times: 1, total: null },
    ],
    cards: [{ title: 'SSR Support Card [U & Me] Mihono Bourbon', copies: 5 }],
    name: 'Umayuru Login Bonus',
    kind: 'gift',
    start: '2026-08-26 22:00',
    end: '2026-12-30 14:59',
  };

  it('fills the doubted fields with answers that check out, leaves what the rules are sure of', () => {
    const e = applyAnswer(event(), answer);
    expect(e.items).toEqual([{ name: 'Carats', count: 3300 }]); // "Invented Item" isn't in the text
    expect(e.cards[0].copies).toBe(5);
    expect(e.kind).toBe('login_bonus'); // not doubted
  });

  it('fills empty fields too, never a value the rules are sure of', () => {
    const e = applyAnswer(event({ doubts: {}, cards: [{ ...event().cards[0], copies: null }] }), answer);
    expect(e.cards[0].copies).toBe(5); // empty: filled
    expect(applyAnswer(event({ doubts: {} }), answer).cards[0].copies).toBe(2); // sure: kept
  });

  it('takes everything valid when trusting the model (--compare)', () => {
    expect(applyAnswer(event(), answer, { trustModel: true }).kind).toBe('gift');
  });

  it('takes card copies a model put among the items, and drops amounts from item names', () => {
    const e = applyAnswer(event(), {
      items: [
        { name: 'SSR Support Card [U & Me] Mihono Bourbon', each: 5, times: 1, total: null },
        { name: '150 carats', each: 150, times: 22, total: null },
      ],
    });
    expect(e.cards[0].copies).toBe(5);
    expect(e.items).toEqual([{ name: 'Carats', count: 3300 }]);
  });

  it("takes only names for a mission set (its post's amounts are other things')", () => {
    const set = event({ id: '1001-m3', kind: 'missions', cards: [], doubts: { items: 'only in sentences' } });
    expect(applyAnswer(set, { items: [{ name: 'Carats', each: 50000, times: 1, total: null }] }).items).toEqual([
      { name: 'Carats', count: null },
    ]);
  });

  it('takes copies only when the post gives that number for the card, here or elsewhere in the post', () => {
    const missions = event({
      id: '634-12',
      kind: 'missions',
      text: 'You can earn rewards like carats and SSR [U & Me] Mihono Bourbon in the 1st Anniversary missions!',
      cards: [{ ...event().cards[0], copies: null }],
      doubts: {},
    });
    const copies = (e, n) => applyAnswer(e, { cards: [{ title: 'U & Me', copies: n }] }).cards[0].copies;
    expect(copies(missions, 1)).toBeNull(); // "1st" isn't a count, naming the card isn't "1"
    const told = {
      ...missions,
      context: ['It can be obtained up to two times in the Login Bonus, and up to three times in the Missions!'],
    };
    expect(copies(told, 3)).toBe(3);
    expect(copies(told, 4)).toBeNull();
  });

  it('rejects invalid answers', () => {
    const bad = {
      items: [{ name: 'Carats', each: -1, times: 1, total: null }],
      cards: [{ title: 'U & Me', copies: 99 }],
      start: 'soon',
      name: 'A Legend Race',
    };
    const e = applyAnswer(event(), bad);
    expect(e.items).toEqual([]);
    expect(e.cards[0].copies).toBe(2);
    expect(e.start).toBe(event().start);
    expect(e.name).toBe(event().name);
  });

  it('prefers a total the text states, rejects dates a year off', () => {
    const e = applyAnswer(event({ posted: '2025-08-26T22:00:00.000Z' }), {
      items: [{ name: 'Carats', each: 564, times: 10, total: 5640 }],
      start: '2026-08-26 22:00',
    });
    expect(e.items).toEqual([{ name: 'Carats', count: 5640 }]);
    expect(e.start).toBe(event().start);
  });
});

describe('parseJson', () => {
  it('finds the JSON in a reply wrapped in fences or words', () => {
    expect(parseJson('Sure!\n```json\n{"name": "x"}\n```')).toEqual({ name: 'x' });
    expect(() => parseJson('no json here')).toThrow();
  });
});

describe('asking again', () => {
  it("asks only where the post may hold an answer: not amountless items, not a Legend Race's name", () => {
    expect(askedFields(event({ doubts: {}, items: [{ name: 'Carats', count: null }], cards: [] }))).toEqual([]);
    expect(askedFields(event({ doubts: {}, kind: 'legend_race', name: null, cards: [] }))).toEqual([]);
    expect(askedFields(event({ doubts: {}, cards: [{ ...event().cards[0], copies: null }] }))).toEqual(['cards']);
  });

  it('re-asks only the fields whose question changed, and merges the new answer in', () => {
    const e = event({ doubts: { items: 'x', dates: 'y' } });
    const old = { model: 'm', version: 3, answer: { items: [], start: '2026-08-26 22:00', end: null } }; // before per-field versions
    expect(staleFields(e, old)).toEqual(FIELD_VERSIONS.items > 1 ? ['items'] : []);
    expect(staleFields(e, undefined)).toEqual(['items', 'dates']);
    const merged = mergeAnswer(
      old,
      ['items'],
      { items: [{ name: 'Carats', each: 150, times: 22, total: null }] },
      'm2'
    );
    expect(merged.answer.start).toBe('2026-08-26 22:00');
    expect(merged.answer.items).toHaveLength(1);
    expect(staleFields(e, merged)).toEqual([]);
  });
});

// JP's posts (Japanese, times in JST, years mostly left out): made-up text in their style.
const TEXT_JA = [
  '12/26 12:00から「ゆく年くる年ログインボーナス」を開催中です！',
  '開催期間中にログインすると、1日ジュエルを150個、最大で2250個のジュエルをプレゼントいたします！',
  'SSRサポートカード「[ためしの一枚]サンプルウマ娘」を、ログインボーナスで最大2枚獲得できます！',
  'イベント限定称号「ゆく年くる年」も獲得できます。',
  '開催期間',
  '12/26 12:00 ～ 1/9 4:59',
];
const eventJa = (fields = {}) => ({
  id: '2314-3',
  posted: '2025-12-20T03:00:00.000Z',
  kind: 'login_bonus',
  name: 'ゆく年くる年ログインボーナス',
  parent: '2314',
  start: '2025-12-26T03:00:00.000Z',
  end: '2026-01-08T19:59:00.000Z',
  cards: [{ id: 99999, rarity: 'SSR', title: 'ためしの一枚', name: 'サンプルウマ娘', copies: null }],
  items: [{ name: 'Carats', count: 150, local: 'ジュエル' }],
  titles: [],
  text: TEXT_JA.join('\n'),
  doubts: { items: 'per day', dates: 'from a sentence' },
  ...fields,
});

describe('JP questions', () => {
  it('asks in JP terms: times in JST, the post date, cards as the posts write them', () => {
    const q = question(eventJa(), { all: true, lang: ja });
    expect(q.system).toMatch(/JST/);
    expect(q.system).not.toMatch(/UTC/);
    expect(q.user).toContain('(2025-12-26 12:00 to 2026-01-09 04:59 JST, as read so far)');
    expect(q.user).toContain('Posted: 2025-12-20');
    expect(q.user).toContain('「[ためしの一枚]サンプルウマ娘」');
    expect(q.user).toContain('最大で2250個');
    expect(q.schema.properties.kind.enum).toContain('special');
    // Kinds only for a celebration's sub-events (JP's top-level events can be `special` too).
    expect(
      question(eventJa({ parent: null, kind: 'special' }), { all: true, lang: ja }).schema.properties
    ).not.toHaveProperty('kind');
  });

  it('is the English question unless asked for JP', () => {
    expect(question(event()).system).toMatch(/UTC/);
    expect(question(event()).user).not.toContain('Posted:');
  });
});

describe('JP answers', () => {
  const apply = (answer, fields) => applyAnswer(eventJa(fields), answer, { lang: ja });

  it('maps item names to Global names, keeping the Japanese, and multiplies', () => {
    const e = apply({
      items: [
        { name: '「ジュエル」', each: 150, times: 15, total: null },
        { name: 'マニー', each: 100, times: 1, total: null }, // not in the text
        { name: 'イベント限定称号「ゆく年くる年」', each: 1, times: 1, total: null }, // a title
        { name: '[ためしの一枚]サンプルウマ娘', each: 2, times: 1, total: null }, // a card's copies
      ],
    });
    expect(e.items).toEqual([{ name: 'Carats', count: 2250, local: 'ジュエル' }]);
    expect(e.cards[0].copies).toBe(2);
    expect(apply({ items: [{ name: 'ジュエル', each: 150, times: null, total: 2250 }] }).items[0].count).toBe(2250);
  });

  it('takes copies the post gives as a digit (枚), never one it only names', () => {
    const copies = (n) => apply({ cards: [{ title: 'ためしの一枚', copies: n }] }).cards[0].copies;
    expect(copies(2)).toBe(2);
    expect(copies(3)).toBeNull();
    const named = { text: 'ミッションをクリアすると「[ためしの一枚]サンプルウマ娘」などの報酬を獲得できます！' };
    expect(
      applyAnswer(eventJa(named), { cards: [{ title: 'ためしの一枚', copies: 1 }] }, { lang: ja }).cards[0].copies
    ).toBeNull();
  });

  it('reads dates as JST in the year nearest the post, an end before the start in the next year', () => {
    const e = apply({ start: '2025-12-26 12:00', end: '2025-01-09 04:59' }); // the year slipped: still January after
    expect(e.start).toBe('2025-12-26T03:00:00.000Z');
    expect(e.end).toBe('2026-01-08T19:59:00.000Z');
    expect(apply({ start: '2026-02-30 12:00', end: null }).start).toBe(eventJa().start); // no such day
    expect(apply({ start: '2027-12-26 12:00', end: null }).start).toBe('2025-12-26T03:00:00.000Z'); // the post's year
  });

  it("takes names the text has, not a kind's generic one; kinds only for sub-events", () => {
    const named = (name) => apply({ name }, { name: '対象のトレーナー', doubts: { name: 'a heading' } }).name;
    expect(named('ゆく年くる年ログインボーナス')).toBe('ゆく年くる年ログインボーナス');
    expect(named('ログインボーナス')).toBe('対象のトレーナー');
    expect(named('冬のログインボーナス')).toBe('対象のトレーナー'); // not in the text
    const kind = (fields) => applyAnswer(eventJa(fields), { kind: 'special' }, { lang: ja, trustModel: true }).kind;
    expect(kind({})).toBe('special');
    expect(kind({ parent: null, kind: 'campaign' })).toBe('campaign');
  });
});
