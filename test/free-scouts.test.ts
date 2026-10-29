import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readCategories } from '../scripts/lib/categories.ts';
import { eventFragments } from '../scripts/lib/events.ts';
import { applyAnswer } from '../scripts/lib/event-questions.ts';
import { type ScoutWindow, bannerOf, scoutWindows, windowScouts, withFreePulls } from '../scripts/lib/free-scouts.ts';
import type { BannerFile } from '../shared/schemas/banner.ts';
import type { PullGuide } from '../shared/schemas/pullGuide.ts';
import type { GameEvent } from '../shared/schemas/event.ts';
import { fixture } from './helpers.ts';
import { postsFile } from '../scripts/lib/news-api.ts';
import { en, ja } from '../scripts/lib/news-lang/index.ts';

const windows = (lines: string[], year = 2026) => scoutWindows(lines, year, en);

describe('windowScouts', () => {
  it('counts the resets in a window, plus one when it opens off a reset', () => {
    // 10:00 p.m., Oct 20 – 9:59 p.m., Oct 24: opens, then resets on the 21st to the 24th
    expect(windowScouts('2026-10-20T22:00:00Z', '2026-10-24T21:59:00Z', 15, true)).toBe(5);
    // carrying on the window before: only the resets (25th to 29th; the 30th's comes after its end)
    expect(windowScouts('2026-10-24T22:00:00Z', '2026-10-30T14:59:00Z', 15, false)).toBe(5);
    // opening on a reset: that reset is its first scout
    expect(windowScouts('2026-04-29T15:00:00Z', '2026-05-09T14:59:00Z', 15, true)).toBe(10);
  });
});

describe('scoutWindows', () => {
  it("reads a dedicated post's windows and checks them against its stated total (1124)", () => {
    const read = windows([
      'Each day you log in during this event, you will be able to perform a 10x scout on one of the currently available Scouts, up to a maximum of 10 times.',
      'Daily Free 10x Scout Event Eligible Scout Availability Period',
      '• Spotlight Support Card Scout',
      '10:00 p.m., Oct 20–9:59 p.m., Oct 24, 2026 (UTC)',
      '• Spotlight Pretty Derby Scout',
      '10:00 p.m., Oct 24–2:59 p.m., Oct 30, 2026 (UTC)',
      'Example: If you do not log in between 10:00 p.m., Oct 20 and 2:59 p.m., Oct 25 (UTC), and log in for the first time at 3:00 p.m., Oct 25 (UTC), you can use 6 free 10x scouts on the Spotlight Pretty Derby Scout.',
    ]);
    expect(read).toEqual({
      scouts: [
        {
          scout: 'Spotlight Support Card Scout',
          type: 'support',
          start: '2026-10-20T22:00:00.000Z',
          end: '2026-10-24T21:59:00.000Z',
          size: 10,
          scouts: 5,
        },
        {
          scout: 'Spotlight Pretty Derby Scout',
          type: 'character',
          start: '2026-10-24T22:00:00.000Z',
          end: '2026-10-30T14:59:00.000Z',
          size: 10,
          scouts: 5,
        },
      ],
      doubt: null,
    });
  });

  it('reads parallel windows with their stated days (763), and single scouts', () => {
    const read = windows([
      'Trainers can draw one free scout per day during the event availability period!',
      'Availability Period',
      '• Spotlight Support Card Scout',
      '10:00 p.m., Apr 26 - 2:59 p.m., May 6, 2026 (UTC) (10 days)',
      '• Spotlight Pretty Derby Scout',
      '3:00 p.m., Apr 29 - 2:59 p.m., May 9, 2026 (UTC) (10 days)',
    ]);
    expect(read?.scouts.map((w) => [w.type, w.size, w.scouts])).toEqual([
      ['support', 1, 10],
      ['character', 1, 10],
    ]);
    expect(read?.doubt).toBeNull();
  });

  it("sizes each window by the sentence naming its scout (364: a single scout's campaign, then a 10x's)", () => {
    const read = windows(
      [
        'During this period, you can perform a free single scout each day on the applicable Spotlight Pretty Derby Scout.',
        '• Spotlight Pretty Derby Scout',
        '10:00 p.m., Oct 26 - 9:59 p.m., Nov 6, 2025 (UTC)',
        'During this period, you can perform a free 10x scout each day on the applicable Spotlight Support Card Scout.',
        '• Spotlight Support Card Scout',
        '10:00 p.m., Nov 6 - 2:59 p.m., Nov 16, 2025 (UTC)',
      ],
      2025
    );
    // (The 10x window opens: it doesn't carry on the single scout's.)
    expect(read?.scouts.map((w) => [w.type, w.size, w.scouts])).toEqual([
      ['character', 1, 12],
      ['support', 10, 10],
    ]);
  });

  it('doubts windows that miss the stated total or days, and free scouts without windows', () => {
    const daily =
      'Each day you log in during this event, you will be able to perform a 10x scout on one of the currently available Scouts, up to a maximum of 12 times.';
    const window = ['• Spotlight Support Card Scout', '10:00 p.m., Oct 20–9:59 p.m., Oct 24, 2026 (UTC)'];
    expect(windows([daily, ...window])?.doubt).toBe('the windows give 5 free scouts, the post says 12');
    expect(windows(['Trainers can draw one free scout per day!', ...window, '(9 days total)'])?.doubt).toBe(
      'a window gives 5 days, the post says 9'
    );
    expect(windows([daily, 'Jun 26 - 9:59 p.m., Jul 2, 2025 (UTC) (7 days total)'])).toEqual({
      scouts: [],
      doubt: 'free scouts, but no windows the rules read',
    });
    expect(
      windows(['Each day you log in, you will receive a present of 150 carats, up to a maximum of 450!'])
    ).toBeNull();
  });
});

describe('scoutWindows (JP)', () => {
  const jp = (lines: string[], posted: string) => scoutWindows(lines, posted, ja);

  it('reads a window per scout, checked against 最大N回 (1190; resets at 5:00 JST)', () => {
    const read = jp(
      [
        '期間中に毎日ログインすると、開催中のガチャの[10回引く!]を最大12回まで1日1回無料で引けます。',
        '1日1回10連ガチャ無料キャンペーン対象ガチャ開催期間',
        '・2nd Anniversary サポートカードガチャ',
        '2/24 12:00 ～ 3/8 4:59',
      ],
      '2023-02-24T03:00:00Z'
    );
    expect(read).toEqual({
      scouts: [
        {
          scout: '2nd Anniversary サポートカードガチャ',
          type: 'support',
          start: '2023-02-24T03:00:00.000Z',
          end: '2023-03-07T19:59:00.000Z',
          size: 10,
          scouts: 12,
        },
      ],
      doubt: null,
    });
  });

  it("gives a list of scouts the campaign's period (3403)", () => {
    const read = jp(
      [
        '期間中にログインすると、開催中のガチャの[10回引く!]を最大10回まで無料で引けます。',
        '開催期間',
        '8/24 12:00 ～ 9/3 4:59',
        '対象ガチャ',
        '・5.5th Anniv. サポートカードガチャ',
      ],
      '2026-08-24T03:00:00Z'
    );
    expect(read?.scouts.map((w) => [w.type, w.start, w.end, w.size, w.scouts])).toEqual([
      ['support', '2026-08-24T03:00:00.000Z', '2026-09-02T19:59:00.000Z', 10, 10],
    ]);
    expect(read?.doubt).toBeNull();
  });

  it('reads single scouts and checks each window against its 日分 (3145)', () => {
    const lines = [
      'キャンペーン期間中にログインすると、開催中のガチャの[1回引く!]を1日1回無料で引けます。',
      '開催期間',
      '・ピックアップ プリティーダービーガチャ',
      '3/19 12:00 ～ 3/21 4:59（2日分）',
      '・5th Anniv.セレクトピックアップ サポートカードガチャ',
      '3/19 12:00 ～ 3/30 4:59（11日分）',
    ];
    const read = jp(lines, '2026-03-19T03:00:00Z');
    expect(read?.scouts.map((w) => [w.type, w.size, w.scouts])).toEqual([
      ['character', 1, 2],
      ['support', 1, 11],
    ]);
    expect(read?.doubt).toBeNull();
    expect(jp(lines.with(3, '3/19 12:00 ～ 3/21 4:59（3日分）'), '2026-03-19T03:00:00Z')?.doubt).toBe(
      'a window gives 2 days, the post says 3'
    );
  });
});

describe('bannerOf / withFreePulls', () => {
  const banner = (id: number, start: string, end: string, more = {}) =>
    fixture<BannerFile['cards'][number]>({ id, start: { date: start }, end: { date: end }, ...more });
  const banners = fixture<BannerFile>({
    characters: [banner(30138, '2026-10-24T22:00:00Z', '2026-11-05T21:59:59Z')],
    cards: [
      banner(30137, '2026-10-14T22:00:00Z', '2026-10-27T21:59:59Z'),
      banner(30139, '2026-10-20T22:00:00Z', '2026-11-01T21:59:59Z'),
      banner(30141, '2026-10-22T22:00:00Z', '2026-11-03T21:59:59Z'),
    ],
  });
  const window = (more: Partial<ScoutWindow> = {}): ScoutWindow => ({
    scout: 'Spotlight Support Card Scout',
    type: 'support',
    start: '2026-10-20T22:00:00.000Z',
    end: '2026-10-24T21:59:00.000Z',
    size: 10,
    scouts: 5,
    ...more,
  });

  it("takes the newest banner of the window's type open when it starts, not one opening later in it", () => {
    expect(bannerOf(window(), banners)).toBe(30139);
    expect(bannerOf(window({ type: 'character', start: '2026-10-24T22:00:00.000Z' }), banners)).toBe(30138);
    expect(bannerOf(window({ start: '2026-10-01T22:00:00.000Z' }), banners)).toBeNull();
  });

  it('prefers the banner named as the scout, never a paid one (JP)', () => {
    const jp = {
      ...banners,
      cards: [
        banner(30139, '2026-10-20T22:00:00Z', '2026-11-01T21:59:59Z', { name: 'ピックアップ サポートカードガチャ' }),
        banner(50001, '2026-10-20T22:00:00Z', '2026-11-01T21:59:59Z', { paid: true }),
        banner(30141, '2026-10-20T22:00:00Z', '2026-11-01T21:59:59Z', { name: 'プレミアム サポートカードガチャ' }),
      ],
    };
    expect(bannerOf(window({ scout: 'ピックアップ サポートカードガチャ' }), jp)).toBe(30139);
  });

  it("adds up a banner's pulls, a window two posts list counted once", () => {
    const w = { ...window(), banner: 30139 };
    const event = (id: string, scouts: object[]) => fixture<GameEvent>({ id, scouts });
    const out = withFreePulls(
      { ...banners, cards: banners.cards.map((b) => (b.id === 30137 ? { ...b, free_pulls: 30 } : b)) },
      [event('364-4', [w]), event('373-2', [w]), event('1124', [{ ...w, start: '2026-10-25T22:00:00.000Z' }])]
    );
    expect(out.cards.map((b) => [b.id, b.free_pulls])).toEqual([
      [30137, undefined],
      [30139, 100],
      [30141, undefined],
    ]);
  });
});

describe("a model's free scout answer", () => {
  // The launch's free scout (121), which the rules don't read: labelled windows, the first without a time.
  const LAUNCH = [
    'Each day you log in during this celebration, you will be able to perform a single scout on one of the currently available scout banners, up to a maximum of 15 times.',
    'Availability Period',
    'Pretty Derby Scout:',
    'Jun 26 - 9:59 p.m., Jul 2, 2025 (UTC) (7 days total)',
    'Support Card Scout:',
    '10:00 p.m., Jul 2 - 9:59 p.m., Jul 9, 2025 (UTC) (8 days total)',
  ].join('\n');
  const event = {
    id: '121-6',
    kind: 'campaign',
    name: 'Daily Free Scout',
    parent: '121',
    cards: [],
    items: [],
    start: '2025-06-26T00:30:00.000Z',
    end: null,
    text: LAUNCH,
    posted: '2025-06-26T00:30:00.000Z',
    doubts: { scouts: 'free scouts, but no windows the rules read' },
    scouts: [] as ScoutWindow[],
  };
  const windows = [
    { scout: 'Pretty Derby Scout', start: '2025-06-26 00:00', end: '2025-07-02 21:59', days: 7 },
    { scout: 'Support Card Scout', start: '2025-07-02 22:00', end: '2025-07-09 21:59', days: 8 },
  ];
  const apply = (scouts: unknown) => applyAnswer(event, { scouts }).scouts;

  it('takes windows that add up to the stated total, their stated days standing', () => {
    expect(apply({ windows, total: 15 })?.map((w) => [w.scout, w.type, w.size, w.scouts])).toEqual([
      ['Pretty Derby Scout', 'character', 1, 7],
      ['Support Card Scout', 'support', 1, 8],
    ]);
  });

  it("drops an answer whose total, days or scout names the text doesn't have, or that doesn't add up", () => {
    expect(apply({ windows, total: 16 })).toEqual([]);
    expect(apply({ windows: windows.with(1, { ...windows[1], days: 9 }), total: 15 })).toEqual([]);
    expect(apply({ windows: windows.with(0, { ...windows[0], scout: 'Legend Scout' }), total: 15 })).toEqual([]);
    expect(apply({ windows: windows.slice(1), total: 15 })).toEqual([]);
    expect(apply({ windows: [{ ...windows[0], end: '2025-06-20 21:59' }], total: null })).toEqual([]);
  });
});

describe.skipIf(!existsSync(postsFile('gl')))('the stored news: free scouts', { tags: ['data'] }, () => {
  const posts = JSON.parse(readFileSync(postsFile('gl'), 'utf8'));
  // (Cut as the records are: by the classified posts.)
  const free = eventFragments(posts, {}, en, readCategories('gl')).filter((f) => f.scouts);

  it('reads every free scout campaign, the stated totals matching, except the launch (doubted for the model)', () => {
    expect(free.length).toBeGreaterThan(10);
    expect(free.filter((f) => f.doubts.scouts).map((f) => f.id)).toEqual(['121-6']);
  });
});

describe.skipIf(!existsSync(postsFile('jp')))('the stored JP news: free scouts', { tags: ['data'] }, () => {
  const posts = JSON.parse(readFileSync(postsFile('jp'), 'utf8'));
  const free = eventFragments(posts, {}, ja, readCategories('jp')).filter((f) => f.scouts);

  it('reads every free scout campaign, the stated totals and days matching', () => {
    expect(free.length).toBeGreaterThan(50);
    expect(free.filter((f) => f.doubts.scouts).map((f) => f.id)).toEqual([]);
  });
});

// Luh's Support Card Encyclopedia gives free pulls per banner by hand: ours (from the news) should mostly agree. Its
// slips are listed, not failed on (30073: 5, the post gives 6); most banners disagreeing means our counting broke.
const GUIDE = 'generated/pull_guide.json';
describe.skipIf(!existsSync(GUIDE))("the stored banners' free pulls against Luh's", { tags: ['data'] }, () => {
  const guide: PullGuide = JSON.parse(readFileSync(GUIDE, 'utf8'));
  const banners: BannerFile = JSON.parse(readFileSync('data/global_banners.json', 'utf8'));
  const ours = new Map([...banners.cards, ...banners.characters].map((b) => [String(b.id), b.free_pulls ?? null]));
  const both = Object.entries(guide.banners).flatMap(([id, advice]) => {
    const theirs = Object.values(advice).find((a) => a.freePulls != null)?.freePulls;
    const own = ours.get(id);
    return theirs != null && own != null ? [{ id, ours: own, theirs }] : [];
  });

  it.skipIf(!both.length)('mostly agree (the banners that differ are listed)', async ({ annotate }) => {
    const differ = both.filter((b) => b.ours !== b.theirs);
    if (differ.length)
      await annotate(
        `free pulls differing from Luh's: ${differ.map((b) => `${b.id} ours ${b.ours}, Luh's ${b.theirs}`).join('; ')}`
      );
    expect(differ.length).toBeLessThan(both.length / 2);
  });
});
