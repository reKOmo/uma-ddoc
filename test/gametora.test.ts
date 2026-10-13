// GameTora's URLs, built from ids (src/gametora.js): the data files store none.

import { describe, expect, it } from 'vitest';
import { bannerArt, cardArt, cardIcon, cardPage, traineeIcon, withArt } from '../src/gametora.ts';
import type { BannerFile } from '../shared/schemas/banner.ts';
import type { CardsFile } from '../shared/schemas/card.ts';
import { fixture, present } from './helpers.ts';

const IMAGES = 'https://gametora.com/images/umamusume/';

describe('GameTora URLs', () => {
  it('builds card pages from slugs, art and icons from ids', () => {
    expect(cardPage('30321-duramente')).toBe('https://gametora.com/umamusume/supports/30321-duramente');
    expect(cardPage(null)).toBeNull();
    expect(cardArt(30321)).toBe(`${IMAGES}supports/tex_support_card_30321.png`);
    expect(cardIcon(30321)).toBe(`${IMAGES}supports/support_card_s_30321.png`);
    expect(cardIcon(30321, fixture<CardsFile>({ 30321: { images: { icon: 'upstream.png' } } }))).toBe('upstream.png');
    expect(cardIcon(30321, fixture<CardsFile>({ 30321: { images: { icon: null } } }))).toBe(
      `${IMAGES}supports/support_card_s_30321.png`
    );
    expect(traineeIcon(1072, 107201)).toBe(`${IMAGES}characters/thumb/chara_stand_1072_107201.png`);
    expect(bannerArt(30321, 'global')).toBe(`${IMAGES}en/gacha/img_bnr_gacha_30321.png`);
    expect(bannerArt('50010-rerun', 'jp')).toBe(`${IMAGES}gacha/img_bnr_gacha_50010.png`);
  });

  it("fills a banner file's art (official art kept) and item icons", () => {
    const file = fixture<BannerFile>({
      source: {},
      characters: [
        {
          id: 1,
          main: { id: 100101, char_id: 1001 },
          featured: [
            { id: 100101, char_id: 1001 },
            { id: null, char_id: null },
          ],
        },
      ],
      cards: [{ id: 2, image: 'official.png', main: null, featured: [{ id: 30001, type: 'speed' }] }],
    });
    const filled = withArt(file, 'global', {});
    expect(filled.characters[0]).toMatchObject({ image: `${IMAGES}en/gacha/img_bnr_gacha_1.png`, officialArt: false });
    expect(present(filled.characters[0].main).icon).toBe(traineeIcon(1001, 100101));
    expect(filled.characters[0].featured.map((f) => f.icon)).toEqual([traineeIcon(1001, 100101), null]);
    expect(filled.cards[0]).toMatchObject({ image: 'official.png', officialArt: true, main: null });
    // A GameTora banner the news confirmed: its post's art over GameTora's.
    expect(
      withArt(
        fixture<BannerFile>({ characters: [], cards: [{ id: 3, news_image: 'post.png', featured: [] }] }),
        'jp',
        {}
      ).cards[0]
    ).toMatchObject({ image: 'post.png', officialArt: true });
    expect(filled.cards[0].featured[0].icon).toBe(cardIcon(30001));
    expect(file.characters[0].image).toBeUndefined(); // the loaded file isn't changed
  });
});
