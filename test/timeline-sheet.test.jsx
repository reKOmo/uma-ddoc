// The Timeline's sheet (src/timeline/TimelineSheet.jsx): one layout for every banner and event, only the content
// changes.

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import '../src/i18n/index.js';
import { bannerEntries, eventEntries } from '../src/timeline/entries.js';
import { dateFormats } from '../src/timeline/format.js';
import { withArt } from '../src/gametora.js';
import cards from '../generated/cards.json' with { type: 'json' };

// The sheet (vaul's drawer) renders into a portal, which a static render leaves out: the sheet's content inline instead.
vi.mock('../src/Sheet.jsx', () => ({
  default: ({ children }) => <div className="sheet">{children}</div>,
  SheetTitle: ({ className, children }) => <h2 className={className}>{children}</h2>,
}));
const { default: TimelineSheet } = await import('../src/timeline/TimelineSheet.jsx');

const now = Date.parse('2026-10-13T00:00:00Z');
const card = (id) => ({ id, name: cards[id].name.en, title: cards[id].title.en, type: 'speed', rarity: 3, new: true });
const ids = Object.keys(cards).map(Number);
const file = (list) => withArt({ characters: [], cards: list }, 'jp', cards);
const [predicted, paid] = bannerEntries(
  file([
    {
      id: 1,
      start: '2026-11-01T22:00:00Z',
      end: '2026-11-08T21:59:59Z',
      main: card(ids[0]),
      featured: [card(ids[0])],
      predicted: true,
      jp_start: '2025-05-01T03:00:00Z',
      jp_end: '2025-05-08T02:59:59Z',
      margin_days: 4,
    },
    {
      id: 50001,
      start: '2026-01-01T00:00:00Z',
      end: null,
      main: null,
      featured: [],
      paid: true,
      name: 'Paid scout',
      note: 'Any ★3',
      news_url: 'https://umamusume.jp/news/detail/?id=3400',
    },
  ]),
  { now }
);
const events = eventEntries(
  [
    {
      id: '10',
      kind: 'celebration',
      name: 'Anniversary',
      parent: null,
      start: '2026-10-01T00:00:00Z',
      end: '2026-10-20T00:00:00Z',
      news_url: 'https://umamusume.com/news/10',
      image: 'art.png',
      cards: [],
      items: [{ name: 'Carats', count: 3000 }],
      titles: ['Champion'],
    },
    {
      id: '10-1',
      kind: 'gift',
      name: 'Gift',
      parent: '10',
      start: '2026-10-02T00:00:00Z',
      end: null,
      cards: [{ id: ids[1], rarity: 'SSR', title: 'T', name: 'N', copies: 2 }],
      items: [],
      titles: [],
    },
  ],
  { cards, now }
);
const all = new Map([predicted, paid, ...events].map((e) => [e.key, e]));

const render = (entry) =>
  renderToStaticMarkup(
    <TimelineSheet
      entry={entry}
      lookup={(key) => all.get(key)}
      server="gl"
      scenario="GL"
      format={dateFormats('utc')}
      onSelect={() => {}}
      onClose={() => {}}
    />
  );
// The sheet's sections, in order, by class.
const SECTIONS = [
  'sheet-art',
  'entry-kind',
  'sheet-title',
  'sheet-dates',
  'sheet-note',
  'sheet-relation',
  'featured',
  'sheet-rewards',
  'sheet-titles',
  'sheet-empty',
  'sheet-list',
  'rank-note',
  'sheet-links',
];
const sections = (html) =>
  SECTIONS.filter((c) => new RegExp(`class="${c}[" ]`).test(html)).sort(
    (a, b) => html.search(new RegExp(`class="${a}[" ]`)) - html.search(new RegExp(`class="${b}[" ]`))
  );

describe('TimelineSheet', () => {
  it('shows a predicted banner: art, kind, status, where its dates come from, its cards ranked', () => {
    const html = render(predicted);
    expect(sections(html)).toEqual([
      'sheet-art',
      'entry-kind',
      'sheet-title',
      'sheet-dates',
      'sheet-note',
      'featured',
      'rank-note',
    ]);
    expect(html).toContain('Support card scout');
    expect(html).toContain('Predicted from JP&#x27;s dates (May 1, 2025 - May 8, 2025); could be 4 days earlier');
    expect(html).toContain('Ranking…');
  });

  it('shows a paid scout: its name, since when, its note in place of items, and its post', () => {
    const html = render(paid);
    expect(sections(html)).toEqual([
      'sheet-art',
      'entry-kind',
      'sheet-title',
      'sheet-dates',
      'sheet-note',
      'sheet-empty',
      'sheet-links',
    ]);
    expect(html).toContain('>Paid scout</h2>');
    expect(html).toContain('from Jan 1, 2026');
    expect(html).toContain('Any ★3');
    expect(html).toContain('https://umapyoi.net/news/3400?lang=jp');
  });

  it('shows an event the same way: rewards, titles, its parts', () => {
    const html = render(events[0]);
    expect(sections(html)).toEqual([
      'sheet-art',
      'entry-kind',
      'sheet-title',
      'sheet-dates',
      'sheet-rewards',
      'sheet-titles',
      'sheet-list',
      'sheet-links',
    ]);
    expect(html).toContain('Carats × 3,000');
  });

  it("shows a part with its parent and its cards, ranked like a banner's", () => {
    const html = render(events[1]);
    expect(sections(html)).toEqual([
      'entry-kind',
      'sheet-title',
      'sheet-dates',
      'sheet-relation',
      'featured',
      'rank-note',
    ]);
    expect(html).toContain('Part of Anniversary');
    expect(html).toContain('2 copies');
  });
});
