// Parsing of official news posts (scripts/lib/news.js), on strings taken from real posts.

import { describe, it, expect } from 'vitest';
import { parsePeriod, toRecord } from '../scripts/lib/news.js';
import { summarize } from '../scripts/fetch-news.js';

describe('parsePeriod', () => {
  it.each([
    [
      '10:00 p.m., Oct 7–9:59 p.m., Oct 15, 2026 (UTC)',
      { start: '2026-10-07T22:00:00.000Z', end: '2026-10-15T21:59:00.000Z' },
    ],
    [
      '3:00 p.m., Jul 23 - 2:59 p.m., Aug 28, 2026 (UTC)',
      { start: '2026-07-23T15:00:00.000Z', end: '2026-08-28T14:59:00.000Z' },
    ],
    [
      'July 27–11:59 p.m., August 2, 2026 (UTC)',
      { start: '2026-07-27T00:00:00.000Z', end: '2026-08-02T23:59:00.000Z' },
    ],
    [
      'Apr 7, 2026 - 11:59 p.m., Apr 13, 2026 (UTC)',
      { start: '2026-04-07T00:00:00.000Z', end: '2026-04-13T23:59:00.000Z' },
    ],
    [
      'Jun 26, 2025 - Jul 10, 2025, 11:59 p.m. (UTC)',
      { start: '2025-06-26T00:00:00.000Z', end: '2025-07-10T23:59:00.000Z' },
    ],
    ['From 10:00 p.m., Sep 15, 2026 (UTC) (No time limit)', { start: '2026-09-15T22:00:00.000Z', end: null }],
    [
      '10:00 p.m., Dec 28–9:59 p.m., Jan 4, 2027 (UTC)',
      { start: '2026-12-28T22:00:00.000Z', end: '2027-01-04T21:59:00.000Z' },
    ],
    ['No time limit', { start: null, end: null }],
  ])('%s', (text, expected) => {
    expect(parsePeriod(text, 2026)).toEqual(expected);
  });
});

const BANNER = {
  announce_id: 1089,
  title: 'Spotlight Pretty Derby and Spotlight Support Card Scouts out now!',
  post_at: '2026-10-07 22:00:00',
  update_at: null,
  announce_label: 1,
  image: 'thumb.png',
  message: [
    ' As of 10:00 p.m., Oct 7, 2026 (UTC), a new Spotlight Pretty Derby Scout and Spotlight Support Card Scout have begun!<br>',
    '<h2 class="heading"> Spotlight Scout Availability Period</h2>',
    ' 10:00 p.m., Oct 7–9:59 p.m., Oct 15, 2026 (UTC)<br>',
    '<h2 class="heading"> Trainee Umamusume</h2>',
    '<figure><img src="https://assets.example/Header/gacha_banner_30134_L1791410400.png?c=1"></figure>',
    ' ■ Debut Trainee Umamusume (Spotlight)<br>',
    ' ★★★ [Heroic Author] Zenno Rob Roy<br>',
    ' ■ Spotlight Trainee Umamusume<br>',
    ' ★★★ [Heroic Author] Zenno Rob Roy<br>',
    '<h2 class="heading"> Support Cards</h2>',
    '<figure><img src="https://assets.example/Header/gacha_banner_30135_L1791410400.png?c=1"></figure>',
    ' • SSR [From the Ground Up] Light Hello<br>',
    ' • SSR [Party Formation] Mayano Top Gun<br>',
  ].join('\n'),
};

describe('toRecord', () => {
  it('reads a banner post: period, trainees and support cards (each once)', () => {
    const record = toRecord(BANNER, { from_date: '2026-10-07 22:00:00', to_date: null, image_big: 'big.png' });
    expect(record).toMatchObject({
      id: 1089,
      url: 'https://umamusume.com/news/1089/',
      label: 'news',
      kind: 'banner',
      posted: '2026-10-07T22:00:00Z',
      from: '2026-10-07T22:00:00Z',
      image: 'big.png',
      periods: [
        {
          heading: 'Spotlight Scout Availability Period',
          start: '2026-10-07T22:00:00.000Z',
          end: '2026-10-15T21:59:00.000Z',
        },
      ],
      banners: [
        { id: 30134, start: '2026-10-07T22:00:00.000Z', end: '2026-10-15T21:59:00.000Z' },
        { id: 30135, start: '2026-10-07T22:00:00.000Z', end: '2026-10-15T21:59:00.000Z' },
      ],
      trainees: [{ stars: 3, title: 'Heroic Author', name: 'Zenno Rob Roy' }],
      cards: [
        { rarity: 'SSR', title: 'From the Ground Up', name: 'Light Hello' },
        { rarity: 'SSR', title: 'Party Formation', name: 'Mayano Top Gun' },
      ],
    });
  });

  it('gives each banner the scout period above it, once', () => {
    const message = [
      '<h2>First Scout Availability Period</h2>10:00 p.m., Oct 7–9:59 p.m., Oct 15, 2026 (UTC)<br>',
      '<img src="gacha_banner_30001_L1.png">',
      '<h2>Story Sneak Peek Period</h2>10:00 p.m., Nov 1–9:59 p.m., Nov 3, 2026 (UTC)<br>',
      '<img src="gacha_banner_30002_L1.png">',
      '<h2>Second Scout Availability Period</h2>10:00 p.m., Oct 10–9:59 p.m., Oct 20, 2026 (UTC)<br>',
      '<img src="gacha_banner_30003_L1.png"><img src="gacha_banner_30003_L1.png">',
    ].join('\n');
    expect(toRecord({ ...BANNER, message }).banners.map((b) => [b.id, b.start.slice(0, 10)])).toEqual([
      [30001, '2026-10-07'],
      [30002, '2026-10-07'],
      [30003, '2026-10-10'],
    ]);
  });

  it.each([
    ['The story event Illuminate the Heart is here!', 1, 'event'],
    ['The league selection period for the Champions Meeting: Sagittarius Cup has begun!', 1, 'event'],
    ['New Spotlight Pretty Derby and Spotlight Support Card Scouts coming soon!', 1, 'banner'],
    ['Issue with Obtaining Scout Points in the Aim for the Stars! Dream Team Event', 1, 'other'],
    ['Check out all the latest updates!', 3, 'update'],
    ['Updates to Recommended Devices', 1, 'other'],
  ])('classifies "%s"', (title, label, kind) => {
    expect(toRecord({ announce_id: 1, title, post_at: null, announce_label: label, message: '' }).kind).toBe(kind);
  });
});

describe('summarize', () => {
  it('lists new posts by kind, or says nothing is new', () => {
    const date = new Date('2026-10-08T00:00:00Z');
    expect(summarize([], [], date)).toContain('No new announcements.');
    const summary = summarize([toRecord(BANNER)], [], date);
    expect(summary).toContain('1 new, 0 updated.');
    expect(summary).toContain('## New: Banners');
    expect(summary).toContain(
      'Support cards: SSR [From the Ground Up] Light Hello, SSR [Party Formation] Mayano Top Gun'
    );
  });
});
