// Pull advice from Luh's Umamusume Support Card Encyclopedia: parsing a tab's HTML view, its dates,
// "Pull?" and "Notes" cells, matching entries to banners (scripts/lib/pull-guide.js), and picking the
// advice shown (src/pullGuide.js).

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../schemas/pull_guide.schema.json' with { type: 'json' };
import {
  byBanner,
  findBanner,
  notesParagraph,
  parseDate,
  parseNotes,
  parsePull,
  parseSheetList,
  parseTab,
  parseUpdated,
} from '../scripts/lib/pull-guide.js';
import { bannerVerdicts, currentAdvice, latestAdvice, sheetLink, upcomingBanner, verdictOf } from '../src/pullGuide.js';

const link = (url) => `<a href="https://www.google.com/url?q=${url}&amp;sa=D&amp;usg=x">`;
let rowIndex = 0;
const row = (cells) =>
  `<tr><th id="557481421R${rowIndex++}">${rowIndex}</th>${cells.map((c) => `<td class="s1">${c}</td>`).join('')}</tr>`;

// A trimmed-down tab as Google renders it: scenario link on top, a header row, card rows.
const TAB = `<table>${[
  row([
    '',
    '<div><img src="x"></div>',
    `${link('https://gametora.com/umamusume/make-a-new-track')}Mar 12th, &#39;26</a>`,
  ]),
  row(['', 'Support Card', 'Art', 'Date', 'Type', 'Pull?', 'Notes']),
  row([
    '',
    `<span>${link('https://gametora.com/umamusume/supports/30086-narita-top-road')}Narita Top Road</a></span>`,
    '',
    'Mar 12th &#39;26',
    '',
    '<span style="color:#cc0000;">60 free pulls<br><br></span>If Whale',
    'Viable during MANT<br>because of her unique',
  ]),
  row([
    '',
    `${link('https://gametora.com/umamusume/supports/30087-mejiro-bright')}Mejiro Bright</a><br><span>(Event)</span>`,
    '',
    'Late Jun &#39;28',
    '',
    'Free',
    'Average free card',
  ]),
  row(['', 'Not a card', '', '', '', '', '']),
].join('')}</table>`;

describe('a tab', () => {
  it('reads each card row by its GameTora link', () => {
    expect(parseTab(TAB)).toEqual({
      entries: [
        {
          id: '30086',
          name: 'Narita Top Road',
          row: 3,
          banner: { label: null, date: '2026-03-12' },
          freePulls: 60,
          shouldPull: 'whale',
          comment: null,
          advice: 'Viable during MANT because of her unique.',
        },
        {
          id: '30087',
          name: 'Mejiro Bright',
          row: 4,
          banner: { label: 'Event', month: '2028-06', part: 'late' },
          freePulls: null,
          shouldPull: 'free',
          comment: null,
          advice: 'Average free card.',
        },
      ],
    });
  });

  it('gives no entries for tabs without a card table', () => {
    expect(parseTab(`<table>${row(['', 'Just text'])}</table>`).entries).toEqual([]);
  });

  it('maps entries to banners, and cards on none to noBanner', () => {
    const banners = [{ id: 30120, start: '2026-03-11T22:00:00Z', featured: [{ id: 30086, new: true }] }];
    expect(byBanner([{ name: 'Trackblazer', gid: '557481421', ...parseTab(TAB) }], banners)).toEqual({
      banners: {
        30120: {
          30086: {
            googleSheetsSrc: { gid: '557481421', row: 3 },
            freePulls: 60,
            shouldPull: 'whale',
            comment: null,
            advice: 'Viable during MANT because of her unique.',
          },
        },
      },
      noBanner: {
        30087: {
          googleSheetsSrc: { gid: '557481421', row: 4 },
          freePulls: null,
          shouldPull: 'free',
          comment: null,
          advice: 'Average free card.',
          release: { label: 'Event', month: '2028-06', part: 'late' },
        },
      },
    });
  });
});

describe('the sheet', () => {
  it('lists tabs and reads the update date (day first)', () => {
    const html = `items.push({name: "L\\x27Arc", pageUrl: "https:\\/\\/x", gid: "302197443",initialSheet: false});`;
    expect(parseSheetList(html)).toEqual([{ name: "L'Arc", gid: '302197443' }]);
    expect(parseUpdated('<td>(Latest update: 06/10/26)<br>For questions</td>')).toBe('2026-10-06');
  });
});

describe('cells', () => {
  it('parses exact, day-first and estimated dates', () => {
    expect(parseDate("July 23rd, '26")).toEqual({ date: '2026-07-23' });
    expect(parseDate("8 Oct '25")).toEqual({ date: '2025-10-08' });
    expect(parseDate("Early Mar '28")).toEqual({ month: '2028-03', part: 'early' });
    expect(parseDate('TBA')).toEqual({ dateText: 'TBA' });
  });

  it('splits free pulls from the advice and buckets it', () => {
    const plain = { comment: null, note: null };
    expect(parsePull('No')).toEqual({ freePulls: null, shouldPull: 'no', ...plain });
    expect(parsePull('12 free pulls\n\n#No')).toEqual({ freePulls: 12, shouldPull: 'no', ...plain });
    expect(parsePull('100 Free Pulls\n\nYes')).toMatchObject({ freePulls: 100, shouldPull: 'yes' });
    expect(parsePull('If dedicated\nto Ends').note).toBe('If dedicated to Ends');
    expect(parsePull('If whale+ or\nwith Duramente').comment).toBe('If Whale+ or With Duramente');
    expect(parsePull('If Dolpin').shouldPull).toBe('dolphin');
    expect(parsePull('If dedicated\nto lates').note).toBe('If dedicated to Lates');
    expect(parsePull('')).toEqual({ freePulls: null, shouldPull: null, ...plain });
  });

  it('reads a limit break target ("1LB+") as a yes, its text placed as without a pill', () => {
    expect(parsePull('1LB+ or R\nMLB')).toMatchObject({ shouldPull: 'yes', comment: null, note: '1LB+ or R MLB' });
    expect(parsePull('2LB+ or a long explanation here')).toMatchObject({
      shouldPull: 'yes',
      comment: '2LB+ or a long explanation here',
      note: null,
    });
    expect(parsePull('If you have her at 2LB+').shouldPull).toBeNull();
  });

  it('pills Whale and Dolphin with their pluses, and splits off the rest of the advice', () => {
    expect(parsePull('If Whale++')).toMatchObject({ shouldPull: 'whale++', comment: null, note: null });
    expect(parsePull('If Dolphin+')).toMatchObject({ shouldPull: 'dolphin+' });
    expect(parsePull('If Whale or\nWith Palmer')).toMatchObject({
      shouldPull: 'whale',
      comment: 'If Whale or With Palmer',
    });
    // No pill: short advice leads the notes, longer is the comment.
    expect(parsePull('With Kitasan')).toMatchObject({ shouldPull: null, comment: null, note: 'With Kitasan' });
    expect(parsePull("If dedicated to Lates and\ndidn't pull Admire Groove")).toMatchObject({
      shouldPull: null,
      comment: "If dedicated to Lates and didn't pull Admire Groove",
      note: null,
    });
  });

  it('joins wrapped note lines back into sentences', () => {
    expect(
      parseNotes('Good SR statstick, but like other\nSRs, no need to pull\nGold skill is bad\nthough\n\nMLB it')
    ).toEqual(['Good SR statstick, but like other SRs, no need to pull', 'Gold skill is bad though', 'MLB it']);
  });

  it('runs on after commas, colons, numbers, joining words and split names', () => {
    expect(parseNotes('similar to Fukukitaru,\nMarvelous Sunday')).toEqual(['similar to Fukukitaru, Marvelous Sunday']);
    expect(parseNotes('all others have had:\nPassion Zone')).toEqual(['all others have had: Passion Zone']);
    expect(parseNotes('Last banner before the 2nd\nAnniversary')).toEqual(['Last banner before the 2nd Anniversary']);
    expect(parseNotes("if you don't have neither\nMr C.B.")).toEqual(["if you don't have neither Mr C.B."]);
    expect(parseNotes('powercreeps Tamamo\nCross', ['Tamamo Cross'])).toEqual(['powercreeps Tamamo Cross']);
    expect(parseNotes('powercreeps Tamamo\nCross')).toEqual(['powercreeps Tamamo', 'Cross']);
  });

  it('runs on into a number or "(" mid-sentence, not after a full stop', () => {
    expect(parseNotes('comes with a nice\n100% mood effect')).toEqual(['comes with a nice 100% mood effect']);
    expect(parseNotes('on a Medium\n(and sometimes Long) card')).toEqual(['on a Medium (and sometimes Long) card']);
    expect(parseNotes('best to save up!\n(Her third time)')).toEqual(['best to save up!', '(Her third time)']);
  });

  it('splits sentences run together on one line, and tidies spacing', () => {
    expect(parseNotes('not viable so early on Could see some use')).toEqual([
      'not viable so early on',
      'Could see some use',
    ]);
    expect(parseNotes("It's free !\nyippee !!")).toEqual(["It's free! yippee!!"]);
  });
});

describe('the advice shown', () => {
  const banner = (id, start, end, isNew) => ({ id, start, end, featured: [{ id: 30078, new: isNew }] });
  const banners = [
    banner(3, '2026-11-24T22:00:00Z', '2026-12-03T21:59:59Z', false),
    banner(1, '2026-01-28T22:00:00Z', '2026-02-06T21:59:59Z', true),
  ];
  const guide = {
    banners: { 1: { 30078: { shouldPull: 'yes' } }, 3: { 30078: { shouldPull: 'no' } } },
    noBanner: { 30087: { shouldPull: 'free', release: { month: '2026-11', part: 'late' } } },
  };

  it("is for the card's banner running now or the next one", () => {
    expect(upcomingBanner(banners, 30078, Date.parse('2026-02-01T00:00:00Z')).id).toBe(1);
    expect(upcomingBanner(banners, 30078, Date.parse('2026-10-08T00:00:00Z')).id).toBe(3);
    expect(upcomingBanner(banners, 30078, Date.parse('2026-12-05T00:00:00Z'))).toBeNull();
    expect(currentAdvice(guide, 30078, banners[0], '2026-10-08')).toEqual({ shouldPull: 'no' });
    expect(currentAdvice(guide, 30078, { id: 9 }, '2026-10-08')).toBeNull();
  });

  it('is for a card on no banner while its release is ahead', () => {
    expect(currentAdvice(guide, 30087, null, '2026-11-30').shouldPull).toBe('free');
    expect(currentAdvice(guide, 30087, null, '2026-12-01')).toBeNull();
  });

  it("falls back to the card's latest advice for the link, none for cards the guide lacks", () => {
    expect(latestAdvice(guide, 30078)).toEqual({ shouldPull: 'no' });
    expect(latestAdvice(guide, 1)).toBeNull();
  });

  it("links to the entry's row in the sheet", () => {
    expect(sheetLink({ googleSheetsSrc: { gid: '5', row: 12 } }, 'https://s')).toBe('https://s/edit#gid=5&range=B12');
    expect(sheetLink(null, 'https://s')).toBe('https://s');
  });
});

describe('verdicts (the Timeline filter)', () => {
  it("reads an advice's pill without its +s, else none", () => {
    expect(verdictOf({ shouldPull: 'whale++' })).toBe('whale');
    expect(verdictOf({ shouldPull: 'yes' })).toBe('yes');
    expect(verdictOf({ shouldPull: null })).toBe('none');
    expect(verdictOf(undefined)).toBe('none');
  });

  it("gives a banner's cards' verdicts, none for cards or banners without advice", () => {
    const guide = { banners: { 30001: { 1: { shouldPull: 'yes' }, 2: { shouldPull: 'dolphin+' } } }, noBanner: {} };
    expect([...bannerVerdicts(guide, 30001, [1, 2, 3])]).toEqual(['yes', 'dolphin', 'none']);
    expect([...bannerVerdicts(guide, 30002, [1])]).toEqual(['none']);
    expect([...bannerVerdicts(guide, 30001, [])]).toEqual(['none']);
  });
});

describe('the banner an entry is about', () => {
  const banner = (id, start, cards) => ({
    id,
    start: `${start}T22:00:00.000Z`,
    featured: cards.map((c) => ({ id: c })),
  });
  const banners = [
    banner(1, '2026-01-28', [30078]),
    banner(2, '2026-05-10', [30078, 30080]),
    banner(3, '2026-11-24', [30078]),
    banner(4, '2026-12-01', [30099]),
  ];
  const entries = [
    { banner: { date: '2026-01-29' } },
    { banner: { date: '2026-05-10', label: 'Rerun' } },
    { banner: { month: '2026-11', part: 'late', label: 'Rerun' } },
  ];

  it('is the earliest banner featuring the card for its first release', () => {
    expect(findBanner(banners, 30078, entries, entries[0]).id).toBe(1);
    const event = [{ banner: { month: '2027-06', part: 'early', label: 'Event' } }];
    expect(findBanner(banners, 30111, event, event[0])).toBeNull();
  });

  it('is the closest one for a rerun, estimates included', () => {
    expect(findBanner(banners, 30078, entries, entries[1]).id).toBe(2);
    expect(findBanner(banners, 30078, entries, entries[2]).id).toBe(3);
  });

  it('is none for a rerun far from any banner', () => {
    const late = { banner: { date: '2027-06-01', label: 'Rerun' } };
    expect(findBanner(banners, 30078, [...entries, late], late)).toBeNull();
  });
});

describe('the notes shown', () => {
  it('are one paragraph, with full stops where sentences have none', () => {
    expect(
      notesParagraph(['Last banner before the 2nd Anniversary, best to save up!', '(Her third time)', 'MLB it'])
    ).toBe('Last banner before the 2nd Anniversary, best to save up! (Her third time) MLB it.');
    expect(notesParagraph([])).toBeNull();
  });
});

describe('the schema', () => {
  const validate = new Ajv2020({ allowUnionTypes: true }).compile(schema);
  const check = (guide) => expect(validate(guide), JSON.stringify(validate.errors)).toBe(true);

  it('fits what the script writes', () => {
    const banners = [{ id: 30120, start: '2026-03-11T22:00:00Z', featured: [{ id: 30086, new: true }] }];
    const guide = byBanner([{ gid: '557481421', ...parseTab(TAB) }], banners);
    check({ $schema: '../schemas/pull_guide.schema.json', ...guide });
    expect(validate({ ...guide, extra: 1 })).toBe(false);
    expect(validate({ banners: {}, noBanner: { 1: { ...guide.banners[30120][30086] } } })).toBe(false);
  });

  it.skipIf(!existsSync('generated/pull_guide.json'))('fits generated/pull_guide.json', () => {
    check(JSON.parse(readFileSync('generated/pull_guide.json', 'utf8')));
  });
});
