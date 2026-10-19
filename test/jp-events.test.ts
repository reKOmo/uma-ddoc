import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CM_PHASES, EVENT_KINDS, buildEvents, eventsFile, postEvents } from '../scripts/lib/events.ts';
import { cardIndex } from '../scripts/lib/event-rewards.ts';
import { cmPhasesFrom, cutEvents, fillFromGametora, gametoraEvents } from '../scripts/lib/gametora-events.ts';
import { postsFile } from '../scripts/lib/news-api.ts';
import { ja } from '../scripts/lib/news-lang/ja.ts';
import { GENERATED_DIR } from '../scripts/lib/paths.ts';
import { EVENT_GROUPS } from '../src/timeline/events.ts';
import { eventEntries } from '../src/timeline/entries.ts';
import { type LaneItem, laneGroups } from '../src/timeline/layout.ts';
import type { Entry } from '../src/timeline/entries.ts';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { EventCard, GameEvent } from '../shared/schemas/event.ts';
import type { NewsPost } from '../shared/schemas/news.ts';
import { at, fixture, present } from './helpers.ts';

const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8'));
const plainDates = (e: GameEvent) => ({
  ...e,
  start: e.start.date,
  end: e.end?.date ?? null,
  ...(e.phases && { phases: e.phases.map((p) => ({ ...p, start: p.start.date, end: p.end?.date ?? null })) }),
});
const cardsFile = `${GENERATED_DIR}cards.json`;
const cards: CardsFile = existsSync(cardsFile) ? read<CardsFile>(cardsFile) : {};
// Card lookups need GameTora's Japanese titles (pnpm scrape-gametora).
const withJp = cards['30113']?.title?.jp != null;
const index = cardIndex(cards, ja);

const file = postsFile('jp');
describe.skipIf(!existsSync(file))('JP events from the sampled posts', () => {
  const posts = read<NewsPost[]>(file);
  const byId = new Map(posts.map((p) => [String(p.announce_id), p]));
  const post = (id: number) => present(byId.get(String(id)), `post ${id}`);
  const of = (id: number) => postEvents(post(id), index, ja);
  const one = (id: number) => {
    const events = of(id);
    expect(events).toHaveLength(1);
    return events[0];
  };
  // (the dates alone: every one here is the news')
  const build = (...ids: number[]) => buildEvents(ids.map(post), { cards, lang: ja }).map(plainDates);
  const copies = (e: { cards: EventCard[] }) => e.cards.map((c) => [c.id, c.copies]);

  it('reads a story event: dates in JST, its SSR and its title', () => {
    const e = one(915);
    expect(e).toMatchObject({
      kind: 'story',
      name: '鉄翼蒸気奇譚',
      start: '2022-08-29T03:00:00.000Z',
      end: '2022-09-12T02:59:00.000Z',
      titles: ['鉄翼蒸気奇譚'],
      items: [],
      news_url: 'https://umamusume.jp/news/detail/?id=915',
    });
    expect(one(3481)).toMatchObject({ start: '2026-09-30T03:00:00.000Z', end: '2026-10-13T02:59:00.000Z' });
    if (withJp) {
      expect(copies(e)).toEqual([[30113, null]]); // story posts never say how many copies
      expect(copies(one(3481))).toEqual([[30321, null]]);
    }
  });

  it('merges a story announced with a typo in its name (乱華 / 爛華)', () => {
    const events = build(3220, 3221);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: '3220', name: '紅蓮の咆哮 白焔の爛華' });
  });

  it("reads a Champions Meeting's schedule, from its league selection", () => {
    const e = one(810);
    expect(e).toMatchObject({ kind: 'champions_meeting', name: 'ジェミニ杯', start: '2022-06-10T03:00:00.000Z' });
    expect(present(e.phases, 'phases').map((p) => p.key)).toEqual(CM_PHASES.map(([key]) => key));
    expect(e.end).toBe(present(present(e.phases, 'phases').at(-1), 'last phase').end);
    expect(e.titles).toEqual(['ジェミニ杯プラチナ', 'ジェミニ杯ゴールド', 'ジェミニ杯シルバー', 'ジェミニ杯ブロンズ']);
    expect(e.items).toEqual([
      { name: 'Toughness 30', count: 3, local: 'タフネス30' },
      { name: 'Alarm Clock', count: 3, local: '目覚まし時計' },
    ]);
    const [cup] = build(3463, 3464);
    expect(cup).toMatchObject({ id: '3463', name: 'CLASSIC', start: '2026-09-26T03:00:00.000Z' });
    expect(cup.titles).toContain('凱旋門に刻む蹄跡');
  });

  it('merges a cup announced two months ahead without dates ("9月下旬") into the cup', () => {
    const events = build(2670, 2776, 2777);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: '2670', start: '2025-09-19T03:00:00.000Z' });
    expect(events[0].phases).toHaveLength(6);
  });

  it('reads Legend Races: every race, items without amounts', () => {
    expect(one(404)).toMatchObject({ kind: 'legend_race', name: null, start: '2021-09-14T03:00:00.000Z' });
    const e = one(806);
    expect(e).toMatchObject({ start: '2022-06-24T03:00:00.000Z', end: '2022-06-29T19:59:00.000Z' });
    expect(e.items).toContainEqual({ name: 'Rainbow Crystal Shards', count: null, local: '虹の結晶片' });
    expect(e.items).toContainEqual({ name: 'Gold Crystal Shards', count: null, local: '金の結晶片' });
    expect(one(3426)).toMatchObject({ start: '2026-09-06T03:00:00.000Z', end: '2026-09-11T19:59:00.000Z' });
  });

  it('reads a League of Heroes: no name, its schedule from team formation, its titles but not placeholders', () => {
    const e = one(3380);
    expect(e).toMatchObject({ kind: 'league_of_heroes', name: null, start: '2026-08-11T03:00:00.000Z' });
    expect(present(e.phases, 'phases').map((p) => p.key)).toEqual(
      present(ja.schedules, 'JP schedules').league_of_heroes.map(([key]) => key)
    );
    expect(e.titles).toContain('英雄譚');
    expect(e.titles.some((t) => t.includes('○'))).toBe(false);
    expect(e.items.some((i) => /称号/.test(i.name))).toBe(false);
    const [league] = build(3379, 3380);
    expect(league).toMatchObject({ id: '3379', end: '2026-08-23T02:59:00.000Z' });
  });

  it("reads specials: an event's own period, not when rewards are collected", () => {
    // 技能試験 posts open with the period heading, no sentence
    expect(one(3313)).toMatchObject({
      kind: 'special',
      name: 'トレーナー技能試験',
      start: '2026-06-29T03:00:00.000Z',
      end: '2026-07-10T02:59:00.000Z',
    });
    expect(one(3331)).toMatchObject({
      kind: 'factor_research',
      name: 'アグネスタキオンの因子研究',
      start: '2026-07-10T03:00:00.000Z',
      end: '2026-07-21T02:59:00.000Z',
    });
  });

  it("cuts a celebration at its parts' art: login bonus, gift, missions, shop, sale; no scouts or summaries", () => {
    const events = of(902);
    const parts = events.filter((e) => e.parent === '902');
    expect(events[0]).toMatchObject({ kind: 'celebration', start: '2022-08-24T03:00:00.000Z', items: [] });
    expect(parts.map((e) => e.kind).sort()).toEqual(
      ['campaign', 'campaign', 'campaign', 'campaign', 'gift', 'login_bonus', 'missions', 'sale', 'shop'].sort()
    );
    // the paid ★3/SSR scouts aren't parts, nor is the block summing up the card's copies
    expect(parts.some((e) => /ガチャ」?$|確定/.test(e.name ?? ''))).toBe(false);
    const byKind = Object.fromEntries(parts.map((e) => [e.kind, e]));
    // a gift sent without a period: from the post to the deadline of who gets it
    expect(byKind.gift).toMatchObject({
      name: 'ジュエル3000個',
      start: '2022-08-24T03:00:00.000Z',
      end: '2022-09-29T02:59:00.000Z',
      items: [{ name: 'Carats', count: 3000, local: 'ジュエル' }],
    });
    // login prose: "1日ジュエルを300個、…最大で3000個のジュエル"
    expect(byKind.login_bonus.items).toEqual([{ name: 'Carats', count: 3000, local: 'ジュエル' }]);
    expect(byKind.sale.name).toBe('1.5th Anniv.記念 3回限定 ジュエル 7500個');
    if (withJp) {
      // "「…ログインボーナス」で最大2枚、「…ミッション第2弾」で最大3枚、合計5枚"
      expect(copies(byKind.login_bonus)).toEqual([[30121, 2]]);
      expect(copies(byKind.missions)).toEqual([[30121, 3]]);
      const parts3407 = of(3407).filter((e) => e.cards.length);
      expect(parts3407.map((e) => [e.kind, ...copies(e)])).toEqual([
        ['login_bonus', [30313, 2]],
        ['missions', [30313, 3]],
      ]);
    }
  });

  it('splits an intro off a celebration, so its first art starts a part', () => {
    const events = of(657);
    expect(events[0].items).toEqual([]);
    expect(events.find((e) => e.kind === 'login_bonus')).toMatchObject({
      start: '2022-03-07T03:00:00.000Z',
      items: [{ name: 'Carats', count: 2250, local: 'ジュエル' }],
    });
    expect(
      present(
        events.find((e) => e.kind === 'missions'),
        'event'
      ).items
    ).toContainEqual({
      name: '1st Anniversary SSR Voucher',
      count: null,
      local: '1st Anniversary SSR引換券',
    });
  });

  it('reads New Year parts across the year, and skips the scouts it links to', () => {
    const events = of(2984);
    expect(events.find((e) => e.name === 'お正月特別ログインボーナス')).toMatchObject({
      start: '2025-12-31T20:00:00.000Z',
      end: '2026-01-29T19:59:00.000Z',
      items: [{ name: 'Carats', count: 4200, local: 'ジュエル' }],
    });
    expect(events.some((e) => /ガチャ」?$/.test(e.name ?? '') && !/無料/.test(e.name ?? ''))).toBe(false);
  });

  it('reads login days, mission sets in one period, dated gift rows', () => {
    const christmas = present(
      of(1093).find((e) => e.kind === 'gift' && /クリスマスプレゼント/.test(e.name ?? '')),
      'Christmas gift'
    );
    expect(christmas.items).toContainEqual({ name: 'Carats', count: 650, local: 'ジュエル' });
    expect(christmas.items).toContainEqual({ name: 'Support Points', count: 5000, local: 'サポートPt' });
    const g1 = of(3233);
    expect(
      present(
        g1.find((e) => e.kind === 'gift'),
        'event'
      ).items
    ).toEqual([{ name: 'Monies', count: 600000, local: 'マニー' }]);
    const [missions] = buildEvents([post(3233)], { lang: ja })
      .filter((e) => e.parent === '3233-1')
      .map(plainDates);
    expect(missions).toMatchObject({
      kind: 'missions',
      name: '帝王賞応援の期間限定ミッション',
      start: '2026-06-24T20:00:00.000Z',
    });
    expect(buildEvents([post(3233)], { lang: ja }).filter((e) => e.parent === '3233-1')).toHaveLength(4);
    // "「目覚まし時計」×50、「タフネス30」×10" on ten dated rows
    expect(
      present(
        of(2559).find((e) => e.items.length),
        'event'
      ).items
    ).toEqual([
      { name: 'Alarm Clock', count: 500, local: '目覚まし時計' },
      { name: 'Toughness 30', count: 100, local: 'タフネス30' },
    ]);
  });

  it('counts a card given once per episode, and 26 weekly login windows into the next year', () => {
    const events = of(3466);
    expect(events.find((e) => e.kind === 'login_bonus')).toMatchObject({
      kind: 'login_bonus',
      start: '2026-09-27T14:00:00.000Z',
      end: '2027-04-04T19:59:00.000Z',
      items: [{ name: 'Carats', count: 3900, local: 'ジュエル' }],
    });
    if (withJp)
      expect(
        copies(
          present(
            events.find((e) => e.kind === 'gift'),
            'event'
          )
        )
      ).toEqual([[30318, 5]]);
    // "第1話から第3話では1枚ずつ、第4話では2枚の合計5枚"
    if (withJp)
      expect(
        copies(
          present(
            of(2525).find((e) => e.kind === 'gift'),
            'event'
          )
        )
      ).toEqual([[30260, 5]]);
  });

  it('reads gifts once, until the deadline of who gets them', () => {
    expect(one(1743)).toMatchObject({
      kind: 'gift',
      start: '2024-01-31T06:00:00.000Z',
      end: '2024-02-29T14:59:00.000Z',
      items: [{ name: 'Carats', count: 3000, local: 'ジュエル' }],
    });
    expect(one(2657).items).toEqual([{ name: 'Carats', count: 1500, local: 'ジュエル' }]);
  });

  it('reads login bonuses: once-only prose, day headers', () => {
    expect(one(1567)).toMatchObject({
      kind: 'login_bonus',
      items: [{ name: 'Carats', count: 500, local: 'ジュエル' }],
    });
    const gold = present(
      of(3210).find((e) => e.kind === 'login_bonus'),
      'login bonus'
    );
    expect(gold.items).toHaveLength(6);
    expect(gold.items[0]).toEqual({ name: 'GOLDコイン/フェノーメノ', count: 1 });
  });

  it("lists nothing a sale's buyers pay for", () => {
    const events = build(3472);
    const sale = present(
      events.find((e) => e.kind === 'sale'),
      'sale'
    );
    expect(sale.items).toEqual([]);
    expect(events.flatMap((e) => e.items).some((i) => /有償/.test(i.name))).toBe(false);
  });

  it('merges a celebration announced a week ahead into the running one', () => {
    const events = build(2363, 2372).filter((e) => !e.parent);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: '2363', news_url: 'https://umamusume.jp/news/detail/?id=2372' });
  });
});

describe("GameTora's story events, Champions Meetings and Legend Races", () => {
  const unix = (iso: string) => Date.parse(iso) / 1000;
  const raw = {
    story: [
      {
        id: 1003,
        name_ja: '花咲く乙女のJunePride',
        start_ja: unix('2021-05-28T03:00:00Z'),
        end_ja: unix('2021-06-10T02:59:59Z'),
        event_support_ids: [30041],
      },
      {
        id: 1015,
        name_ja: 'シーク・ソルヴ・サマーウォーク！',
        start_ja: unix('2022-06-30T03:00:00Z'),
        end_ja: unix('2022-07-11T02:59:59Z'),
        event_support_ids: [30104],
      },
    ],
    champions_meeting: [
      { id: 9, name: 'カプリコーン杯', start: unix('2022-01-22T03:00:00Z'), end: unix('2022-01-28T02:59:59Z') },
      { id: 10, name: 'アクエリアス杯', start: unix('2022-02-18T03:00:00Z'), end: unix('2022-02-24T02:59:59Z') },
    ],
    legend_race: [
      {
        id: null,
        name_ja: 'エリザベス女王杯',
        start: unix('2026-10-08T03:00:00Z'),
        end: unix('2026-10-13T19:59:59Z'),
        races: [],
      },
    ],
  };
  const news: GameEvent[] = [
    {
      id: '835',
      kind: 'story',
      name: 'シーク・ソルヴ・サマーウォーク！',
      parent: null,
      start: at('2022-06-30T03:00:00.000Z'),
      end: at('2022-07-11T02:59:00.000Z'),
      cards: [],
      items: [],
      titles: [],
      news_url: 'https://umamusume.jp/news/detail/?id=836',
      image: null,
      source: 'news',
    },
    {
      id: '526',
      kind: 'champions_meeting',
      name: 'カプリコーン杯',
      parent: null,
      start: at('2022-01-01T03:00:00.000Z'),
      end: null,
      cards: [],
      items: [],
      titles: [],
      phases: [],
      news_url: 'https://umamusume.jp/news/detail/?id=526',
      image: null,
      source: 'news',
    },
  ];
  const cardsJp = fixture<CardsFile>({
    30041: { rarity: 'SSR', title: { jp: '[おもい、ねがう]' }, name: { jp: 'メジロドーベル' } },
  });

  it("cuts GameTora's files to the fields read, races included", () => {
    const cut = cutEvents({
      'events/story-events': [{ ...raw.story[0], banners: [1], bonus_chars: [] }],
      'events/champions-meeting': [{ ...raw.champions_meeting[0], race: {}, name_en: 'Capricorn Cup' }],
      'events/legend-race': [
        { ...raw.legend_race[0], distance: 2200, races: [{ card_id: 1, start: 2, end: 3, boss_stats: [] }] },
      ],
    });
    expect(Object.keys(cut.story[0])).toEqual(['id', 'name_ja', 'start_ja', 'end_ja', 'event_support_ids']);
    expect(cut.champions_meeting[0]).not.toHaveProperty('name_en');
    expect(cut.legend_race[0].races).toEqual([{ card_id: 1, start: 2, end: 3 }]);
  });

  it('makes events of our shape: a story with its cards, a cup from round 1 with its schedule, an unnamed race', () => {
    const events = gametoraEvents(raw, cardsJp);
    expect(events.find((e) => e.id === 'gt-story-1003')).toEqual({
      id: 'gt-story-1003',
      kind: 'story',
      name: '花咲く乙女のJunePride',
      parent: null,
      start: at('2021-05-28T03:00:00.000Z', 'gametora'),
      end: at('2021-06-10T02:59:00.000Z', 'gametora'),
      cards: [{ id: 30041, rarity: 'SSR', title: 'おもい、ねがう', name: 'メジロドーベル', copies: null }],
      items: [],
      titles: [],
      news_url: null,
      image: null,
      source: 'gametora',
    });
    const cup = present(
      events.find((e) => e.id === 'gt-cm-10'),
      'cup'
    );
    const phases = present(cup.phases, 'phases');
    expect(cup.start).toEqual(at('2022-02-18T03:00:00.000Z', 'gametora'));
    expect(phases.map((p) => p.key)).toEqual(CM_PHASES.map(([key]) => key).filter((k) => k !== 'league_selection'));
    expect(phases.at(-1)).toEqual({
      key: 'final_race',
      start: at('2022-02-23T03:00:00.000Z', 'gametora'),
      end: cup.end,
    });
    expect(events.find((e) => e.kind === 'legend_race')).toMatchObject({ id: 'gt-lr-20261008', name: null });
  });

  it('has the same schedule as the news gives cups since mid-2022', () => {
    const e = read<GameEvent[]>(eventsFile('jp')).find((x) => x.id === '1065');
    if (!e) return;
    const phases = present(e.phases, 'phases');
    const round1 = present(
      phases.find((p) => p.key === 'round_1'),
      'round 1'
    );
    // (the same dates, GameTora's)
    const gametora = phases.slice(1).map((p) => ({
      ...p,
      start: { ...p.start, status: 'gametora' },
      end: p.end && { ...p.end, status: 'gametora' },
    }));
    expect(cmPhasesFrom(Date.parse(round1.start.date), Date.parse(present(e.end, 'end').date))).toEqual(gametora);
  });

  it('fills only before mid-2022 where the news has nothing of the kind, and dates a cup the news only announced', () => {
    const { events, filled, dated } = fillFromGametora(news, raw, cardsJp);
    // (The 2026 Legend Race waits for the news: GameTora lists newer events before the news dates them.)
    expect(filled.map((e) => e.id).sort()).toEqual(['gt-cm-10', 'gt-story-1003']);
    expect(events.some((e) => e.id === 'gt-lr-20261008')).toBe(false);
    expect(dated).toHaveLength(1);
    expect(events.find((e) => e.id === '526')).toMatchObject({
      start: at('2022-01-22T03:00:00.000Z', 'gametora'),
      end: at('2022-01-28T02:59:00.000Z', 'gametora'),
      news_url: 'https://umamusume.jp/news/detail/?id=526',
      source: 'news',
    });
    expect(events.find((e) => e.id === '835')).toBe(news[0]);
    // Idempotent: run over its own output, nothing more is added.
    expect(fillFromGametora(events, raw, cardsJp).events).toEqual(events);
  });
});

const stored = eventsFile('jp');
describe.skipIf(!existsSync(stored))('the stored JP events', () => {
  const events = read<GameEvent[]>(stored);
  const since = (kind: string, date: string) => events.filter((e) => e.kind === kind && e.start.date >= date);

  it('only uses kinds the app styles and labels, with dates in order', () => {
    expect(events.filter((e) => !EVENT_KINDS.includes(e.kind))).toEqual([]);
    expect(events.filter((e) => e.end && e.end.date < e.start.date).map((e) => e.id)).toEqual([]);
  });

  it.skipIf(!withJp)('gives every story event since mid-2022 its SSR', () => {
    const stories = since('story', '2022-06');
    expect(stories.length).toBeGreaterThan(40);
    expect(stories.filter((e) => !e.cards.some((c) => c.rarity === 'SSR')).map((e) => e.id)).toEqual([]);
  });

  it('gives every Champions Meeting since mid-2022 its schedule, every League of Heroes its own', () => {
    const keys = CM_PHASES.map(([key]) => key);
    for (const e of since('champions_meeting', '2022-06'))
      expect({ id: e.id, phases: e.phases?.map((p) => p.key) }).toEqual({ id: e.id, phases: keys });
    const loh = present(ja.schedules, 'JP schedules').league_of_heroes.map(([key]) => key);
    for (const e of since('league_of_heroes', '2023-05'))
      expect({ id: e.id, phases: e.phases?.map((p) => p.key) }).toEqual({ id: e.id, phases: loh });
  });

  it('lists no paid items, and keeps the Japanese name of what goes by Global’s', () => {
    const items = events.flatMap((e) => e.items);
    expect(items.filter((i) => /有償|回限定|称号/.test(i.name))).toEqual([]);
    expect(items.filter((i) => i.local && /[\p{Script=Katakana}\p{Script=Han}]/u.test(i.name))).toEqual([]);
    expect(items.filter((i) => i.name === 'Carats').every((i) => i.local === 'ジュエル')).toBe(true);
  });

  it("fills GameTora's events only before mid-2022, where the news has none of the kind, marked as GameTora's", () => {
    const filled = events.filter((e) => e.source === 'gametora');
    expect(filled.length).toBeGreaterThan(20);
    expect(filled.filter((e) => e.start.date >= '2022-07' || e.news_url || e.parent)).toEqual([]);
    const news = events.filter((e) => e.source === 'news' && !e.parent && e.end);
    // (an open end never overlaps, as comparing with null never did)
    const overlaps = (a: GameEvent, b: GameEvent) =>
      a.kind === b.kind && b.end != null && a.end != null && a.start.date <= b.end.date && b.start.date <= a.end.date;
    expect(filled.filter((g) => news.some((e) => overlaps(e, g))).map((e) => e.id)).toEqual([]);
    // With them, every story event since the launch has its SSR (but one the 2021 news names none for).
    expect(events.filter((e) => e.kind === 'story' && !e.cards.some((c) => c.rarity === 'SSR')).length).toBeLessThan(2);
  });

  it('links parts to an event that exists, and places every event in a group once', () => {
    const ids = new Set(events.map((e) => e.id));
    expect(events.filter((e) => e.parent && !ids.has(e.parent))).toEqual([]);
    const placed = (items: LaneItem<Entry>[]): Entry['id'][] =>
      items.flatMap((item) => [item.entry.id, ...placed(item.parts.flat())]);
    const all = laneGroups(eventEntries(events)).flatMap((g) => placed(g.rows.flat()));
    expect(all.sort()).toEqual(events.map((e) => e.id).sort());
    expect(EVENT_GROUPS.flatMap(([, kinds]) => kinds)).toContain('league_of_heroes');
  });
});
