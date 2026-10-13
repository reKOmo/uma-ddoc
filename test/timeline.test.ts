// @ts-nocheck
// The Timeline's calendar days, in UTC (default) or the viewer's timezone (Settings), and its lanes.

import { describe, it, expect } from 'vitest';
import { buildTimeline, laneGroups, visibleRows } from '../src/timeline/layout.ts';

process.env.TZ = 'Europe/Warsaw'; // UTC+2 in October: a 22:00 UTC start is the next local day

const banner = { key: 'cards:1', kind: 'cards', start: '2026-10-14T22:00:00.000Z', end: '2026-10-23T21:59:59.000Z' };
const now = Date.parse('2026-10-08T12:00:00Z');

// The calendar date an entry starts in, and how far into that day (hours).
function barStart(timeline, entry = banner) {
  const from = timeline.at(Date.parse(entry.start));
  const day = timeline.dayDates.findLast((d) => d.day <= from + 1e-9);
  return [day.date, Math.round((from - day.day) * 24)];
}

describe('buildTimeline', () => {
  it('lays days out in UTC by default, like the game announces them', () => {
    expect(barStart(buildTimeline([banner], { now }))).toEqual([14, 22]);
  });

  it("uses the viewer's days with utc: false", () => {
    expect(barStart(buildTimeline([banner], { now, utc: false }))).toEqual([15, 0]);
  });

  it('counts an entry without an end (a paid scout "until further notice") as one day', () => {
    const open = { key: 'cards:2', kind: 'cards', start: '2026-03-11T03:00:00.000Z', end: null };
    const timeline = buildTimeline([banner, open], { now });
    expect(Number.isFinite(timeline.days)).toBe(true);
    const [cards] = laneGroups([banner, open]);
    expect(cards.rows[0].length).toBe(2);
    expect(cards.rows[0][0].end - cards.rows[0][0].start).toBe(24 * 60 * 60 * 1000);
  });

  it('reaches past the last entry, however far ahead', () => {
    const late = { key: 'event:1', kind: 'story', start: '2027-06-01T00:00:00.000Z', end: '2027-06-10T00:00:00.000Z' };
    const timeline = buildTimeline([banner, late], { now });
    expect(timeline.days).toBeGreaterThan(timeline.at(Date.parse(late.end)));
  });
});

describe('laneGroups', () => {
  it('puts banners and events in their groups, in order, packed alike', () => {
    const entry = (key, kind, start, end) => ({ key, kind, start, end, parent: null });
    const groups = laneGroups([
      entry('event:1', 'story', '2026-10-01T00:00:00Z', '2026-10-10T00:00:00Z'),
      entry('cards:1', 'cards', '2026-10-01T00:00:00Z', '2026-10-08T00:00:00Z'),
      entry('cards:2', 'cards', '2026-10-05T00:00:00Z', '2026-10-12T00:00:00Z'),
      entry('characters:1', 'characters', '2026-10-01T00:00:00Z', '2026-10-08T00:00:00Z'),
    ]);
    expect(groups.map((g) => [g.key, g.label, g.rows.map((row) => row.map((item) => item.entry.key))])).toEqual([
      ['cards', 'timeline.supportCards', [['cards:1'], ['cards:2']]],
      ['characters', 'timeline.characters', [['characters:1']]],
      ['events-story', 'events.group.story', [['event:1']]],
    ]);
  });
});

describe('visibleRows (compact mode)', () => {
  const day = (d) => Date.parse(`2026-10-${String(d).padStart(2, '0')}T00:00:00Z`);
  const entry = (key, from, to, parent = null) => ({
    key,
    kind: parent ? 'gift' : 'celebration',
    parent,
    start: new Date(day(from)).toISOString(),
    end: new Date(day(to)).toISOString(),
  });
  // Three overlapping celebrations (three rows), then one alone; the first has two overlapping parts (two rows).
  const entries = [
    entry('event:a', 1, 10),
    entry('event:b', 2, 9),
    entry('event:c', 3, 8),
    entry('event:d', 20, 25),
    entry('event:a1', 1, 4, 'event:a'),
    entry('event:a2', 2, 3, 'event:a'),
  ];
  const [group] = laneGroups(entries);

  it('keeps only the rows with something in view', () => {
    expect(group.rows).toHaveLength(3);
    expect(visibleRows(group.rows, day(21), day(22))).toEqual(['0']);
    expect(visibleRows(group.rows, day(12), day(15))).toEqual([]);
  });

  it("counts an entry's parts only while the entry is in view, by its key", () => {
    expect(visibleRows(group.rows, day(5), day(6))).toEqual(['0', '1', '2']);
    expect(visibleRows(group.rows, day(2), day(3))).toEqual(['0', 'event:a/0', 'event:a/1', '1']);
  });

  it('treats the ends as open: touching is not overlapping', () => {
    expect(visibleRows(group.rows, day(10), day(20))).toEqual([]);
  });
});
