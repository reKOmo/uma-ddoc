// Global's (English) questions: what's asked about each field, the schemas, the examples and the English entry of QUESTIONS.

import { itemName, numberWord } from './event-rewards.ts';
import { DAY } from './news-text.ts';
import type { EventCard } from '../../shared/schemas/event.ts';
import {
  type AskedEvent,
  type Examples,
  type Field,
  type FieldSpec,
  type Questions,
  SCOUTS,
  SUB_EVENT_KINDS,
  inText,
  nullable,
  shownName,
  valid,
} from './event-questions-spec.ts';

const SYSTEM = [
  'You read official news posts of the game Umamusume: Pretty Derby and extract facts about one in-game event.',
  'Answer only from the text given. When the text does not say, answer null.',
  'Never guess, assume a default (like 1 copy) or work a value out from other events: null is better than a wrong answer.',
  'Times in the posts are UTC, like "10:00 p.m., Oct 7, 2026 (UTC)".',
  'Reply with one JSON object matching the schema, nothing else.',
].join(' ');

const KINDS = SUB_EVENT_KINDS;

export const FIELDS: Record<Field, FieldSpec> = {
  items: {
    ask: [
      'items: every reward this event gives one player. For each:',
      '  name: the item as the text names it (e.g. "Carats", "Monies", "Support Points");',
      '  each: the amount given each time (each day, each login, each window), or the whole amount if it is given once;',
      '  times: how many times one player can get it (number of days, logins or windows), 1 if given once, null if the text does not say; when the text lists the days or windows, count the list (counting what is written is not guessing);',
      '  total: the total the text itself states ("up to a total of 5,640"), else null.',
      '  Do not add amounts up yourself. Support cards are not items.',
    ].join('\n'),
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          each: nullable('integer'),
          times: nullable('integer'),
          total: nullable('integer'),
        },
        required: ['name', 'each', 'times', 'total'],
        additionalProperties: false,
      },
    },
  },
  cards: {
    ask: (e: AskedEvent) =>
      `cards: for each of these support cards, how many copies one player can get from THIS event itself (adding up its own parts): ${e.cards.map((c: EventCard) => `[${c.title}] ${c.name}`).join('; ')}. When the text gives copies for several events ("up to two times in the Login Bonus and up to three times in the Missions"), give only this event's share. copies is null if no number of copies is given for this event: naming the card is not "1".`,
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, copies: nullable('integer') },
        required: ['title', 'copies'],
        additionalProperties: false,
      },
    },
  },
  name: {
    ask: 'name: the event\'s own name as the text gives it, short (no "As of …" clause; null if the text only says what kind of event it is, like "a Legend Race").',
    schema: nullable('string'),
  },
  kind: {
    ask: `kind: what this event is, one of ${KINDS.join(', ')} (campaign: a limited-time bonus, e.g. free scouts, halved costs, extra tickets).`,
    schema: { type: ['string', 'null'], enum: [...KINDS, null] },
  },
  dates: {
    ask: 'start and end: when this event itself runs, as "YYYY-MM-DD HH:MM" in UTC. If it has several windows, the start of the first and the end of the last. Not a deadline for starting the game, qualifying or claiming gifts (a gift usually has no end: null). null if the text does not say.',
    schema: null, // start + end
  },
  scouts: {
    ask: 'scouts: the daily free scout. windows: one per eligible scout, in order: scout: its name as the text writes it ("Spotlight Support Card Scout"); start and end: when it is eligible, as "YYYY-MM-DD HH:MM" in UTC (a time the text leaves out: 00:00); days: the number of days the text states for that window ("(9 days total)"), else null. Scouts listed under one shared period each get that period. total: the most free scouts in all the text states ("up to a maximum of 10 times"), else null.',
    schema: SCOUTS,
  },
};

// Worked examples per field, from made-up posts in the news' style (not real ones, so the model learns the pattern,
// not answers): [text, the part of the answer it gives].
export const EXAMPLES: Examples = {
  items: [
    [
      'Each day you log in during the event period, you will receive a gift of 50 carats! This login bonus can be received up to 10 times.',
      { items: [{ name: 'Carats', each: 50, times: 10, total: null }] },
    ],
    [
      'Login Day 1: Carats × 100\nLogin Days 2-6: Support Points × 500\nLogin Day 7: Alarm Clock × 3',
      {
        items: [
          { name: 'Carats', each: 100, times: 1, total: null },
          { name: 'Support Points', each: 500, times: 5, total: null },
          { name: 'Alarm Clock', each: 3, times: 1, total: null },
        ],
      },
    ],
    [
      'Receive a 100-carat gift once in each of these periods:\n10:00 p.m., Jan 5 - 2:59 p.m., Jan 12, 2026 (UTC)\n3:00 p.m., Jan 12 - 2:59 p.m., Jan 19, 2026 (UTC)\n3:00 p.m., Jan 19 - 2:59 p.m., Jan 26, 2026 (UTC)',
      { items: [{ name: 'Carats', each: 100, times: 3, total: null }] },
    ],
    [
      'Every day you log in you will receive a gift of 300 Monies, up to a total maximum of 3,000 Monies!',
      { items: [{ name: 'Monies', each: 300, times: null, total: 3000 }] },
    ],
    [
      'Complete these missions to earn rewards like carats and Rainbow Crystal Shards!',
      {
        items: [
          { name: 'Carats', each: null, times: null, total: null },
          { name: 'Rainbow Crystal Shards', each: null, times: null, total: null },
        ],
      },
    ],
  ],
  cards: [
    [
      '(a gift) The SSR Support Card [Example Title] Example Name can be obtained up to one time from the login bonus and up to two times from the missions, three times in all!',
      { cards: [{ title: 'Example Title', copies: 3 }] },
    ],
    [
      '(the missions) Clear the special missions to earn rewards like carats and SSR [Example Title] Example Name! / Elsewhere in the same post: It can be obtained once from the login bonus and up to four times from the special missions.',
      { cards: [{ title: 'Example Title', copies: 4 }] },
    ],
    [
      '(the missions) Clear the special missions to earn rewards like carats and SSR [Example Title] Example Name!',
      { cards: [{ title: 'Example Title', copies: null }] },
    ],
  ],
  name: [
    [
      'As of 10:00 p.m., Jan 5, 2026 (UTC), the Winter Festival Login Bonus has begun!',
      { name: 'Winter Festival Login Bonus' },
    ],
    ['A Legend Race is here! Challenge Legend Umamusume to obtain a variety of rewards.', { name: null }],
    [
      "We're celebrating the Career Scenario Starlit Stage: Dance On! with a set of special events!",
      { name: 'Starlit Stage: Dance On!' },
    ],
  ],
  kind: [
    ['During this event, the TP cost of starting a Career is halved!', { kind: 'campaign' }],
    ['New outfits and stamps can be bought with Event Coins in a limited-time store!', { kind: 'shop' }],
    ['Thank you for playing! We hope you enjoy the new features.', { kind: null }],
  ],
  dates: [
    [
      'Availability Period\n10:00 p.m., Jan 5 - 2:59 p.m., Jan 12, 2026 (UTC)',
      { start: '2026-01-05 22:00', end: '2026-01-12 14:59' },
    ],
    [
      "As of 4:00 a.m., May 3, 2026 (UTC), we've sent a gift of 1,000 carats to all trainers! All trainers who start the game before 11:59 p.m., Jun 3, 2026 (UTC) are eligible. Gifts expire 30 days after they are sent.",
      { start: '2026-05-03 04:00', end: null },
    ],
    ['A new campaign is coming soon! Details will be announced at a later date.', { start: null, end: null }],
  ],
  scouts: [
    [
      'Each day you log in, you can perform a free 10x scout on one of the scouts below, up to a maximum of 8 times.\nEligible Scouts\n• Example Support Card Scout\n10:00 p.m., Jan 5 - 9:59 p.m., Jan 9, 2026 (UTC)\n• Example Pretty Derby Scout\n10:00 p.m., Jan 9 - 2:59 p.m., Jan 13, 2026 (UTC)',
      {
        scouts: {
          windows: [
            { scout: 'Example Support Card Scout', start: '2026-01-05 22:00', end: '2026-01-09 21:59', days: null },
            { scout: 'Example Pretty Derby Scout', start: '2026-01-09 22:00', end: '2026-01-13 14:59', days: null },
          ],
          total: 8,
        },
      },
    ],
    [
      'Trainers can draw one free scout per day!\nAvailability Period\nExample Pretty Derby Scout:\nFeb 1 - 9:59 p.m., Feb 4, 2026 (UTC) (4 days total)',
      {
        scouts: {
          windows: [
            { scout: 'Example Pretty Derby Scout', start: '2026-02-01 00:00', end: '2026-02-04 21:59', days: 4 },
          ],
          total: null,
        },
      },
    ],
  ],
};

const isoOf = (s: unknown, event: AskedEvent): string | null => {
  if (!valid(s)) return null;
  const date = new Date(`${s.replace(' ', 'T')}:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.abs(date.getTime() - Date.parse(event.posted)) < 200 * DAY ? date.toISOString() : null; // a year's slip is out
};

// A kind's generic name ("A Legend Race", "Transfer Requests") isn't an event's name.
const GENERIC =
  /^(?:an? |the )?(?:new )?(?:legend race|transfer requests?|champions meeting|story event|event|login bonus|campaign|missions?|gift|celebration|sale|shop)s?$/i;

export const questionsEn: Questions = {
  system: SYSTEM,
  fields: FIELDS,
  examples: EXAMPLES,
  kinds: KINDS,
  // Kinds are a celebration's sub-events' (the others come from the post's title).
  kindAsked: (event) => KINDS.includes(event.kind),
  kindTaken: (event) => event.kind !== 'celebration',
  header: (event) => {
    const when = event.start
      ? `${event.start.slice(0, 16).replace('T', ' ')} to ${event.end?.slice(0, 16).replace('T', ' ') ?? '?'} UTC`
      : 'unknown dates';
    return [`Event: ${event.kind.replace('_', ' ')} "${shownName(event)}" (${when}, as read so far).`];
  },
  // An item's name from an answer (as we show it, and as the post writes it), or null when it isn't one the text has.
  item: (event, raw) => {
    if (/\[|support card/i.test(raw)) return null;
    const shown = itemName(raw);
    return shown && inText(event, shown) ? { name: shown } : null;
  },
  copiesLine: /\bcop(?:y|ies)\b|\btimes\b/i,
  numberWord,
  generic: GENERIC,
  isoOf,
};
