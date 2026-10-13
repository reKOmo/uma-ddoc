import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { CardsFileSchema } from '../shared/schemas/card.ts';
import { buildCards, fromGametora } from '../scripts/lib/cards.ts';
import { joinCards, withoutEvents } from '../tierlist/join-cards.ts';
import type { UpstreamCard } from '../scripts/lib/cards.ts';
import type { GametoraType } from '../shared/schemas/common.ts';
import type { GametoraCard } from '../shared/schemas/gametora.ts';
import type { JpCard, JpCardsFile } from '../shared/schemas/card.ts';
import { fixture, present } from './helpers.ts';

// Upstream's card objects for one card at every limit break.
const levels = (id: number, type: number, rarity: number, char_name: string, group = false) =>
  fixture<UpstreamCard[]>(
    [0, 1, 2, 3, 4].map((limit_break) => ({ id, type, group, rarity, limit_break, sb: 10 + limit_break, char_name }))
  );

const upstream = {
  gl: [...levels(30001, 0, 3, 'T.M. Opera O')],
  jp: [
    ...levels(30001, 0, 3, 'テイエムオペラオー'),
    ...levels(30081, 6, 3, 'スペシャルウィーク', true),
    ...levels(30126, 3, 3, 'テイエムオペラオー'),
  ],
  events: { 30001: [1, 2, 3, 4, 5, 6, 7, 8] },
};
const gt = (
  support_id: number,
  char_id: number,
  char_name: string,
  name_jp: string,
  type: GametoraType,
  extra: Partial<GametoraCard> = {}
): GametoraCard => ({
  support_id,
  char_id,
  char_name,
  name_jp,
  title_en: `[GT ${support_id}]`,
  title_ja: `[JP ${support_id}]`,
  type,
  rarity: 3,
  release: '2022-01-01',
  obtained: 'gacha',
  url_name: `${support_id}-x`,
  ...extra,
});
const gametora = [
  gt(30001, 1015, 'TM Opera O', 'テイエムオペラオー', 'speed'),
  gt(30081, 1001, 'Team Sirius', 'チーム＜シリウス＞', 'group', { obtained: 'main_story' }),
  gt(30126, 1015, 'TM Opera O', 'テイエムオペラオー', 'guts'),
  gt(30200, 1099, 'New Girl', '新人', 'intelligence', { obtained: 'story_event' }),
];
const globalCards = { 30001: { title_en: '[Our title]', release_gl: '2026-01-01' } };
// The history: everything GameTora has but its newest card (30200), which the news hasn't shown.
// A history entry from GameTora's (its rarity known: these are all SSRs).
const historyEntry = (g: GametoraCard): JpCard => {
  const entry = fromGametora(g);
  return { ...entry, rarity: present(entry.rarity, 'rarity') };
};
const history: JpCardsFile = Object.fromEntries(gametora.slice(0, 3).map((c) => [c.support_id, historyEntry(c)]));
const { cards, stats } = buildCards({ upstream, history, gametora, globalCards, iconBase: 'https://up/' });

describe('cards.json', () => {
  it("has every card upstream or the history has, with Global's title and date from our record", () => {
    expect(Object.keys(cards)).toEqual(['30001', '30081', '30126']);
    expect(cards[30001]).toEqual({
      id: 30001,
      charId: 1015,
      type: 'speed',
      rarity: 'SSR',
      name: { en: 'T.M. Opera O', jp: 'テイエムオペラオー' },
      title: { en: '[Our title]', jp: '[JP 30001]' },
      release: { gl: '2026-01-01', jp: '2022-01-01' },
      source: ['gacha'],
      links: { gametora: '30001-x' },
      images: { icon: 'https://up/support_card_s_30001.png' },
    });
  });

  it("reads the history: GameTora's list only gives slugs, never a card the history lacks", () => {
    const changed = gametora.map((c) => ({
      ...c,
      name_jp: 'changed',
      release: '2030-01-01',
      url_name: `${c.support_id}-new`,
    }));
    const again = buildCards({ upstream, history, gametora: changed, globalCards, iconBase: 'https://up/' }).cards;
    expect(again[30126]).toEqual({ ...cards[30126], links: { gametora: '30126-new' } });
    expect(again[30200]).toBeUndefined();
    // Without GameTora's list: the history alone, slugs included.
    const offline = buildCards({ upstream, history, globalCards, iconBase: 'https://up/' }).cards;
    expect(offline[30126]).toEqual(cards[30126]);
    expect(offline[30200]).toBeUndefined();
  });

  it("names a character's cards Global doesn't have like its others, group cards after the group", () => {
    expect(cards[30126].name.en).toBe('T.M. Opera O');
    expect(cards[30081]).toMatchObject({ type: 'group', name: { en: 'Team Sirius', jp: 'チーム＜シリウス＞' } });
    expect(cards[30081].source).toEqual(['main_story']);
  });

  it('fills a card upstream lacks from the history, in our type names', () => {
    const newer = { ...history, 30200: historyEntry(gametora[3]) };
    const withNew = buildCards({ upstream, history: newer, gametora, globalCards, iconBase: 'https://up/' }).cards;
    expect(withNew[30200]).toMatchObject({
      type: 'wisdom',
      name: { en: 'New Girl', jp: '新人' },
      release: { gl: null, jp: '2022-01-01' },
      source: ['story_event'],
      links: { gametora: '30200-x' },
      images: { icon: null }, // the app builds GameTora's
    });
  });

  it('goes without GameTora or the history, from upstream alone', () => {
    const alone = buildCards({ upstream, iconBase: 'https://up/' }).cards;
    expect(alone[30001]).toMatchObject({ charId: null, name: { en: 'T.M. Opera O', jp: 'テイエムオペラオー' } });
    expect(alone[30001].links.gametora).toBeNull();
  });
});

describe('the stats', () => {
  it("hold each server's name, events and limit breaks, and join back to upstream's lists", () => {
    expect(stats.gl[30001]).toEqual({
      charName: 'T.M. Opera O',
      events: [1, 2, 3, 4, 5, 6, 7, 8],
      lb: [0, 1, 2, 3, 4].map((lb) => ({ sb: 10 + lb })),
    });
    expect(Object.keys(stats.jp)).toEqual(['30001', '30081', '30126']);
    expect(withoutEvents(joinCards(cards, stats.jp))).toEqual(upstream.jp);
  });
});

describe('the schema', () => {
  const check = (data: unknown) => expect(CardsFileSchema.safeParse(data).error?.issues ?? []).toEqual([]);

  it('fits what the build writes', () => {
    check(cards);
    expect(CardsFileSchema.safeParse({ 1: { ...cards[30001], extra: 1 } }).success).toBe(false);
  });

  it.skipIf(!existsSync('generated/cards.json'))('fits generated/cards.json', () => {
    check(JSON.parse(readFileSync('generated/cards.json', 'utf8')));
  });
});
