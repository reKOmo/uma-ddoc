import { describe, it, expect } from 'vitest';
import { EVENT_GROUPS, eventGroups, itemList, partCount, subEvents } from '../src/eventStrip.js';
import { CM_PHASES, EVENT_KINDS } from '../scripts/lib/events.js';
import { DAY } from '../src/timeline.js';
import en from '../src/i18n/en.json' with { type: 'json' };
import globalEvents from '../data/global_events.json' with { type: 'json' };
import jpEvents from '../data/jp_events.json' with { type: 'json' };

// The Timeline shows each server's events the same way.
const SERVERS = [
  ['Global', globalEvents],
  ['JP', jpEvents],
];

describe('eventGroups', () => {
  const event = (id, kind, start, end, parent = null) => ({ id, kind, start, end, parent });

  it('groups events by type, each packed on its own, parts only under their parent', () => {
    const groups = eventGroups([
      event('1', 'story', '2026-01-01T00:00:00Z', '2026-01-10T00:00:00Z'),
      event('2', 'special', '2026-01-05T00:00:00Z', '2026-01-12T00:00:00Z'),
      event('3', 'celebration', '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z'),
      event('3-1', 'login_bonus', '2026-01-01T00:00:00Z', '2026-01-15T00:00:00Z', '3'),
      event('3-m1', 'missions', '2026-01-02T00:00:00Z', '2026-01-09T00:00:00Z', '3'),
      event('4', 'gift', '2026-01-03T00:00:00Z', null),
    ]);
    expect(groups.map((g) => [g.key, g.rows.map((row) => row.map((item) => item.event.id))])).toEqual([
      ['story', [['1'], ['2']]],
      ['celebration', [['3']]],
      ['gifts', [['4']]],
    ]);
    const celebration = groups[1].rows[0][0];
    expect(celebration.parts.map((row) => row.map((item) => item.event.id))).toEqual([['3-1'], ['3-m1']]);
    expect(partCount(celebration)).toBe(2);
    expect(groups[2].rows[0][0].end - groups[2].rows[0][0].start).toBe(DAY); // no end: one day
  });

  it.each(SERVERS)('places every dated event in the data once, in a known group (%s)', (_, events) => {
    const placed = (items) => items.flatMap((item) => [item.event.id, ...placed(item.parts.flat())]);
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

describe('subEvents', () => {
  it("lists a celebration's sub-events by start", () => {
    const all = [
      { id: '902', parent: null, start: '2026-07-22T22:00:00Z' },
      { id: '902-21', parent: '902', start: '2026-07-23T15:00:00Z' },
      { id: '902-11', parent: '902', start: '2026-07-22T22:00:00Z' },
    ];
    expect(subEvents(all[0], all).map((e) => e.id)).toEqual(['902-11', '902-21']);
  });
});

describe.each(SERVERS)('the event data (%s)', (_, events) => {
  it('only uses kinds the app styles and labels', () => {
    expect(events.filter((e) => !EVENT_KINDS.includes(e.kind))).toEqual([]);
  });

  it('gives every Champions Meeting its schedule, in order', () => {
    const keys = CM_PHASES.map(([key]) => key);
    // (Only an announcement without dates of its own has none: JP's first cup of 2022, from a thin 2021 archive.)
    for (const e of events.filter((x) => x.kind === 'champions_meeting' && (x.end || x.phases?.length)))
      expect({ id: e.id, phases: e.phases?.map((p) => p.key) }).toEqual({ id: e.id, phases: keys });
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
