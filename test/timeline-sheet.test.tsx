// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n, { scenarioName } from '../src/i18n/index.ts';
import type { Banner, BannerItem } from '../shared/schemas/banner.ts';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { GameEvent } from '../shared/schemas/event.ts';
import { type Entry, bannerEntries, eventEntries } from '../src/timeline/entries.ts';
import { dateFormats, entryTitle, kindName } from '../src/timeline/format.ts';
import { type ArtBannerFile, withArt } from '../src/gametora.ts';
import cardsJson from '../generated/cards.json' with { type: 'json' };

// The sheet (vaul's drawer) renders into a portal: the sheet's content inline instead.
vi.mock('../src/Sheet.tsx', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ className, children }: { className?: string; children: ReactNode }) => (
    <h2 className={className}>{children}</h2>
  ),
  SHEET_ANIMATION_MS: 500,
}));
const { default: TimelineSheet } = await import('../src/timeline/TimelineSheet.tsx');

afterEach(cleanup);

const cards = cardsJson as CardsFile;
const now = Date.parse('2026-10-13T00:00:00Z');
const ids = Object.keys(cards).map(Number);
const card = (id: number): BannerItem => ({
  id,
  char_id: null,
  name: cards[id].name.en ?? '',
  title: cards[id].title.en ?? '',
  rarity: 3,
  type: 'speed',
  rate: null,
  new: true,
});
const file = (list: Banner[]): ArtBannerFile =>
  withArt(
    {
      source: { site: 'umamusume.jp', server: 'jp', scraped_at: '2026-10-01T00:00:00Z' },
      characters: [],
      cards: list,
    },
    'jp',
    cards
  );
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
      cards: [],
      items: [{ name: 'Carats', count: 3000 }],
      titles: ['Champion'],
      news_url: 'https://umamusume.com/news/10',
      image: 'art.png',
      phases: undefined,
      source: 'news',
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
      news_url: null,
      image: null,
      source: 'news',
    },
  ] satisfies GameEvent[],
  { cards, now }
);
const all = new Map([predicted, paid, ...events].map((e) => [e.key, e]));
const format = dateFormats('utc');

function renderSheet(entry: Entry) {
  return render(
    <TimelineSheet
      entry={entry}
      lookup={(key) => all.get(key)}
      server="gl"
      scenario="GL"
      format={format}
      open
      onSelect={() => {}}
      onClose={() => {}}
    />
  );
}

function expectInOrder(nodes: (Element | null)[]): void {
  const present = nodes.filter((node): node is Element => node !== null);
  expect(present).toHaveLength(nodes.length);
  present.slice(1).forEach((node, i) => {
    expect(present[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
}

// The art: the only picture without `loading` (the item icons are lazy).
const art = (container: HTMLElement) => container.querySelector('img:not([loading])');
// Where the dates come from is behind the (i) after them.
const openDatesInfo = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('timeline.aboutDates') }));

describe('TimelineSheet', () => {
  it('shows a predicted banner: art, kind, status, where its dates come from, its cards ranked', () => {
    const { container } = renderSheet(predicted);
    openDatesInfo();
    expectInOrder([
      art(container),
      screen.getByText(kindName(predicted)),
      screen.getByRole('heading', { level: 2, name: entryTitle(predicted) }),
      screen.getByText(i18n.t('timeline.status.predicted')),
      screen.getByText(/^Predicted from JP's dates \(May 1, 2025 - May 8, 2025\); could be 4 days earlier/),
      screen.getByRole('heading', { level: 3, name: i18n.t('timeline.featuredCards') }),
      // "Ranking…", then the card's stat.
      screen.getByText(new RegExp(`^${i18n.t('common.ranking')}`)),
      screen.getByText(i18n.t('timeline.rankNote', { scenario: scenarioName('GL') })),
    ]);
  });

  it('shows a paid scout: its name, since when, its note in place of items, and its post', () => {
    const { container } = renderSheet(paid);
    openDatesInfo();
    expectInOrder([
      art(container),
      screen.getByText(kindName(paid)),
      screen.getByRole('heading', { level: 2, name: 'Paid scout' }),
      screen.getByText(i18n.t('timeline.paid')),
      screen.getByText('Any ★3'),
      screen.getByRole('link', { name: i18n.t('timeline.news', { site: 'umamusume.jp' }) }),
      screen.getByRole('link', { name: i18n.t('timeline.umapyoi') }),
    ]);
    expect(screen.getByText(/from Jan 1, 2026/)).toBeTruthy();
    expect(screen.getByRole('link', { name: i18n.t('timeline.umapyoi') }).getAttribute('href')).toBe(
      'https://umapyoi.net/news/3400?lang=jp'
    );
  });

  it('shows an event the same way: rewards, titles, its parts', () => {
    const { container } = renderSheet(events[0]);
    expectInOrder([
      art(container),
      screen.getByText(kindName(events[0])),
      screen.getByRole('heading', { level: 2, name: entryTitle(events[0]) }),
      screen.getByRole('heading', { level: 3, name: i18n.t('timeline.items') }),
      screen.getByText('Carats × 3,000'),
      screen.getByText(i18n.t('timeline.titles', { titles: ['Champion'] })),
      screen.getByRole('heading', { level: 3, name: i18n.t('timeline.includes') }),
      screen.getByRole('button', { name: new RegExp(kindName(events[1])) }),
      screen.getByRole('link', { name: i18n.t('timeline.news', { site: 'umamusume.com' }) }),
    ]);
  });

  it("shows a part with its parent and its cards, ranked like a banner's", () => {
    renderSheet(events[1]);
    // The kind pill and the title are both "Gift": the pill comes first.
    expectInOrder([
      screen.getAllByText(kindName(events[1]))[0],
      screen.getByRole('heading', { level: 2, name: entryTitle(events[1]) }),
      screen.getByRole('button', { name: i18n.t('timeline.relation.partOf', { dates: '', name: 'Anniversary' }) }),
      screen.getByRole('heading', { level: 3, name: i18n.t('timeline.supportCards') }),
      screen.getByText(i18n.t('timeline.rankNote', { scenario: scenarioName('GL') })),
    ]);
    expect(screen.getByText(/Part of Anniversary/)).toBeTruthy();
    expect(screen.getByText('2 copies')).toBeTruthy();
  });
});
