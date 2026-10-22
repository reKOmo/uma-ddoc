import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { EVENT_GROUPS, itemList, withPredicted } from '../src/timeline/events.ts';
import { eventEntries } from '../src/timeline/entries.ts';
import { DAY, laneGroups, partCount } from '../src/timeline/layout.ts';
import { CM_PHASES, EVENT_KINDS } from '../scripts/lib/events.ts';
import en from '../src/i18n/en.json' with { type: 'json' };
import globalEventsJson from '../data/global_events.json' with { type: 'json' };
import jpEventsJson from '../data/jp_events.json' with { type: 'json' };
import predictedJson from './fixtures/predicted-global-events.json' with { type: 'json' };
import type { Entry } from '../src/timeline/entries.ts';
import type { LaneItem } from '../src/timeline/layout.ts';
import type { EventPairsFile, GameEvent, PredictedEventsFile } from '../shared/schemas/event.ts';
import { at, fixture } from './helpers.ts';

// Typed as the schemas describe them (schemas.test.ts checks the files).
const globalEvents = fixture<GameEvent[]>(globalEventsJson);
const jpEvents = fixture<GameEvent[]>(jpEventsJson);
const predicted = fixture<PredictedEventsFile>(predictedJson);

const SERVERS: [string, GameEvent[]][] = [
  ['Global', globalEvents],
  ['JP', jpEvents],
];

const PHASE_LABELS: Record<string, string> = en.events.phase;

const eventGroups = (events: GameEvent[]) => laneGroups(eventEntries(events));
const idsOf = (rows: LaneItem<Entry>[][]) => rows.map((row) => row.map((item) => item.entry.id));

describe('event lanes', () => {
  const event = (id: string, kind: string, start: string, end: string | null, parent: string | null = null) =>
    fixture<GameEvent>({ id, kind, start: at(start), end: end ? at(end) : null, parent, cards: [], items: [] });

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
    const placed = (items: LaneItem<Entry>[]): Entry['id'][] =>
      items.flatMap((item) => [item.entry.id, ...placed(item.parts.flat())]);
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
    const event = (id: string, parent: string | null, start: string) =>
      fixture<GameEvent>({ id, kind: 'gift', parent, start: at(start), end: null, cards: [], items: [] });
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
    const fromRound1 = (e: GameEvent) => e.start.date === e.phases?.find((p) => p.key === 'round_1')?.start.date;
    for (const e of events.filter((x) => x.kind === 'champions_meeting' && (x.end || x.phases?.length)))
      expect({ id: e.id, phases: e.phases?.map((p) => p.key) }).toEqual({
        id: e.id,
        phases: fromRound1(e) ? keys.slice(1) : keys,
      });
  });

  it('labels every phase', () => {
    const phases = new Set(events.flatMap((e) => e.phases ?? []).map((p) => p.key));
    expect([...phases].filter((key) => !PHASE_LABELS[key])).toEqual([]);
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
  const real = fixture<GameEvent[]>([
    {
      id: '1',
      kind: 'story',
      parent: null,
      start: at('2026-10-01T00:00:00Z'),
      end: at('2026-10-10T00:00:00Z'),
      cards: [],
      items: [],
    },
    {
      id: '1-m1',
      kind: 'missions',
      parent: '1',
      start: at('2026-10-20T00:00:00Z'),
      end: at('2026-10-25T00:00:00Z'),
      cards: [],
      items: [],
    },
  ]);
  const ids = (events: GameEvent[]) => events.map((e) => e.id);

  it('adds the predicted events after the real ones, hiding one 14 days past its predicted start', () => {
    const all = ['1', '1-m1', 'jp-3000', 'jp-3000-m1', 'jp-3444', 'jp-3500', 'jp-3500-m1', 'jp-3379', 'jp-3400'];
    // jp-3000 (a story predicted for Sep 20) stays though Global's real story 1 has started since: JP's events come to
    // Global, at times later than predicted.
    expect(ids(withPredicted(real, predicted.events, Date.parse('2026-10-01T00:00:00Z')))).toEqual(all);
    // 14 days past its start it's hidden, its mission set with it.
    expect(ids(withPredicted(real, predicted.events, Date.parse('2026-10-10T00:00:00Z')))).toEqual(
      all.filter((id) => !id.startsWith('jp-3000'))
    );
    expect(withPredicted(real, [])).toEqual(real);
  });

  it("draws them in Global's groups, kinds Global lacks too, parts under their predicted parent", () => {
    const groups = eventGroups(withPredicted(real, predicted.events, Date.parse('2026-10-10T00:00:00Z')));
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
    const merged = withPredicted(globalEvents, predicted.events);
    const latest = (kind: string) =>
      Math.max(...globalEvents.filter((e) => e.kind === kind && !e.parent).map((e) => Date.parse(e.start.date)));
    for (const e of merged.filter((x) => 'predicted' in x && x.predicted && !x.parent))
      expect(Date.parse(e.start.date) > latest(e.kind) || latest(e.kind) === -Infinity).toBe(true);
  });
});

// `pnpm predict-gl` writes this file; it is optional.
const PREDICTED_FILE = new URL('../generated/predicted_global_events.json', import.meta.url);
const predictedFiles: [string, PredictedEventsFile][] = [['the fixture', predicted]];
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
        !['predicted', 'confirmed'].includes(e.start.status) ||
        !e.jp_start ||
        !Array.isArray(e.cards) ||
        !Array.isArray(e.items) ||
        !Array.isArray(e.titles)
    );
    expect(wrong.map((e) => e.id)).toEqual([]);
  });

  it('labels every phase', () => {
    const phases = new Set(file.events.flatMap((e) => e.phases ?? []).map((p) => p.key));
    expect([...phases].filter((key) => !PHASE_LABELS[key])).toEqual([]);
  });
});

// `pnpm predict-gl` writes this file too; it is optional.
const PAIRS_FILE = new URL('../generated/event_pairs.json', import.meta.url);
describe.skipIf(!existsSync(PAIRS_FILE))('event pairs (generated/event_pairs.json)', () => {
  const { pairs } = existsSync(PAIRS_FILE)
    ? fixture<EventPairsFile>(JSON.parse(readFileSync(PAIRS_FILE, 'utf8')))
    : { pairs: [] };

  it("pair events that exist, a Global event with a JP celebration's part too", () => {
    const [gl, jp] = [new Set(globalEvents.map((e) => e.id)), new Set(jpEvents.map((e) => e.id))];
    expect(pairs.filter((p) => !gl.has(p.gl) || !jp.has(p.jp))).toEqual([]);
    // Global's Sparkly Magic Show (a part of its Holiday Celebration, with a post of its own) is JP's KIRARI MAGIC SHOW
    // (a part of JP's), from the same post; never an anchor.
    if (gl.has('1093-1')) expect(pairs.find((p) => p.gl === '1093-1')).toMatchObject({ jp: '1093-1', anchor: false });
  });
});
