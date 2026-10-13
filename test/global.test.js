// Global's own banner record (scripts/lib/global.js).

import { describe, it, expect } from 'vitest';
import { applyNews, englishNames } from '../scripts/lib/global.js';

const item = (id, char_id, name, title, rarity, extra = {}) => ({
  id,
  char_id,
  name,
  title,
  rarity,
  rate: 7500,
  new: true,
  ...extra,
});

// JP's banners (Japanese names), as GameTora has them.
const JP = {
  characters: [
    {
      id: 30134,
      image: 'jp-30134.png',
      start: '2022-12-12T03:00:00.000Z',
      end: '2022-12-20T02:59:59.000Z',
      featured: [item(104701, 1047, 'ゼンノロブロイ', '[英雄譚]', 3)],
    },
  ],
  cards: [
    {
      id: 30135,
      image: 'jp-30135.png',
      start: '2022-12-12T03:00:00.000Z',
      end: '2022-12-20T02:59:59.000Z',
      featured: [
        item(30072, 1024, 'マヤノトップガン', '[フォーメーション：PARTY]', 3, { type: 'speed' }),
        item(30126, 1068, 'ヤマニンゼファー', '[JP title]', 3, { type: 'friend', rate: 5000 }),
      ],
    },
  ],
};

// Seeded from GameTora: Mayano's card is already out; Yamanin Zephyr's isn't.
const SEEDED = {
  source: { site: 'gametora' },
  characters: [],
  cards: [
    {
      id: 30001,
      image: 'old.png',
      start: '2026-01-04T22:00:00.000Z',
      end: '2026-01-12T21:59:59.000Z',
      main: null,
      featured: [item(30072, 1024, 'Mayano Top Gun', '[Party Formation]', 3, { type: 'speed' })],
    },
  ],
};
const CARDS = { 30072: { title_en: '[Party Formation]', release_gl: '2026-01-05' } };
const CARD_DATA = { 30126: { charId: 1068, type: 'friend', name: { en: 'Yamanin Zephyr', jp: 'ヤマニンゼファー' } } };

// A scout post, as scripts/lib/banner-posts.js reads it.
const post = (id, posted, start, extra = {}) => ({
  id,
  url: `https://umamusume.com/news/${id}/`,
  posted,
  paid: false,
  banners: [
    {
      gachaId: 30134,
      type: 'character',
      start,
      end: '2026-10-15T21:59:00.000Z',
      image: 'official-30134.png',
      featured: [{ stars: 3, title: 'Heroic Author', name: 'Zenno Rob Roy' }],
    },
    {
      gachaId: 30135,
      type: 'support',
      start,
      end: '2026-10-15T21:59:00.000Z',
      image: 'official-30135.png',
      featured: [
        { rarity: 'SSR', title: 'Party Formation', name: 'Mayano Top Gun' },
        { rarity: 'SSR', title: 'Calm Breeze', name: 'Yamanin Zephyr' },
      ],
    },
  ],
  ...extra,
});

const apply = (posts, global = SEEDED, cards = CARDS) =>
  applyNews({ posts, global, cards, jp: JP, names: englishNames(global, CARD_DATA) });

describe('applyNews', () => {
  const result = apply([post(1089, '2026-10-07T22:00:00Z', '2026-10-07T22:00:00.000Z')]);
  const cardBanner = result.global.cards.find((b) => b.id === 30135);

  it("makes Global banners from JP's of the same id, with the post's dates, art and English names", () => {
    expect(cardBanner).toMatchObject({
      image: 'official-30135.png',
      start: '2026-10-07T22:00:00.000Z',
      end: '2026-10-15T21:59:59.000Z',
      announced: true,
      news_url: 'https://umamusume.com/news/1089/',
    });
    expect(cardBanner.featured.map((i) => [i.id, i.name, i.title, i.new])).toEqual([
      [30072, 'Mayano Top Gun', '[Party Formation]', false],
      [30126, 'Yamanin Zephyr', '[Calm Breeze]', true],
    ]);
    expect(cardBanner.main.id).toBe(30072); // same rarity, higher rate
    // Zenno Rob Roy has no English name anywhere yet: the post's only trainee pairs with the only item.
    expect(result.global.characters[0].featured[0]).toMatchObject({ name: 'Zenno Rob Roy', title: '[Heroic Author]' });
  });

  it("records the cards' Global releases, leaving the seeded ones alone", () => {
    expect(result.cards).toEqual({
      30072: CARDS[30072],
      30126: { title_en: '[Calm Breeze]', release_gl: '2026-10-07', news_url: 'https://umamusume.com/news/1089/' },
    });
    // (A copy: what an earlier run took from the posts is taken again.)
    expect(result.global.cards.at(-1)).toEqual(SEEDED.cards[0]);
  });

  it('is idempotent, and a later post about the same banner wins', () => {
    const again = apply([post(1089, '2026-10-07T22:00:00Z', '2026-10-07T22:00:00.000Z')], result.global, result.cards);
    expect(again.global).toEqual(result.global);
    expect(again.cards).toEqual(result.cards);

    const moved = apply(
      [
        post(1088, '2026-10-06T22:00:00Z', '2026-10-07T22:00:00.000Z'),
        post(1090, '2026-10-08T22:00:00Z', '2026-10-08T22:00:00.000Z'),
      ],
      result.global,
      result.cards
    );
    expect(moved.global.cards.find((b) => b.id === 30135).start).toBe('2026-10-08T22:00:00.000Z');
    expect(moved.cards[30126].release_gl).toBe('2026-10-08');
  });

  it("keeps a seeded banner's dates and items, adding its post and official art, and skips ids JP doesn't have", () => {
    const seededToo = { ...SEEDED, cards: [{ ...SEEDED.cards[0], id: 30135 }] };
    const r = apply([post(1089, '2026-10-07T22:00:00Z', '2026-10-07T22:00:00.000Z')], seededToo);
    expect(r.global.cards).toEqual([
      { ...seededToo.cards[0], news_url: 'https://umamusume.com/news/1089/', news_image: 'official-30135.png' },
    ]);
    // Only the trainee banner is made from the post: the card banner was already there.
    expect(r.banners.map((b) => b.banner.id)).toEqual([30134]);
    // Idempotent: run again over its own output, the same.
    expect(apply([post(1089, '2026-10-07T22:00:00Z', '2026-10-07T22:00:00.000Z')], r.global).global).toEqual(r.global);

    const unknown = post(1091, '2026-10-07T22:00:00Z', '2026-10-07T22:00:00.000Z', {
      banners: [
        { gachaId: 99999, type: 'support', start: '2026-10-07T22:00:00.000Z', end: null, image: 'x.png', featured: [] },
      ],
    });
    expect(apply([unknown]).skipped).toEqual([
      { id: 99999, post: 'https://umamusume.com/news/1091/', reason: 'no JP banner has this id' },
    ]);
  });

  it('leaves out paid scouts, and banners whose type JP disagrees with', () => {
    const paid = apply([post(897, '2026-10-07T22:00:00Z', '2026-10-07T22:00:00.000Z', { paid: true })]);
    expect(paid.banners).toEqual([]);

    const swapped = post(1089, '2026-10-07T22:00:00Z', '2026-10-07T22:00:00.000Z');
    swapped.banners[0].type = 'support';
    const r = apply([swapped]);
    expect(r.banners.map((b) => b.banner.id)).toEqual([30135]);
    expect(r.skipped).toEqual([
      {
        id: 30134,
        post: 'https://umamusume.com/news/1089/',
        reason: 'the post lists it as a support banner, JP as a character one',
      },
    ]);
  });
});
