import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { EVENT_GROUPS, itemList, withPredicted } from '../src/timeline/events.js';
import { eventEntries } from '../src/timeline/entries.js';
import { DAY, laneGroups, partCount } from '../src/timeline/layout.js';
import { CM_PHASES, EVENT_KINDS } from '../scripts/lib/events.js';
import en from '../src/i18n/en.json' with { type: 'json' };
import globalEvents from '../data/global_events.json' with { type: 'json' };
import jpEvents from '../data/jp_events.json' with { type: 'json' };
import fixture from './fixtures/predicted-global-events.json' with { type: 'json' };

// The Timeline shows each server's events the same way.
const SERVERS = [
  ['Global', globalEvents],
  ['JP', jpEvents],
];

// Events in their lane groups, as the Timeline draws them.
const eventGroups = (events) => laneGroups(eventEntries(events));
const idsOf = (rows) => rows.map((row) => row.map((item) => item.entry.id));

describe('event lanes', () => {
  const event = (id, kind, start, end, parent = null) => ({ id, kind, start, end, parent, cards: [], items: [] });

  it('groups events by type, each packed on its own, parts only under their parent', () => {
    const groups = eventGroups([
      event('1', 'story', '2026-01-01T00:00:00Z', '2026-01-10T00:00:00Z'),
      event('2', 'special', '2026-01-05T00:00:00Z', '2026-01-12T00:00:00Z'),
      event('3', 'celebration', '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z'),
      event('3-1', 'login_bonus', '2026-01-01T00:00:00Z', '2026-01-15T00:00:00Z', '3'),
      event('3-m1', 'missions', '2026-01-02T00:00:00Z', '2026-01-09T00:00:00Z', '3'),
      event('4', 'gift', '2026-01-03T00:00:00Z', null),
    ]);
    expect(groups.map((g) => [g.key, idsOf(g.rows)])).toEqual([
      ['events-story', [['1'], ['2']]],
      ['events-celebration', [['3']]],
      ['events-gifts', [['4']]],
    ]);
    const celebration = groups[1].rows[0][0];
    expect(idsOf(celebration.parts)).toEqual([['3-1'], ['3-m1']]);
    expect(partCount(celebration)).toBe(2);
    expect(groups[2].rows[0][0].end - groups[2].rows[0][0].start).toBe(DAY); // no end: one day
  });

  it.each(SERVERS)('places every dated event in the data once, in a known group (%s)', (_, events) => {
    const placed = (items) => items.flatMap((item) => [item.entry.id, ...placed(item.parts.flat())]);
    const all = eventGroups(events).flatMap((g) => placed(g.rows.flat()));
    expect(all.sort()).toEqual(
      events
        .filter((e) => e.start)
        .map((e) => e.id)
        .sort()
    );
  });

  it('puts every kind in a group', () => {
    expect(EVENT_GROUPS.flatMap(([, kinds]) => kinds).sort()).toEqual([...EVENT_KINDS].sort());
  });
});

describe('itemList', () => {
  it('puts the common currencies first, the rest in the post order', () => {
    const items = [
      { name: 'Book of Hints', count: 5 },
      { name: 'Monies', count: 500 },
      { name: 'Goddess Statue', count: 1 },
      { name: 'Carats', count: { min: 1000, max: 3000 } },
      { name: '1.5-Year Anniversary SSR Voucher', count: null },
    ];
    expect(itemList(items).map((i) => i.name)).toEqual([
      'Carats',
      'Monies',
      '1.5-Year Anniversary SSR Voucher',
      'Book of Hints',
      'Goddess Statue',
    ]);
  });
});

describe('event parts', () => {
  it("lists a celebration's sub-events by start, each pointing back to it", () => {
    const event = (id, parent, start) => ({ id, kind: 'gift', parent, start, end: null, cards: [], items: [] });
    const [celebration, , part] = eventEntries([
      event('902', null, '2026-07-22T22:00:00Z'),
      event('902-21', '902', '2026-07-23T15:00:00Z'),
      event('902-11', '902', '2026-07-22T22:00:00Z'),
    ]);
    expect(celebration.parts).toEqual(['event:902-11', 'event:902-21']);
    expect(part).toMatchObject({ parent: 'event:902', relations: [{ type: 'partOf', target: 'event:902' }] });
  });
});

describe.each(SERVERS)('the event data (%s)', (_, events) => {
  it('only uses kinds the app styles and labels', () => {
    expect(events.filter((e) => !EVENT_KINDS.includes(e.kind))).toEqual([]);
  });

  it('gives every Champions Meeting its schedule, in order', () => {
    const keys = CM_PHASES.map(([key]) => key);
    // (Only an announcement without dates of its own has none. JP's cups dated by GameTora start at round 1, the
    // league selection unknown: scripts/lib/gametora-events.js.)
    const fromRound1 = (e) => e.start === e.phases?.find((p) => p.key === 'round_1')?.start;
    for (const e of events.filter((x) => x.kind === 'champions_meeting' && (x.end || x.phases?.length)))
      expect({ id: e.id, phases: e.phases?.map((p) => p.key) }).toEqual({
        id: e.id,
        phases: fromRound1(e) ? keys.slice(1) : keys,
      });
  });

  it('labels every phase', () => {
    const phases = new Set(events.flatMap((e) => e.phases ?? []).map((p) => p.key));
    expect([...phases].filter((key) => !en.events.phase[key])).toEqual([]);
  });

  it('links sub-events to a celebration that exists', () => {
    const ids = new Set(events.map((e) => e.id));
    expect(events.filter((e) => e.parent && !ids.has(e.parent))).toEqual([]);
  });

  it('gives every item a name, and JP items their Japanese one', () => {
    expect(events.flatMap((e) => e.items).filter((i) => !i.name || (i.local != null && !i.local))).toEqual([]);
  });
});

describe('withPredicted', () => {
  const real = [
    {
      id: '1',
      kind: 'story',
      parent: null,
      start: '2026-10-01T00:00:00Z',
      end: '2026-10-10T00:00:00Z',
      cards: [],
      items: [],
    },
    {
      id: '1-m1',
      kind: 'missions',
      parent: '1',
      start: '2026-10-20T00:00:00Z',
      end: '2026-10-25T00:00:00Z',
      cards: [],
      items: [],
    },
  ];
  const ids = (events) => events.map((e) => e.id);

  it("adds the predicted events after the real ones, leaving out those Global's news has overtaken", () => {
    const merged = withPredicted(real, fixture.events);
    // jp-3000 (a story starting before Global's latest real one) goes, its mission set with it; parts aren't compared
    // with real parts (Global's mission 1-m1 starts after the predicted ones).
    expect(ids(merged)).toEqual(['1', '1-m1', 'jp-3444', 'jp-3500', 'jp-3500-m1', 'jp-3379', 'jp-3400']);
    expect(withPredicted(real, [])).toEqual(real);
  });

  it("draws them in Global's groups, kinds Global lacks too, parts under their predicted parent", () => {
    const groups = eventGroups(withPredicted(real, fixture.events));
    const rows = Object.fromEntries(groups.map((g) => [g.key, idsOf(g.rows)]));
    expect(rows).toEqual({
      'events-story': [['1', 'jp-3500', 'jp-3400']],
      'events-champions_meeting': [['jp-3444']],
      'events-league_of_heroes': [['jp-3379']],
    });
    const story = groups[0].rows[0][1];
    expect(idsOf(story.parts)).toEqual([['jp-3500-m1']]);
  });

  it("keeps every predicted event after Global's latest real one of its kind (the real data)", () => {
    const merged = withPredicted(globalEvents, fixture.events);
    const latest = (kind) =>
      Math.max(...globalEvents.filter((e) => e.kind === kind && !e.parent).map((e) => Date.parse(e.start)));
    for (const e of merged.filter((x) => x.predicted && !x.parent))
      expect(Date.parse(e.start) > latest(e.kind) || latest(e.kind) === -Infinity).toBe(true);
  });
});

// The predicted events `pnpm predict-gl` writes (when it has: the file is optional), in the shape the Timeline reads.
const PREDICTED_FILE = new URL('../generated/predicted_global_events.json', import.meta.url);
const predictedFiles = [['the fixture', fixture]];
if (existsSync(PREDICTED_FILE))
  predictedFiles.push(['generated/predicted_global_events.json', JSON.parse(readFileSync(PREDICTED_FILE, 'utf8'))]);

describe.each(predictedFiles)('predicted events (%s)', (_, file) => {
  it("are JP's events with Global dates, of kinds the app styles and labels", () => {
    expect(file.source).toBeTruthy();
    const ids = new Set(file.events.map((e) => e.id));
    const wrong = file.events.filter(
      (e) =>
        !e.id.startsWith('jp-') ||
        e.predicted !== true ||
        !EVENT_KINDS.includes(e.kind) ||
        (e.parent != null && !ids.has(e.parent)) ||
        !e.start ||
        !e.jp_start ||
        typeof e.margin_days !== 'number' ||
        !Array.isArray(e.cards) ||
        !Array.isArray(e.items) ||
        !Array.isArray(e.titles)
    );
    expect(wrong.map((e) => e.id)).toEqual([]);
  });

  it('labels every phase', () => {
    const phases = new Set(file.events.flatMap((e) => e.phases ?? []).map((p) => p.key));
    expect([...phases].filter((key) => !en.events.phase[key])).toEqual([]);
  });
});
