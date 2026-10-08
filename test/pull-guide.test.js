// Pull advice from Luh's Umamusume Support Card Encyclopedia: parsing a tab's HTML view, its dates,
// "Pull?" and "Notes" cells, and matching tabs to our scenarios (scripts/lib/pull-guide.js).

import { describe, it, expect } from 'vitest';
import {
  byCard,
  parseDate,
  parseNotes,
  parsePull,
  parseSheetList,
  parseTab,
  parseUpdated,
} from '../scripts/lib/pull-guide.js';
import { findBanner, notesParagraph, sheetLink, upcomingEntry } from '../src/pullGuide.js';

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
  it('reads each card row by its GameTora link, and the scenario the tab links', () => {
    expect(parseTab(TAB)).toEqual({
      slug: 'make-a-new-track',
      entries: [
        {
          id: '30086',
          row: 3,
          name: 'Narita Top Road',
          label: null,
          date: '2026-03-12',
          free_pulls: 60,
          pull: 'If Whale',
          verdict: 'whale',
          pill: 'If Whale',
          advice: null,
          notes: ['Viable during MANT because of her unique'],
        },
        {
          id: '30087',
          row: 4,
          name: 'Mejiro Bright',
          label: 'Event',
          month: '2028-06',
          part: 'late',
          free_pulls: null,
          pull: 'Free',
          verdict: 'free',
          pill: null,
          advice: null,
          notes: ['Average free card'],
        },
      ],
    });
  });

  it('gives no entries for tabs without a card table', () => {
    expect(parseTab(`<table>${row(['', 'Just text'])}</table>`).entries).toEqual([]);
  });

  it('maps tabs to our scenario keys, through slug aliases', () => {
    const scenarios = [{ key: 'MANT', links: { gametora: 'https://gametora.com/umamusume/trackblazer' } }];
    const cards = byCard([{ name: 'Trackblazer', gid: '557481421', ...parseTab(TAB) }], scenarios);
    expect(cards['30086'][0]).toMatchObject({ scenario: 'MANT', tab: 'Trackblazer', gid: '557481421', row: 3 });
    expect(byCard([{ name: 'X', slug: 'unknown', entries: [{ id: '1' }] }], scenarios)['1'][0].scenario).toBeNull();
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
    expect(parseDate('TBA')).toEqual({ date_text: 'TBA' });
  });

  it('splits free pulls from the advice and buckets it', () => {
    const plain = { pill: null, advice: null, note: null };
    expect(parsePull('No')).toEqual({ free_pulls: null, pull: 'No', verdict: 'no', ...plain });
    expect(parsePull('12 free pulls\n\n#No')).toEqual({ free_pulls: 12, pull: 'No', verdict: 'no', ...plain });
    expect(parsePull('100 Free Pulls\n\nYes')).toMatchObject({ free_pulls: 100, verdict: 'yes' });
    expect(parsePull('If dedicated\nto Ends').pull).toBe('If dedicated to Ends');
    expect(parsePull('If whale+ or\nwith Duramente').pull).toBe('If Whale+ or With Duramente');
    expect(parsePull('If Dolpin').pull).toBe('If Dolphin');
    expect(parsePull('If dedicated\nto lates').pull).toBe('If dedicated to Lates');
    expect(parsePull('').verdict).toBeNull();
  });

  it('pills Whale and Dolphin with their pluses, and splits off the rest of the advice', () => {
    expect(parsePull('If Whale++')).toMatchObject({ verdict: 'whale', pill: 'If Whale++', advice: null, note: null });
    expect(parsePull('If Dolphin+')).toMatchObject({ verdict: 'dolphin', pill: 'If Dolphin+' });
    expect(parsePull('If Whale or\nWith Palmer')).toMatchObject({
      verdict: 'whale',
      pill: 'If Whale',
      advice: 'If Whale or With Palmer',
    });
    // No verdict: short advice joins the notes, longer is the recommendation.
    expect(parsePull('With Kitasan')).toMatchObject({ verdict: null, advice: null, note: 'With Kitasan' });
    expect(parsePull("If dedicated to Lates and\ndidn't pull Admire Groove")).toMatchObject({
      verdict: null,
      advice: "If dedicated to Lates and didn't pull Admire Groove",
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
  const entries = [
    { date: '2025-06-26', pull: 'No' },
    { date: '2026-09-30', pull: 'With Nice Nature' },
    { month: '2026-11', part: 'late', pull: 'No' },
  ];

  it('is for the banner running now or the next one', () => {
    expect(upcomingEntry(entries, '2026-10-08').pull).toBe('With Nice Nature');
    expect(upcomingEntry(entries, '2026-10-20')).toBe(entries[2]);
    expect(upcomingEntry(entries, '2026-11-30')).toBe(entries[2]);
  });

  it('is none once every banner is over', () => {
    expect(upcomingEntry(entries, '2026-12-01')).toBeNull();
  });

  it("links to the entry's row in the sheet", () => {
    expect(sheetLink('https://s', { gid: '5', row: 12 })).toBe('https://s/edit#gid=5&range=B12');
    expect(sheetLink('https://s', null)).toBe('https://s');
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
    { date: '2026-01-29' },
    { date: '2026-05-10', label: 'Rerun' },
    { month: '2026-11', part: 'late', label: 'Rerun' },
  ];

  it('is the earliest banner featuring the card for its first release', () => {
    expect(findBanner(banners, 30078, entries, entries[0]).id).toBe(1);
    const event = [{ month: '2027-06', part: 'early', label: 'Event' }];
    expect(findBanner(banners, 30111, event, event[0])).toBeNull();
  });

  it('is the closest one for a rerun, estimates included', () => {
    expect(findBanner(banners, 30078, entries, entries[1]).id).toBe(2);
    expect(findBanner(banners, 30078, entries, entries[2]).id).toBe(3);
  });

  it('is none for a rerun far from any banner', () => {
    const late = { date: '2027-06-01', label: 'Rerun' };
    expect(findBanner(banners, 30078, [...entries, late], late)).toBeNull();
  });
});

describe('the notes shown', () => {
  it('are one paragraph, with full stops where sentences have none', () => {
    expect(
      notesParagraph(['Last banner before the 2nd Anniversary, best to save up!', '(Her third time)', 'MLB it'])
    ).toBe('Last banner before the 2nd Anniversary, best to save up! (Her third time) MLB it.');
  });
});
