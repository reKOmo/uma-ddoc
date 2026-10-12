import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { postsFile } from '../scripts/lib/news-api.js';
import { ja } from '../scripts/lib/news-lang/ja.js';
import { norm, parsePeriodJa } from '../scripts/lib/news-text.js';
import { categorize } from '../scripts/lib/post-categories.js';
import samples from './fixtures/jp-news-samples.json' with { type: 'json' };

const post = (title, { id = 3000, label = 1, message = '' } = {}) => ({
  announce_id: id,
  announce_label: label,
  title,
  message,
});
const of = (title, options) => {
  const { category, kind, phase, name } = categorize(post(title, options), ja);
  return { category, kind, phase, name };
};

describe('parsePeriodJa', () => {
  const at = '2026-09-30T03:00:00Z';
  it('reads JST periods into UTC, ends at their shown minute', () => {
    expect(parsePeriodJa('9/30 12:00 ～ 10/13 11:59', at)).toEqual({
      start: '2026-09-30T03:00:00.000Z',
      end: '2026-10-13T02:59:00.000Z',
    });
    expect(parsePeriodJa('8/9 12:00 〜 8/12 4:59', '2026-08-09T03:00:00Z').end).toBe('2026-08-11T19:59:00.000Z');
  });
  it('takes the year nearest the post, and an end before its start a year later', () => {
    expect(parsePeriodJa('12/26 12:00 ～ 1/8 11:59', '2025-12-26T03:00:00Z')).toEqual({
      start: '2025-12-26T03:00:00.000Z',
      end: '2026-01-08T02:59:00.000Z',
    });
    // a January window in a December post
    expect(parsePeriodJa('1/1 5:00 ～ 1/30 4:59', '2025-12-25T03:00:00Z').start).toBe('2025-12-31T20:00:00.000Z');
  });
  it('keeps given years, open ends and opening sentences', () => {
    expect(parsePeriodJa('2024/5/24 12:00 ～ 2025/3/31 11:59', at)).toEqual({
      start: '2024-05-24T03:00:00.000Z',
      end: '2025-03-31T02:59:00.000Z',
    });
    expect(parsePeriodJa('3/11 12:00 ～ 終了日時未定', '2026-03-10T03:00:00Z')).toEqual({
      start: '2026-03-11T03:00:00.000Z',
      end: null,
    });
    expect(parsePeriodJa('2026年2月24日（火）12:00から', at).start).toBe('2026-02-24T03:00:00.000Z');
    expect(parsePeriodJa('8/9 12:00から、レジェンドレースを開催中です！', '2026-08-09T03:00:00Z').start).toBe(
      '2026-08-09T03:00:00.000Z'
    );
    expect(parsePeriodJa('注意事項', at)).toEqual({ start: null, end: null });
  });
});

describe('categorize (JP)', () => {
  it('reads named events, their names and phases', () => {
    expect(of('ストーリーイベント「神算鬼謀！？春祭！熱闘鬼ドッジ」開催！')).toEqual({
      category: 'event',
      kind: 'story',
      phase: 'started',
      name: '神算鬼謀！？春祭！熱闘鬼ドッジ',
    });
    expect(of('7/14「チャンピオンズミーティング キャンサー杯」開催予定！')).toEqual({
      category: 'event',
      kind: 'champions_meeting',
      phase: 'announced',
      name: 'キャンサー杯',
    });
    expect(of('レースイベント「チャンピオンズミーティング CLASSIC」参加リーグ選択開始！').phase).toBe(
      'league_selection'
    );
    expect(of('レースイベント「リーグ オブ ヒーローズ」開催！').kind).toBe('league_of_heroes');
    expect(of('レジェンドレース開催決定！')).toEqual({
      category: 'event',
      kind: 'legend_race',
      phase: 'announced',
      name: null,
    });
    expect(of('「特別移籍 StarHorse4 Edition」開催！').kind).toBe('transfer_requests');
    expect(of('イベント「アグネスタキオンの因子研究」開催予告！').kind).toBe('factor_research');
    expect(of('イベント「マスターズチャレンジ」期間限定レースの終了迫る！')).toMatchObject({
      kind: 'masters_challenge',
      phase: 'ending',
    });
    expect(of('イベント「トレーナー技能試験」終了！')).toEqual({
      category: 'event',
      kind: 'special',
      phase: 'ended',
      name: 'トレーナー技能試験',
    });
  });

  it('keeps admin posts about events out of the events', () => {
    expect(of('ストーリーイベント「神算鬼謀！？春祭！熱闘鬼ドッジ」のミッションの不具合について').kind).toBe('issue');
    expect(of('「リーグ オブ ヒーローズ」機能不具合に伴うメンテナンス実施のお知らせ').kind).toBe('maintenance');
    expect(of('「チャンピオンズミーティング」の今後の開催について').category).toBe('other');
    expect(of('10月～3月対戦レースイベント').kind).toBe('roundup');
    expect(of('ミッションの追加について').kind).toBe('update');
    expect(of('ガチャの「交換Pt」の仕様変更について').kind).toBe('update');
  });

  it('names campaigns by their brackets only when that is the whole name', () => {
    expect(of('「「ウマ娘 プリティーダービー」×「Number」コラボキャンペーン」開催！').name).toBe(
      '「ウマ娘 プリティーダービー」×「Number」コラボキャンペーン'
    );
    expect(of('『うまゆる ふるげ～と！』配信記念キャンペーン開催中！').name).toBe(
      '『うまゆる ふるげ～と！』配信記念キャンペーン'
    );
    expect(of('秋のGⅠキャンペーン第1弾 開催！')).toMatchObject({
      kind: 'celebration',
      name: '秋のGⅠキャンペーン第1弾',
    });
    expect(of('「育成報酬」ピース追加キャンペーン 開催！').kind).toBe('campaign');
  });

  it('makes a campaign with several parts a celebration', () => {
    const part = (n) => `<figure><img src="https://x/announce/1/Header/header_2120000${n}.png?c=1"></figure>`;
    expect(of('「ゴルシウィークキャンペーン」開催！', { message: part(1) }).kind).toBe('campaign');
    expect(of('「ゴルシウィークキャンペーン」開催！', { message: part(1) + part(2) }).kind).toBe('celebration');
  });

  it('puts community labels aside, but not a maintenance post with label 5', () => {
    expect(of('2.5周年記念 キャンペーン！タップシューズをプレゼント', { label: 3 }).kind).toBe('community');
    expect(of('1/11[育成]機能バランス調整に伴うメンテナンス実施のお知らせ', { label: 5 }).kind).toBe('maintenance');
  });
});

describe('norm', () => {
  it('keeps Japanese letters and folds full-width ones', () => {
    expect(norm('[“最強”なる眷属]')).toBe(norm('最強なる眷属'));
    expect(norm('グランドマスターズ -継ぐ者達へ-')).toBe(norm('グランドマスターズ-継ぐ者達へ-'));
    expect(norm('ＡＢＣ１２３')).toBe('abc123');
  });
});

const file = postsFile('jp');
describe.skipIf(!existsSync(file))('the stored JP news', () => {
  const posts = JSON.parse(readFileSync(file, 'utf8'));
  const byId = new Map(posts.map((p) => [String(p.announce_id), p]));
  const categories = new Map(posts.map((p) => [String(p.announce_id), categorize(p, ja)]));

  it('finds a scout banner in exactly the posts that show scout art, typed', () => {
    const withArt = posts.filter((p) => /gacha_banner_\d+/.test(p.message ?? '')).map((p) => String(p.announce_id));
    const banners = [...categories].filter(([, c]) => c.category === 'banner').map(([id]) => id);
    expect(banners.sort()).toEqual(withArt.sort());
    for (const id of banners) expect(categories.get(id).banners.every((b) => b.type)).toBe(true);
  });

  it("gives the sampled posts their group's category", () => {
    for (const id of Object.keys(samples.banner)) {
      const c = categories.get(id);
      if (/^not a banner/.test(samples.banner[id])) expect(c.category, id).not.toBe('banner');
      else expect(c.category, id).toBe('banner');
    }
    // the named-event samples: every one an event, except the event-named bug posts and the scenario launches
    for (const id of Object.keys(samples.event)) {
      const c = categories.get(id);
      const title = byId.get(id).title;
      if (/不具合/.test(title)) expect(c.category, id).toBe('other');
      else if (/^育成シナリオ/.test(title)) expect(c.kind, id).toBe('scenario');
      else if (byId.get(id).announce_label === 3) expect(c.kind, id).toBe('community');
      else expect(c.category, `${id} ${title}`).toBe('event');
    }
  });
});
