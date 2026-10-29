import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAMETORA_CARDS_FILE } from '../scripts/build-cards.ts';
import { JP_CARDS_FILE, applyNewsCards, newsCards } from '../scripts/lib/jp-cards.ts';
import { postsFile } from '../scripts/lib/news-api.ts';
import type { NewsCard } from '../scripts/lib/jp-cards.ts';
import type { JpCard, JpCardsFile } from '../shared/schemas/card.ts';
import type { GametoraCard } from '../shared/schemas/gametora.ts';
import type { NewsPost } from '../shared/schemas/news.ts';
import { at, present } from './helpers.ts';

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8'));
const posts = existsSync(postsFile('jp')) ? readJson<NewsPost[]>(postsFile('jp')) : [];
const byId = new Map(posts.map((p) => [String(p.announce_id), p]));
const some = (...ids: number[]) => ids.map((id) => present(byId.get(String(id)), `post ${id}`));
const named = (cards: NewsCard[]) => Object.fromEntries(cards.map((c) => [`${c.title}${c.name}`, c]));

describe.skipIf(!posts.length)('newsCards', () => {
  it("reads a story event's own SSR, quoted or not", () => {
    const cards = named(newsCards(some(3481, 2936)));
    expect(cards['[“最強”なる眷属]ドゥラメンテ']).toEqual({
      rarity: 'SSR',
      title: '[“最強”なる眷属]',
      name: 'ドゥラメンテ',
      release: '2026-09-30',
      source: 'story_event',
      news_url: 'https://umamusume.jp/news/detail/?id=3481',
    });
    // "・イベント限定SSRサポートカード[黄金の夢に溺れよ] オルフェーヴル", and not "…オルフェーヴルを獲得できます" from a sentence
    expect(Object.keys(cards)).toEqual(['[黄金の夢に溺れよ]オルフェーヴル', '[“最強”なる眷属]ドゥラメンテ']);
    expect(cards['[黄金の夢に溺れよ]オルフェーヴル']).toMatchObject({ release: '2025-11-28', source: 'story_event' });
  });

  it('reads cards campaigns give, from the part that gives them (not a summary of the parts)', () => {
    const cards = named(newsCards(some(3407, 3466)));
    // "「SSR[Endless Game]ルーラーシップ」を最大2枚プレゼント！" in the login bonus
    expect(cards['[Endless Game]ルーラーシップ']).toMatchObject({
      rarity: 'SSR',
      release: '2026-08-24',
      source: 'gift',
    });
    // "SSRサポートカード「[めぐるぐるぐるトレセン日和]ライスシャワー」をプレゼントします！"
    expect(cards['[めぐるぐるぐるトレセン日和]ライスシャワー']).toMatchObject({
      release: '2026-09-27',
      source: 'gift',
    });
    // a scout's cards named in a campaign post aren't given by it
    expect(Object.values(cards).every((c) => c.source === 'gift')).toBe(true);
  });

  it("reads every scout card at its banner's JST start day, R cards and cards after the list too", () => {
    const cards = named(newsCards(some(3468, 2656)));
    expect(cards['[晩餐]ナリタブライアン']).toMatchObject({ rarity: 'SSR', release: '2026-09-30', source: 'gacha' });
    // a select-pickup scout's new R card, under its own heading after the candidates
    expect(cards['[トレセン学園]フサイチパンドラ']).toMatchObject({
      rarity: 'R',
      release: '2025-07-22',
      source: 'gacha',
    });
    // the candidates themselves (old cards) are read too: the history knows them
    expect(cards['[雲煙飛動]シンボリルドルフ']).toMatchObject({ source: 'gacha' });
  });

  it('keeps the first appearance', () => {
    // [晩餐]ナリタブライアン is on 3468's banner; a later re-run or paid scout doesn't move it
    const all = named(newsCards(posts));
    expect(all['[晩餐]ナリタブライアン']).toMatchObject({ release: '2026-09-30', source: 'gacha' });
    expect(all['[世界一小さなビッグバン]サムソンビッグ']).toMatchObject({
      release: '2026-08-31',
      source: 'story_event',
    });
  });
});

const gt = (
  support_id: number,
  char_id: number,
  char_name: string,
  name_jp: string,
  title_ja: string,
  extra: Partial<GametoraCard> = {}
): GametoraCard => ({
  support_id,
  char_id,
  char_name,
  name_jp,
  title_en: `[GT ${support_id}]`,
  title_ja,
  type: 'intelligence',
  rarity: 3,
  release: '2030-01-01', // GameTora's date: never used for a news card
  obtained: 'gacha',
  url_name: `${support_id}-x`,
  ...extra,
});
const old: JpCard = {
  charId: 1001,
  type: 'speed',
  rarity: 'SSR',
  name: { en: 'Old', jp: '古い' },
  title: { en: null, jp: '[掲げよ、燃え盛る灯を]' },
  release: at('2021-02-24', 'gametora'),
  source: ['gacha'],
  slug: '30001-old',
};
const found: NewsCard[] = [
  {
    rarity: 'SSR',
    title: '[掲げよ、燃え盛る灯を]',
    name: '古い',
    release: '2021-02-24',
    source: 'gacha',
    news_url: 'u0',
  },
  { rarity: 'SSR', title: '[新しい札]', name: '新人', release: '2026-10-01', source: 'gacha', news_url: 'u1' },
  { rarity: 'SSR', title: '[贈り物]', name: '贈る', release: '2026-10-02', source: 'gift', news_url: 'u2' },
  { rarity: 'SR', title: '[まだ]', name: '未定', release: '2026-10-03', source: 'story_event', news_url: 'u3' },
  // a title cut short: the history's card
  {
    rarity: 'SSR',
    title: '[掲げよ、燃え盛る灯]',
    name: '古い',
    release: '2021-02-24',
    source: 'gacha',
    news_url: 'u4',
  },
];
const gametora = [
  gt(30001, 1001, 'Old', '古い', '[掲げよ、燃え盛る灯を]', { release: '1999-01-01', url_name: '30001-new-slug' }),
  gt(30400, 1200, 'Newbie', '新人', '[新しい札]'),
  gt(30401, 1201, 'Giver', '贈る', '[贈り物]', { obtained: 'limited_quest', type: 'friend' }),
  gt(30402, 1202, 'Nobody', 'だれ', '[知らない]'),
];
const history: JpCardsFile = { 30001: old };

describe('applyNewsCards', () => {
  const result = applyNewsCards({ history, found, gametora });

  it("adds the news' cards GameTora lists: GameTora's id, type, charId, slug, English; the news' JP fields", () => {
    expect(Object.keys(result.history)).toEqual(['30001', '30400', '30401']);
    expect(result.history[30400]).toEqual({
      charId: 1200,
      type: 'wisdom',
      rarity: 'SSR',
      name: { en: 'Newbie', jp: '新人' },
      title: { en: '[GT 30400]', jp: '[新しい札]' },
      release: at('2026-10-01'),
      source: ['gacha'],
      slug: '30400-x',
      news_url: 'u1',
    });
    expect(result.added).toEqual([30400, 30401]);
  });

  it("gives a gift card GameTora's source", () => {
    expect(result.history[30401]).toMatchObject({
      type: 'friend',
      source: ['limited_quest'],
      release: at('2026-10-02'),
    });
  });

  it('never changes a frozen card', () => {
    expect(result.history[30001]).toBe(old);
  });

  it('keeps cards GameTora lacks pending, without an id', () => {
    expect(result.pending).toEqual([
      {
        rarity: 'SR',
        name: { en: null, jp: '未定' },
        title: { en: null, jp: '[まだ]' },
        release: at('2026-10-03'),
        source: ['story_event'],
        news_url: 'u3',
      },
    ]);
    // without GameTora's list, every new card is pending; a gift's source is promo until GameTora says
    const offline = applyNewsCards({ history, found, gametora: [] });
    expect(Object.keys(offline.history)).toEqual(['30001']);
    expect(offline.pending.map((c) => [c.title.jp, c.source[0]])).toEqual([
      ['[新しい札]', 'gacha'],
      ['[贈り物]', 'promo'],
      ['[まだ]', 'story_event'],
    ]);
  });

  it("lists GameTora's cards the news doesn't show, and never adds them", () => {
    expect(result.gametoraOnly.map((g) => g.support_id)).toEqual([30402]);
    expect(result.history[30402]).toBeUndefined();
  });

  it('is idempotent, and keeps what GameTora gave once its list lacks the card', () => {
    const again = applyNewsCards({ history: result.history, found, gametora });
    expect(again.history).toEqual(result.history);
    expect(again.pending).toEqual(result.pending);
    expect(again.added).toEqual([]);
    expect(applyNewsCards({ history: result.history, found, gametora: [] }).history).toEqual(result.history);
    // the news' fields are rebuilt from the posts each time
    const moved = found.map((c) => (c.news_url === 'u1' ? { ...c, release: '2026-09-30' } : c));
    expect(applyNewsCards({ history: result.history, found: moved, gametora }).history[30400].release.date).toBe(
      '2026-09-30'
    );
  });

  it("notes a rarity the news and GameTora don't agree on, keeping the news'", () => {
    const sr = applyNewsCards({ history, found, gametora: gametora.map((g) => ({ ...g, rarity: 2 })) });
    expect(sr.rarityDiffers.map((d) => d.id)).toEqual([30400, 30401]);
    expect(sr.history[30400].rarity).toBe('SSR');
  });
});

const stored = posts.length && existsSync(GAMETORA_CARDS_FILE) && existsSync(JP_CARDS_FILE);
describe.skipIf(!stored)('the stored news, history and GameTora list', { tags: ['data'] }, () => {
  const all = stored ? newsCards(posts) : [];
  const jpCards = stored ? readJson<JpCardsFile>(JP_CARDS_FILE) : {};
  const gtCards = stored ? readJson<GametoraCard[]>(GAMETORA_CARDS_FILE) : [];

  it('rebuild the newest cards from the news + GameTora exactly as the frozen history has them', () => {
    // the frozen cards from 2026-06 on, removed and rebuilt
    const frozen = Object.entries(jpCards).filter(([, c]) => !c.news_url && c.release.date >= '2026-06-01');
    const trimmed = Object.fromEntries(Object.entries(jpCards).filter(([id]) => !frozen.some(([f]) => f === id)));
    const r = applyNewsCards({ history: trimmed, found: all, gametora: gtCards });
    // (30310, a KFC collab's serial code card, is only in a ぱかライブTV summary post: not an event post)
    expect(r.gametoraOnly.map((g) => g.support_id)).toContain(30310);
    for (const [id, card] of frozen) {
      if (Number(id) === 30310) continue;
      const { news_url, ...rebuilt } = r.history[id];
      // (the same day, the news' now)
      expect(rebuilt, id).toEqual({ ...card, release: { ...card.release, status: 'news' } });
    }
  });
});
