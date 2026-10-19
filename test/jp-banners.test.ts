import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bannerPost } from '../scripts/lib/banner-posts.ts';
import {
  applyJpNews,
  GAMETORA_TRAINEES_FILE,
  isRegular,
  JP_BANNERS_FILE,
  regularBanners,
} from '../scripts/lib/jp-banners.ts';
import { BANNERS_FILE as GLOBAL_BANNERS_FILE } from '../scripts/lib/global.ts';
import { postsFile } from '../scripts/lib/news-api.ts';
import { ja } from '../scripts/lib/news-lang/ja.ts';
import { GENERATED_DIR } from '../scripts/lib/paths.ts';
import type { Banner as ScoutBanner, BannerPost } from '../scripts/lib/banner-posts.ts';
import type { ApplyJpNewsResult } from '../scripts/lib/jp-banners.ts';
import type { Banner, BannerFile, BannerId, BannerItem } from '../shared/schemas/banner.ts';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { GametoraTrainee } from '../shared/schemas/gametora.ts';
import type { NewsPost } from '../shared/schemas/news.ts';
import { at, fixture, present } from './helpers.ts';

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8'));
const posts = existsSync(postsFile('jp')) ? readJson<NewsPost[]>(postsFile('jp')) : [];
const byId = new Map(posts.map((p) => [String(p.announce_id), p]));
const scout = (id: number) => present(bannerPost(present(byId.get(String(id)), `post ${id}`), ja), `scouts of ${id}`);
const banner = (id: number, gachaId: number) =>
  present(
    scout(id).banners.find((b) => b.gachaId === gachaId),
    `banner ${gachaId}`
  );
const items = (b: ScoutBanner) => b.featured.map((f) => `${'rarity' in f ? f.rarity : f.stars}[${f.title}]${f.name}`);

describe.skipIf(!posts.length)('bannerPost (JP)', () => {
  it('reads ids, types, JST periods and the art', () => {
    const post = scout(947);
    expect(post).toMatchObject({ id: 947, url: 'https://umamusume.jp/news/detail/?id=947', paid: false });
    expect(post.banners.map((b) => [b.gachaId, b.type, b.paid])).toEqual([
      [30116, 'character', false],
      [30117, 'support', false],
    ]);
    expect(post.banners[0]).toMatchObject({ start: '2022-09-20T03:00:00.000Z', end: '2022-09-29T02:59:00.000Z' });
    expect(post.banners[0].image).toMatch(/\/announce\/947\/Header\/gacha_banner_30116_new\.png/);
    // a start without a time (2021/2/24) is the start of that JST day; given years kept
    expect(banner(122, 50001)).toMatchObject({ start: '2021-02-23T15:00:00.000Z', end: '2023-03-30T02:59:00.000Z' });
    // open-ended
    expect(banner(3110, 50224)).toMatchObject({ start: '2026-03-11T03:00:00.000Z', end: null });
  });

  it('keeps only the first list after each banner art, R cards included', () => {
    expect(items(banner(947, 30116))).toEqual(['3[Rocket☆Star]シーキングザパール']);
    expect(items(banner(947, 30117))).toEqual([
      'SSR[嗚呼華麗ナル一族]ダイイチルビー',
      'SR[The 3rd MIRACLE]ケイエスミラクル',
      'R[トレセン学園]ダイイチルビー',
      'R[トレセン学園]ケイエスミラクル',
    ]);
    // a revival lists both banners again after the second art
    expect(items(banner(2973, 30402))).toEqual(['3[Regina dei fiori]ジェンティルドンナ']);
    expect(items(banner(2973, 30404))).toEqual(['3[総攬]オルフェーヴル']);
    // words split by <span>s (2021)
    expect(items(banner(221, 30014))).toEqual(['3[Nevertheless]ナリタタイシン']);
    expect(banner(221, 30015).featured.filter((f) => 'rarity' in f && f.rarity === 'R')).toHaveLength(2);
    // 予告 placeholders hold their place without ending the list
    expect(items(banner(1675, 30211))).toEqual([
      'SSR[会心のウイニングスマイル]ヴィブロス',
      'R[トレセン学園]ヴィブロス',
    ]);
    // trimmed titles, bullet-less and space-less items
    expect(items(banner(3294, 30448))).toEqual(['3[万福龍湯伝・頂]ナリタトップロード']);
    expect(banner(3440, 50246).featured).toHaveLength(9);
    expect(items(banner(3440, 50247))[0]).toBe('SSR[只、君臨す。]オルフェーヴル');
    expect(banner(3213, 30434).featured).toHaveLength(9);
    expect(banner(1464, 50029).featured).toEqual([]); // "every trainee released before …"
  });

  it('marks paid banners per banner (gacha id ≥ 50000)', () => {
    expect(scout(1464).banners).toHaveLength(20);
    expect(scout(1464).banners.every((b) => b.paid && b.type)).toBe(true);
    expect(scout(3070).banners).toHaveLength(13);
    expect(scout(3470).banners.map((b) => [b.gachaId, b.type, b.paid])).toEqual([
      [30474, 'character', false],
      [50248, 'support', true],
    ]);
    expect(scout(3468).banners.every((b) => !b.paid)).toBe(true);
  });

  it('gives each banner its own labelled window', () => {
    expect(banner(2593, 30346)).toMatchObject({ type: 'character', end: '2025-07-11T02:59:00.000Z' });
    expect(banner(2593, 30347)).toMatchObject({ type: 'support', end: '2025-06-27T02:59:00.000Z' });
    expect(banner(2593, 30347).featured).toHaveLength(10);
  });

  it('reads a re-run period', () => {
    const rerun = { start: '2022-10-17T03:00:00.000Z', end: '2022-10-24T02:59:00.000Z' };
    expect(scout(947).banners.map((b) => b.rerun)).toEqual([rerun, rerun]);
    expect(banner(2446, 30321).rerun).toEqual({ start: '2025-04-10T03:00:00.000Z', end: '2025-04-17T02:59:00.000Z' });
    expect(banner(2446, 30321).start).toBe('2025-03-21T03:00:00.000Z');
    expect(banner(2593, 30347).rerun).toBeUndefined();
  });
});

describe('applyJpNews', () => {
  const item = (id: number, extra: Partial<BannerItem> = {}): BannerItem => ({
    id,
    char_id: 1,
    name: 'A',
    title: '[T]',
    rarity: 3,
    rate: 7500,
    new: false,
    ...extra,
  });
  const seeded = (id: number, start: string, end: string, featured: BannerItem[]): Banner => ({
    id,
    start: at(start, 'gametora'),
    end: at(end, 'gametora'),
    main: featured[0],
    featured,
  });
  const jp = fixture<BannerFile>({
    source: { site: 'gametora' },
    characters: [
      seeded(2, '2025-04-10T03:00:00.000Z', '2025-04-17T02:59:59.000Z', [item(100, { new: false })]),
      seeded(1, '2025-03-21T03:00:00.000Z', '2025-03-31T02:59:59.000Z', [
        item(100, { name: 'ウマ', title: '[勝負服]', new: true }),
      ]),
    ],
    cards: [],
  });
  const cards = fixture<CardsFile>({
    30001: {
      id: 30001,
      charId: 7,
      type: 'wisdom',
      name: { jp: 'カード' },
      title: { jp: '[称号]' },
      images: { icon: 'c' },
    },
    10001: {
      id: 10001,
      charId: 8,
      type: 'speed',
      name: { jp: 'アール' },
      title: { jp: '[学園]' },
      images: { icon: null },
    },
  });
  const rerun = { start: '2025-04-10T03:00:00.000Z', end: '2025-04-17T02:59:00.000Z' };
  const post: BannerPost = {
    id: 9,
    url: 'https://umamusume.jp/news/detail/?id=9',
    posted: '2025-03-21T03:00:00Z',
    paid: false,
    banners: [
      {
        gachaId: 1,
        type: 'character',
        start: '2025-03-21T03:00:00.000Z',
        end: '2025-03-31T02:59:00.000Z',
        image: 'official/1.png',
        featured: [{ stars: 3, title: '勝負服', name: 'ウマ' }],
        paid: false,
        rerun,
      },
      {
        gachaId: 3,
        type: 'support',
        start: '2025-03-21T03:00:00.000Z',
        end: '2025-03-31T02:59:00.000Z',
        image: 'official/3.png',
        featured: [
          { rarity: 'SSR', title: '称号', name: 'カード' },
          { rarity: 'R', title: '学園', name: 'アール' },
          { rarity: 'SR', title: '謎', name: 'だれ' },
        ],
        paid: false,
        rerun,
      },
      {
        gachaId: 50001,
        type: 'character',
        start: '2025-03-21T03:00:00.000Z',
        end: null,
        image: 'official/50001.png',
        featured: [],
        paid: true,
      },
    ],
  };
  const result = applyJpNews({ posts: [post], jp, cards });
  const find = (kind: 'characters' | 'cards', id: BannerId) =>
    present(
      result.jp[kind].find((b) => b.id === id),
      `${kind} ${id}`
    );

  it("enriches GameTora's banner, keeping its dates and art", () => {
    expect(find('characters', 1)).toEqual({
      ...jp.characters[1],
      // (the post's dates are GameTora's: the news' now)
      start: at('2025-03-21T03:00:00.000Z'),
      end: at('2025-03-31T02:59:59.000Z'),
      news_url: post.url,
      news_image: 'official/1.png',
      rerun: { id: 2, start: at(rerun.start), end: at('2025-04-17T02:59:59.000Z') },
    });
    expect(result.mismatches).toEqual([]);
  });

  it('makes the banners GameTora lacks, featured resolved (R cards kept, unknown ones listed)', () => {
    const made = find('cards', 3);
    expect(made).toMatchObject({
      image: 'official/3.png',
      news_image: 'official/3.png',
      end: at('2025-03-31T02:59:59.000Z'),
      from_news: true,
    });
    expect(made.featured.map((f) => [f.id, f.rarity, f.type, f.new])).toEqual([
      [30001, 3, 'intelligence', true],
      [10001, 1, 'speed', true],
      [null, 2, null, false],
    ]);
    expect(present(made.main, 'main').id).toBe(30001);
    // No icons stored: the app builds them from the ids (src/gametora.js).
    expect(made.featured.some((f) => 'icon' in f)).toBe(false);
    expect(result.unresolved).toEqual([{ banner: 3, item: expect.objectContaining({ name: 'だれ' }) }]);
    expect(find('characters', 50001)).toMatchObject({ paid: true, end: null, featured: [] });
  });

  it("pairs re-runs: GameTora's re-run banner, else one of our own", () => {
    expect(find('characters', 2).rerunOf).toBe(1);
    expect(find('cards', '3-rerun')).toMatchObject({
      rerunOf: 3,
      start: at(rerun.start),
      end: at('2025-04-17T02:59:59.000Z'),
    });
    expect(find('cards', '3-rerun').featured.every((f) => !f.new)).toBe(true);
    expect(present(find('cards', 3).rerun, 're-run').id).toBe('3-rerun');
  });

  it('is idempotent, and lists dates that differ', () => {
    expect(applyJpNews({ posts: [post], jp: result.jp, cards }).jp).toEqual(result.jp);
    const moved = { ...post, banners: [{ ...post.banners[0], start: '2025-03-22T03:00:00.000Z' }] };
    expect(applyJpNews({ posts: [moved], jp, cards }).mismatches).toHaveLength(1);
  });

  it('leaves paid banners and our re-run entries out of the regular ones', () => {
    const regular = regularBanners(result.jp);
    expect(regular.characters.map((b) => b.id)).toEqual([2, 1]);
    expect(regular.cards.map((b) => b.id)).toEqual([3]);
  });

  it("resolves a debuting trainee from GameTora's list, then from our own banners", () => {
    const debut: BannerPost = {
      ...post,
      id: 10,
      url: 'https://umamusume.jp/news/detail/?id=10',
      banners: [
        {
          gachaId: 4,
          type: 'character',
          start: '2025-05-01T03:00:00.000Z',
          end: '2025-05-10T02:59:00.000Z',
          image: 'official/4.png',
          featured: [{ stars: 3, title: '新衣装', name: 'シン' }],
          paid: false,
        },
      ],
    };
    const featured = (r: ApplyJpNewsResult) =>
      present(
        r.jp.characters.find((b) => b.id === 4),
        'banner 4'
      ).featured[0];
    // Without GameTora's list: by name only.
    const without = applyJpNews({ posts: [debut], jp, cards });
    expect(without.unresolved.map((u) => u.banner)).toEqual([4]);
    // With it (titles as GameTora writes them, brackets included): its id and character.
    const trainees = [{ id: 105901, char_id: 1059, name: 'シン', title: '[新衣装]' }];
    const withList = applyJpNews({ posts: [debut], jp, cards, trainees });
    expect(featured(withList)).toMatchObject({ id: 105901, char_id: 1059 });
    expect(withList.unresolved).toEqual([]);
    // Stored, it resolves from our own banners on later runs without the list.
    expect(featured(applyJpNews({ posts: [debut], jp: withList.jp, cards }))).toMatchObject({ id: 105901 });
  });
});

describe.skipIf(!posts.length || !existsSync(JP_BANNERS_FILE))('the stored JP banners', () => {
  const stored = readJson<BannerFile>(JP_BANNERS_FILE);
  const all: ['character' | 'support', Banner][] = [
    ...stored.characters.map((b): ['character', Banner] => ['character', b]),
    ...stored.cards.map((b): ['support', Banner] => ['support', b]),
  ];
  const gametora = new Map(all.filter(([, b]) => !b.from_news).map(([type, b]) => [b.id, { type, b }]));
  const scouts = posts.map((p) => bannerPost(p, ja)).filter((s) => s !== null);

  it('agree with GameTora on every banner a post shows (start, end to the minute, type)', () => {
    let checked = 0;
    for (const post of scouts)
      for (const b of post.banners) {
        const known = gametora.get(b.gachaId);
        if (!known) continue;
        checked++;
        expect([b.gachaId, b.type, b.start], post.url).toEqual([b.gachaId, known.type, known.b.start.date]);
        expect(present(b.end, 'end').replace(/:00\.000Z$/, ':59.000Z'), post.url).toBe(known.b.end?.date);
      }
    expect(checked).toBeGreaterThanOrEqual(574);
  });

  it('keep every seeded banner, numeric ids but for re-runs, re-runs paired both ways', () => {
    expect(gametora.size).toBe(366); // GameTora's history as seeded
    for (const [, b] of all) {
      if (typeof b.id !== 'number') expect(b).toMatchObject({ id: `${b.rerunOf}-rerun`, from_news: true });
      if (b.rerunOf != null) {
        const original = present(
          all.find(([, o]) => o.id === b.rerunOf),
          `banner ${b.rerunOf}`
        )[1];
        expect(present(original.rerun, 're-run').id).toBe(b.id);
      }
      if (b.paid) expect(Number.parseInt(String(b.id), 10)).toBeGreaterThanOrEqual(50000);
      expect(isRegular(b)).toBe(!b.paid && typeof b.id === 'number');
    }
    expect(all.filter(([, b]) => b.id === '30321-rerun')).toHaveLength(1);
    const seededBanner = (id: number) => present(gametora.get(id), `banner ${id}`).b;
    expect(seededBanner(30338).rerunOf).toBe(30320);
    expect([seededBanner(30130).rerunOf, seededBanner(30131).rerunOf]).toEqual([30116, 30117]);
  });

  it('are what the news makes of them (pnpm update-jp leaves them unchanged), from the seeded ones alone', () => {
    const cards = readJson<CardsFile>(`${GENERATED_DIR}cards.json`);
    const global = existsSync(GLOBAL_BANNERS_FILE) ? readJson<BannerFile>(GLOBAL_BANNERS_FILE) : null;
    expect(applyJpNews({ posts: scouts, jp: stored, cards, global }).jp).toEqual(stored);
    // From the seeded history alone: the same, every featured trainee and card resolved. A trainee debuting on a
    // banner made from the news resolves only from GameTora's trainee list, as update-jp reads it (when there is one).
    const trainees = existsSync(GAMETORA_TRAINEES_FILE) ? readJson<GametoraTrainee[]>(GAMETORA_TRAINEES_FILE) : null;
    const seeded = (list: Banner[]) => list.filter((b) => !b.from_news);
    const jp = { ...stored, characters: seeded(stored.characters), cards: seeded(stored.cards) };
    const again = applyJpNews({ posts: scouts, jp, cards, global, trainees });
    expect(again.jp).toEqual(stored);
    // Unresolved: only a trainee debuting on a banner made from the news (no earlier banner names it, and the news
    // gives no trainee ids); every card and every known trainee resolves.
    const named = new Set(
      [...stored.characters].filter((b) => !b.from_news).flatMap((b) => b.featured.map((f) => `${f.title}${f.name}`))
    );
    for (const { banner, item } of again.unresolved) {
      const b = stored.characters.find((x) => x.id === banner);
      expect(b?.from_news, `${banner} ${item.title}${item.name}`).toBe(true);
      expect(named.has(`${item.title}${item.name}`), `${item.title}${item.name}`).toBe(false);
    }
  });

  it('store no GameTora URLs (the app builds the art and icons from ids)', () => {
    expect(JSON.stringify({ ...stored, source: null })).not.toMatch(/gametora\.com/);
  });
});
