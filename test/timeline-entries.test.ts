// Banners and events as Timeline entries (src/timeline/entries.js): one shape for every server and source.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { bannerEntries, bannerStatus, eventEntries } from '../src/timeline/entries.ts';
import { withArt } from '../src/gametora.ts';
import { withPredicted } from '../src/timeline/events.ts';
import cardsJson from '../generated/cards.json' with { type: 'json' };
import globalBannersJson from '../data/global_banners.json' with { type: 'json' };
import jpBannersJson from '../data/jp_banners.json' with { type: 'json' };
import globalEventsJson from '../data/global_events.json' with { type: 'json' };
import jpEventsJson from '../data/jp_events.json' with { type: 'json' };
import predictedEventsJson from './fixtures/predicted-global-events.json' with { type: 'json' };
import type { Entry } from '../src/timeline/entries.ts';
import type { BannerFile } from '../shared/schemas/banner.ts';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { GameEvent, PredictedEvent, PredictedEventsFile } from '../shared/schemas/event.ts';
import { fixture, present } from './helpers.ts';

// The data files as their schemas describe them (JSON imports are typed more loosely; test/schemas.test.ts checks
// the files).
const cards = fixture<CardsFile>(cardsJson);
const globalBanners = fixture<BannerFile>(globalBannersJson);
const jpBanners = fixture<BannerFile>(jpBannersJson);
const globalEvents = fixture<GameEvent[]>(globalEventsJson);
const jpEvents = fixture<GameEvent[]>(jpEventsJson);
const predictedEvents = fixture<PredictedEventsFile>(predictedEventsJson);

const now = Date.parse('2026-10-13T00:00:00Z');
const optional = (file: string): BannerFile | null => {
  const url = new URL(`../generated/${file}`, import.meta.url);
  return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : null;
};
const predictedBanners = optional('predicted_global_banners.json');

// Each server's calendar, as loadTimeline() builds it.
function timeline(
  name: 'global' | 'jp',
  banners: BannerFile,
  events: GameEvent[],
  predicted?: BannerFile | null
): Entry[] {
  const files = [withArt(banners, name, cards), ...(predicted ? [withArt(predicted, 'jp', cards)] : [])];
  return [...files.flatMap((file) => bannerEntries(file, { now })), ...eventEntries(events, { cards, now })];
}
const SERVERS: [string, Entry[]][] = [
  ['Global', timeline('global', globalBanners, withPredicted(globalEvents, predictedEvents.events), predictedBanners)],
  ['JP', timeline('jp', jpBanners, jpEvents)],
];
const FIELDS = Object.keys(SERVERS[0][1][0]).sort();
const STATUSES = ['live', 'upcoming', 'ended', 'predicted', 'confirmed'];

describe.each(SERVERS)('the calendar (%s)', (_, entries) => {
  const keys = new Set(entries.map((e) => e.key));

  it('gives every banner and event the same fields', () => {
    expect(entries.filter((e) => Object.keys(e).sort().join() !== FIELDS.join()).map((e) => e.key)).toEqual([]);
  });

  it('keys every entry once (its id alone too: the address #/timeline/<server>/<id> opens it), with a known status and a start', () => {
    expect(keys.size).toBe(entries.length);
    expect(new Set(entries.map((e) => String(e.id))).size).toBe(entries.length);
    expect(entries.filter((e) => !STATUSES.includes(e.status) || (e.group !== 'event' && !e.start))).toEqual([]);
  });

  it('points relations, parents and parts at entries on the calendar', () => {
    const dangling = entries.flatMap((e) => [
      ...e.relations.filter((r) => r.target && !keys.has(r.target)).map((r) => `${e.key} ${r.type}`),
      ...(e.parent && !keys.has(e.parent) ? [`${e.key} parent`] : []),
      ...e.parts.filter((p) => !keys.has(p)).map((p) => `${e.key} part ${p}`),
    ]);
    expect(dangling).toEqual([]);
  });

  it('gives every banner art, and every featured item a key and a name', () => {
    expect(entries.filter((e) => e.group !== 'event' && !e.art?.src).map((e) => e.key)).toEqual([]);
    const items = entries.flatMap((e) => e.featured);
    expect(items.filter((i) => i.key == null || !i.name)).toEqual([]);
  });

  it('ranks support cards only', () => {
    expect(entries.filter((e) => e.featured.some((i) => i.card) && e.group === 'characters')).toEqual([]);
  });
});

describe('bannerEntries', () => {
  const featured = { id: 30001, name: 'Special Week', title: '[Title]', type: 'speed', rarity: 3, new: true };
  // (banners with the fields bannerEntries() reads)
  const file = (cardsList: unknown[]) =>
    withArt(fixture<BannerFile>({ characters: [], cards: cardsList }), 'jp', cards);

  it("links a JP re-run and its original both ways, and keeps a re-run's dates when it isn't on the calendar", () => {
    const entries = bannerEntries(
      file([
        {
          id: 1,
          start: '2026-01-01T00:00:00Z',
          end: '2026-01-08T00:00:00Z',
          main: featured,
          featured: [featured],
          rerun: { id: '1-rerun', start: '2026-02-01T00:00:00Z', end: '2026-02-03T00:00:00Z' },
        },
        {
          id: 2,
          start: '2026-03-01T00:00:00Z',
          end: '2026-03-08T00:00:00Z',
          main: featured,
          featured: [featured],
          rerun: { id: '2-rerun', start: '2026-04-01T00:00:00Z', end: '2026-04-03T00:00:00Z' },
        },
        {
          id: '1-rerun',
          start: '2026-02-01T00:00:00Z',
          end: '2026-02-03T00:00:00Z',
          main: featured,
          featured: [featured],
          rerunOf: 1,
        },
      ]),
      { now }
    );
    expect(entries.map((e) => e.relations)).toEqual([
      [{ type: 'reheld', target: 'cards:1-rerun', start: '2026-02-01T00:00:00Z', end: '2026-02-03T00:00:00Z' }],
      [{ type: 'reheld', target: null, start: '2026-04-01T00:00:00Z', end: '2026-04-03T00:00:00Z' }],
      [{ type: 'rerunOf', target: 'cards:1', start: '2026-01-01T00:00:00Z', end: '2026-01-08T00:00:00Z' }],
    ]);
  });

  it("reads a predicted banner's JP dates, a paid scout's note, and official art", () => {
    const [predicted, paid] = bannerEntries(
      file([
        {
          id: 3,
          start: '2026-11-01T22:00:00Z',
          end: '2026-11-08T21:59:59Z',
          main: featured,
          featured: [featured],
          predicted: true,
          jp_start: '2025-05-01T03:00:00Z',
          jp_end: '2025-05-08T02:59:59Z',
          margin_days: 4,
          news_image: 'post.png',
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
          news_url: 'https://umamusume.jp/news/detail/?id=1',
        },
      ]),
      { now }
    );
    expect(predicted).toMatchObject({
      status: 'predicted',
      art: { src: 'post.png', official: true },
      prediction: { from: { start: '2025-05-01T03:00:00Z', end: '2025-05-08T02:59:59Z' }, margin: 4, confirmed: false },
      main: { name: 'Special Week', others: 0 },
      tone: 'type-speed',
    });
    expect(paid).toMatchObject({
      paid: true,
      name: 'Paid scout',
      note: 'Any ★3',
      openEnded: true,
      status: 'live',
      news: { url: 'https://umamusume.jp/news/detail/?id=1', site: 'umamusume.jp' },
      art: { official: false },
    });
  });
});

describe('eventEntries', () => {
  it("names a predicted event's cards as Global's card data does, and links JP's post", () => {
    const id = Number(Object.keys(cards).find((k) => cards[k].name.en && cards[k].name.jp !== cards[k].name.en));
    const [entry] = eventEntries(
      [
        fixture<PredictedEvent>({
          id: 'jp-1',
          kind: 'story',
          name: 'X',
          parent: null,
          start: '2026-12-01T00:00:00Z',
          end: null,
          predicted: true,
          jp_start: '2025-12-01T00:00:00Z',
          margin_days: 2,
          news_url: 'https://umamusume.jp/news/detail/?id=2',
          cards: [{ id, rarity: 'SSR', title: 'T', name: cards[id].name.jp, copies: 3 }],
          items: [],
          titles: [],
        }),
      ],
      { cards, now }
    );
    expect(entry.featured[0]).toMatchObject({ name: cards[id].name.en, title: '[T]', card: true, copies: 3 });
    expect(entry.news).toEqual({ url: 'https://umamusume.jp/news/detail/?id=2', site: 'umamusume.jp' });
    expect(present(entry.prediction, 'prediction').from).toEqual({ start: '2025-12-01T00:00:00Z', end: null });
  });

  it('keeps a one-day event live for its day', () => {
    const event = fixture<GameEvent>({
      id: '1',
      kind: 'gift',
      parent: null,
      start: '2026-10-12T12:00:00Z',
      end: null,
      cards: [],
      items: [],
    });
    expect(eventEntries([event], { now })[0].status).toBe('live');
  });
});

describe('bannerStatus', () => {
  it('reads predicted and confirmed first, then the dates', () => {
    const at = (start: string, end: string | null) => bannerStatus({ start, end }, now);
    expect(at('2026-10-01T00:00:00Z', '2026-10-20T00:00:00Z')).toBe('live');
    expect(at('2026-10-20T00:00:00Z', '2026-10-27T00:00:00Z')).toBe('upcoming');
    expect(at('2026-09-01T00:00:00Z', '2026-09-08T00:00:00Z')).toBe('ended');
    expect(at('2026-09-01T00:00:00Z', null)).toBe('live'); // until further notice
    expect(bannerStatus({ start: '2026-12-01T00:00:00Z', end: null, predicted: true, confirmed: true }, now)).toBe(
      'confirmed'
    );
  });
});
