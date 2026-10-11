// Global's events from the news: posts cut into blocks (scripts/lib/event-blocks.js), what they give
// (scripts/lib/event-rewards.js) and the events they make (scripts/lib/events.js), on HTML trimmed from real posts.

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventBlocks } from '../scripts/lib/event-blocks.js';
import { cardIndex, cardsIn, itemsIn, missionsIn, titlesIn } from '../scripts/lib/event-rewards.js';
import { EVENT_KINDS, buildEvents, cmItems, postEvents } from '../scripts/lib/events.js';
import { POSTS_FILE } from '../scripts/lib/news-api.js';
import { categorize } from '../scripts/lib/post-categories.js';

const h2 = (text) => `<h2 class="heading"> ${text}</h2>\n`;
const art = (id) =>
  `<figure><img src="https://example.com/uploads/Header/header_${id}_L1791410400.png?c=1"></figure>\n`;
const lines = (...list) => list.map((l) => ` ${l}<br>\n`).join('');
const post = (id, title, message, posted = '2026-10-07 22:00:00') => ({
  announce_id: id,
  title,
  message,
  post_at: posted,
  image_big: `https://example.com/uploads/Header/banner_${id}.png`,
});

const CARDS = {
  30125: { rarity: 'SSR', title: { en: "[Don't Stop Anymore!]" }, name: { en: 'Sakura Laurel' } },
  30145: { rarity: 'SSR', title: { en: '[Welcome to Umayuru]' }, name: { en: 'Tanino Gimlet' } },
  30121: { rarity: 'SSR', title: { en: '[U & Me]' }, name: { en: 'Mihono Bourbon' } },
};
const INDEX = cardIndex(CARDS);

describe('eventBlocks', () => {
  it('cuts a post at its header art, the intro going with the first block; scout art is no boundary', () => {
    const message = [
      lines('As of 10:00 p.m., Oct 7, 2026 (UTC), part 2 of our Holiday Celebration has begun!'),
      art(26800001),
      h2('Availability Period'),
      lines('10:00 p.m., Oct 15–9:59 p.m., Oct 18, 2026 (UTC)'),
      art(26800002),
      lines('As of 10:00 p.m., Oct 7, 2026 (UTC), a Team Trials Rally is now underway!'),
      '<figure><img src="https://example.com/gacha_banner_30134_L1.png"></figure>',
      '<h3 class="subheading">Gift Contents</h3>',
      lines('Carrot Jelly Mini × 3'),
    ].join('');
    const blocks = eventBlocks(post(1093, 'Holiday Celebration Part 2 now available!', message));
    expect(blocks.map((b) => [b.artId, b.intro, b.sections.map((s) => [s.heading, s.lines])])).toEqual([
      [
        '26800001',
        ['As of 10:00 p.m., Oct 7, 2026 (UTC), part 2 of our Holiday Celebration has begun!'],
        [['Availability Period', ['10:00 p.m., Oct 15–9:59 p.m., Oct 18, 2026 (UTC)']]],
      ],
      [
        '26800002',
        ['As of 10:00 p.m., Oct 7, 2026 (UTC), a Team Trials Rally is now underway!'],
        [['Gift Contents', ['Carrot Jelly Mini × 3']]],
      ],
    ]);
  });

  it('keeps a post without header art whole', () => {
    expect(eventBlocks(post(1, 'x', `${lines('Hello')}${h2('Availability Period')}`))).toHaveLength(1);
  });
});

describe('cardsIn', () => {
  it('finds our cards however the post words it, with copies', () => {
    expect(
      cardsIn(
        [
          "• Event-Exclusive SSR Support Card: [Don't Stop Anymore!] Sakura Laurel",
          'Trainers will also be gifted with the SSR Support Card "[U & Me] Mihono Bourbon"!',
          'It can be obtained up to two times in the 1.5-Year Anniversary Celebration.',
          '[Welcome to Umayuru] Tanino Gimlet',
          "You'll be able to get a total of five copies of [Welcome to Umayuru] Tanino Gimlet over the celebration!",
        ],
        INDEX
      )
    ).toEqual([
      { id: 30125, rarity: 'SSR', title: "Don't Stop Anymore!", name: 'Sakura Laurel', copies: null },
      { id: 30121, rarity: 'SSR', title: 'U & Me', name: 'Mihono Bourbon', copies: 2 },
      { id: 30145, rarity: 'SSR', title: 'Welcome to Umayuru', name: 'Tanino Gimlet', copies: 5 },
    ]);
  });

  it('skips trainees, unknown cards and cards that only boost the event', () => {
    expect(
      cardsIn(
        [
          '★★★ [Heroic Author] Zenno Rob Roy',
          '[Unknown Title] Someone',
          "Event bonus cards: [Don't Stop Anymore!] Sakura Laurel",
        ],
        INDEX
      )
    ).toEqual([]);
  });
});

describe('itemsIn', () => {
  it('sums "Item × N" lines: login day ranges, dated gift rows, aliases', () => {
    expect(
      itemsIn([
        'Login Day 1: Carats × 150',
        'Login Day 3: Friend Pt × 500',
        'Login Days 8-12: Support Pt × 1000',
        '10:00 p.m., Oct 7, 2026 (UTC) – Carrot Jelly Mini × 3',
        '3:00 p.m., Oct 8, 2026 (UTC) – Carrot Jelly Mini × 3',
        '• Monies × 500',
        '• Support Points × 500',
      ])
    ).toEqual([
      { name: 'Carats', count: 150 },
      { name: 'Friend Points', count: 500 },
      { name: 'Support Points', count: 5500 },
      { name: 'Carrot Jelly Mini', count: 6 },
      { name: 'Monies', count: 500 },
    ]);
  });

  it('reads gifts from prose only when no list gives them, never fees', () => {
    expect(itemsIn(["To celebrate, we've sent a gift of 3,000 carats to all trainers!"])).toEqual([
      { name: 'Carats', count: 3000 },
    ]);
    expect(itemsIn(['you can obtain 500 carats as a holiday gift!', 'Carats × 500'])).toEqual([
      { name: 'Carats', count: 500 },
    ]);
    expect(itemsIn(['(Entries after the first require an entry fee of 30 carats.)'])).toEqual([]);
  });

  it('names rewards given without amounts', () => {
    expect(
      itemsIn([
        'Main Rewards',
        '• Rainbow Crystal Shards',
        '• Carats',
        'Available Attempts',
        'By attempting these missions, you can earn various rewards, including a 1.5-Year Anniversary SSR Voucher and carats!',
      ])
    ).toEqual([
      { name: 'Rainbow Crystal Shards', count: null },
      { name: 'Carats', count: null },
      { name: '1.5-Year Anniversary SSR Voucher', count: null },
    ]);
  });
});

describe('titlesIn / missionsIn', () => {
  it('reads titles, one or a list', () => {
    expect(titlesIn(['• Event-Exclusive Title: Illuminate the Heart'])).toEqual(['Illuminate the Heart']);
    expect(titlesIn(['■ Event-Exclusive Titles', '• Libra Cup Platinum', '• Libra Cup Gold', 'Other text'])).toEqual([
      'Libra Cup Platinum',
      'Libra Cup Gold',
    ]);
  });

  it('reads mission sets with their periods', () => {
    expect(
      missionsIn(['Sprinters Stakes Missions', '10:00 p.m., Aug 12 – 2:59 p.m., Aug 19, 2026 (UTC)'], 2026)
    ).toEqual([
      { name: 'Sprinters Stakes Missions', start: '2026-08-12T22:00:00.000Z', end: '2026-08-19T14:59:00.000Z' },
    ]);
  });
});

const STORY = post(
  1077,
  'The story event Illuminate the Heart is here!',
  [
    lines('As of 10:00 p.m., Sep 28, 2026 (UTC), the story event Illuminate the Heart has begun!'),
    art(30100058),
    h2('Event Availability Period'),
    lines('10:00 p.m., Sep 28–9:59 p.m., Oct 12, 2026 (UTC)'),
    h2('Reward Collection Period'),
    lines('10:00 p.m., Oct 12–9:59 p.m., Oct 15, 2026 (UTC)'),
    h2('Event Overview'),
    lines(
      "• Event-Exclusive SSR Support Card: [Don't Stop Anymore!] Sakura Laurel",
      '• Event-Exclusive Title: Illuminate the Heart'
    ),
    art(30100057),
    lines('By collecting Event Points and clearing event missions, you can obtain the following rewards:'),
  ].join(''),
  '2026-09-28 22:00:00'
);

const CELEBRATION = post(
  902,
  '1.5-Year Anniversary Celebration Part 2 now available!',
  [
    art(25500005),
    lines(
      'To express our gratitude, part two of our 1.5-Year Anniversary Celebration has begun as of 10:00 p.m., Jul 22, 2026 (UTC)!'
    ),
    art(25500001),
    lines(
      'As of 10:00 p.m., Jul 22, 2026 (UTC), the new Career scenario "Brighter Together!" has been added to the game!'
    ),
    art(22000006),
    lines("To celebrate the game's 1.5-Year Anniversary, we've sent a gift of 3,000 carats to all trainers!"),
    h2('Gift Contents'),
    lines('• Carats × 3,000'),
    art(25500003),
    lines(
      'Trainers will also be gifted with the SSR Support Card "[U & Me] Mihono Bourbon"!',
      'It can be obtained up to two times in the 1.5-Year Anniversary Celebration.'
    ),
    h2('Availability Period'),
    lines('10:00 p.m., Jul 22 - 2:59 p.m., Aug 28, 2026 (UTC)'),
    art(25500002),
    lines('As of 10:00 p.m., Jul 22, 2026 (UTC), the 1.5-Year Anniversary Celebration Login Bonus has begun!'),
    h2('Availability Period'),
    lines('10:00 p.m., Jul 22 - 2:59 p.m., Aug 28, 2026 (UTC)'),
  ].join(''),
  '2026-07-22 22:00:00'
);

describe('postEvents', () => {
  it('keeps a one-event post whole, whatever art it shows', () => {
    const events = postEvents(STORY, INDEX);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: '1077',
      kind: 'story',
      name: 'Illuminate the Heart',
      parent: null,
      start: '2026-09-28T22:00:00.000Z',
      end: '2026-10-12T21:59:00.000Z',
      titles: ['Illuminate the Heart'],
      news_url: 'https://umamusume.com/news/1077/',
      image: 'https://example.com/uploads/Header/banner_1077.png',
    });
    expect(events[0].cards.map((c) => c.id)).toEqual([30125]);
  });

  it('makes a sub-event of every celebration block with dates or gift contents of its own', () => {
    const events = postEvents(CELEBRATION, INDEX);
    expect(events.map((e) => [e.id, e.kind, e.name, e.parent, e.start, e.end])).toEqual([
      [
        '902',
        'celebration',
        '1.5-Year Anniversary Celebration Part 2',
        null,
        '2026-07-22T22:00:00.000Z',
        '2026-08-28T14:59:00.000Z',
      ],
      ['902-2', 'gift', 'A gift of 3,000 carats', '902', '2026-07-22T22:00:00.000Z', null],
      [
        '902-3',
        'gift',
        'SSR Support Card [U & Me] Mihono Bourbon',
        '902',
        '2026-07-22T22:00:00.000Z',
        '2026-08-28T14:59:00.000Z',
      ],
      [
        '902-4',
        'login_bonus',
        '1.5-Year Anniversary Celebration Login Bonus',
        '902',
        '2026-07-22T22:00:00.000Z',
        '2026-08-28T14:59:00.000Z',
      ],
    ]);
    expect(events[1].items).toEqual([{ name: 'Carats', count: 3000 }]);
    expect(events[2].cards).toEqual([{ id: 30121, rarity: 'SSR', title: 'U & Me', name: 'Mihono Bourbon', copies: 2 }]);
  });

  it('skips reminders and posts that are no events', () => {
    expect(postEvents(post(963, '1.5-Year Anniversary Celebrations ending soon!', lines('…')))).toEqual([]);
    expect(postEvents(post(1097, 'Data Update', lines('…')))).toEqual([]);
  });
});

const cm = (id, title, periods, posted) =>
  post(
    id,
    title,
    [
      h2('Event Availability Period'),
      lines(...periods),
      h2('Event Rewards'),
      lines('■ Event-Exclusive Titles', '• Libra Cup Platinum'),
    ].join(''),
    posted
  );

describe('buildEvents', () => {
  it("merges an event's posts: dates from the most advanced one, ended posts joining", () => {
    const events = buildEvents([
      cm(
        945,
        'The race event Champions Meeting: Libra Cup is coming in late August!',
        ['League Selection: From 10:00 p.m., Aug 25, 2026 (UTC)'],
        '2026-08-15 22:00:00'
      ),
      cm(
        991,
        'The league selection period for the Champions Meeting: Libra Cup has begun!',
        [
          '10:00 p.m., Aug 28–9:59 p.m., Sep 3, 2026 (UTC)',
          'League Selection: 10:00 p.m., Aug 25–9:59 p.m., Sep 1, 2026 (UTC)',
        ],
        '2026-08-25 22:00:00'
      ),
      post(
        1022,
        'The story event "Hark Back, Run Forward" is coming soon!',
        `${h2('Event Availability Period')}${lines('10:00 p.m., Sep 7–9:59 p.m., Sep 19, 2026 (UTC)')}`,
        '2026-09-03 22:00:00'
      ),
      post(
        1024,
        'The story event "Hark Back, Run Forward" has ended!',
        `${h2('Reward Collection Period')}${lines('10:00 p.m., Sep 19–9:59 p.m., Sep 22, 2026 (UTC)')}`,
        '2026-09-19 22:00:00'
      ),
    ]);
    expect(events.map((e) => [e.id, e.kind, e.name, e.start, e.end, e.news_url])).toEqual([
      [
        '1022',
        'story',
        'Hark Back, Run Forward',
        '2026-09-07T22:00:00.000Z',
        '2026-09-19T21:59:00.000Z',
        'https://umamusume.com/news/1022/',
      ],
      [
        '945',
        'champions_meeting',
        'Libra Cup',
        '2026-08-25T22:00:00.000Z',
        '2026-09-03T21:59:00.000Z',
        'https://umamusume.com/news/991/',
      ],
    ]);
    expect(events[1].titles).toEqual(['Libra Cup Platinum']);
  });

  it('keeps same-named events apart when their dates do', () => {
    const bonus = (id, period, posted) =>
      post(id, 'Bonus Star Piece rewards in Career!', `${h2('Race / Period / Rewards')}${lines(period)}`, posted);
    const events = buildEvents([
      bonus(1041, '3:00 p.m., Oct 4–2:59 p.m., Oct 6, 2026 (UTC)', '2026-10-04 22:00:00'),
      bonus(1042, '3:00 p.m., Oct 6–2:59 p.m., Oct 8, 2026 (UTC)', '2026-10-06 22:00:00'),
    ]);
    expect(events.map((e) => e.id)).toEqual(['1042', '1041']);
  });

  it("gives Champions Meetings the hand table's range", () => {
    const table = [
      {
        since: '2025-06-26',
        final: [
          { carats: 100, monies: null },
          { carats: 300, monies: 5000 },
        ],
      },
      { since: '2027-01-01', final: [{ carats: 999 }] },
    ];
    expect(cmItems(table, '2026-08-28T22:00:00.000Z')).toEqual([
      { name: 'Carats', count: { min: 100, max: 300 } },
      { name: 'Monies', count: { min: 5000, max: 5000 } },
    ]);
    const events = buildEvents(
      [
        cm(
          991,
          'The league selection period for the Champions Meeting: Libra Cup has begun!',
          ['10:00 p.m., Aug 25–9:59 p.m., Sep 3, 2026 (UTC)'],
          '2026-08-25 22:00:00'
        ),
      ],
      { cmTable: table }
    );
    expect(events.map((e) => [e.id, e.source])).toEqual([['991', 'news']]);
    expect(events[0].items).toEqual(cmItems(table, events[0].start));
  });
});

describe('mission sets', () => {
  it('makes every mission set an event lists a bar of its own under it', () => {
    const fall = post(
      948,
      'Fall G1 Celebration Part 1 now available!',
      [
        h2('Availability Periods'),
        lines(
          'Sprinters Stakes Missions',
          '10:00 p.m., Aug 12 – 2:59 p.m., Aug 19, 2026 (UTC)',
          'Shuka Sho Missions',
          '3:00 p.m., Aug 25 – 2:59 p.m., Sep 1, 2026 (UTC)'
        ),
      ].join(''),
      '2026-08-12 22:00:00'
    );
    expect(buildEvents([fall]).map((e) => [e.id, e.kind, e.name, e.parent, e.start, e.end])).toEqual([
      ['948-m2', 'missions', 'Shuka Sho Missions', '948', '2026-08-25T15:00:00.000Z', '2026-09-01T14:59:00.000Z'],
      [
        '948-m1',
        'missions',
        'Sprinters Stakes Missions',
        '948',
        '2026-08-12T22:00:00.000Z',
        '2026-08-19T14:59:00.000Z',
      ],
      [
        '948',
        'celebration',
        'Fall G1 Celebration Part 1',
        null,
        '2026-08-12T22:00:00.000Z',
        '2026-09-01T14:59:00.000Z',
      ],
    ]);
  });
});

describe.skipIf(!existsSync(POSTS_FILE))('the stored news', () => {
  const posts = JSON.parse(readFileSync(POSTS_FILE, 'utf8'));
  const events = buildEvents(posts);

  it('makes every event post into dated events of known kinds', () => {
    for (const p of posts) {
      const c = categorize(p);
      if (c.category === 'event' && !['ending', 'ended'].includes(c.phase))
        expect({ id: p.announce_id, events: postEvents(p).length > 0 }).toEqual({ id: p.announce_id, events: true });
    }
    expect(events.filter((e) => !e.start || !EVENT_KINDS.includes(e.kind))).toEqual([]);
  });

  it('gives every story event its card', () => {
    const cardsFile = new URL('../generated/cards.json', import.meta.url);
    if (!existsSync(cardsFile)) return;
    const withCards = buildEvents(posts, { cards: JSON.parse(readFileSync(cardsFile, 'utf8')) });
    const stories = withCards.filter((e) => e.kind === 'story');
    expect(stories.length).toBeGreaterThan(0);
    expect(stories.filter((e) => !e.cards.some((c) => c.id && c.rarity === 'SSR')).map((e) => e.name)).toEqual([]);
  });
});
