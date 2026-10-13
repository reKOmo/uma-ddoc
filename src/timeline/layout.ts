// Pure layout for the Timeline: positions in days from an origin, so the view only multiplies by its zoom (pixels
// per day). Days are UTC days, like the game's announcements ("10:00 p.m., Oct 14 (UTC)"), or the viewer's own with
// `utc: false`. Banners and events are laid out alike: both are entries (src/timeline/entries.js).

import { EVENT_GROUPS } from './events.ts';

// What the layout reads of an entry (an Entry, src/timeline/entries.ts; the tests lay out bare ones). The rows keep
// the entries they're given, whatever their type.
export type LaneEntry = {
  key: string;
  kind: string;
  start: string | null;
  end: string | null;
  parent?: string | null;
};
// An entry with a start (the ones laid out).
type Dated<E extends LaneEntry> = E & { start: string };

export const DAY = 24 * 60 * 60 * 1000;

// Date getters/setters for UTC or local calendar days.
const UTC = { hours: 'UTCHours', date: 'UTCDate', month: 'UTCMonth' } as const;
const LOCAL = { hours: 'Hours', date: 'Date', month: 'Month' } as const;

// Greedy interval packing: each item goes in the first row that's free by its start, so overlapping items stack and
// the row count stays minimal. Items: { start, end } (ms) plus anything else.
export function packRows<T extends { start: number; end: number }>(items: T[]): T[][] {
  const rows: { items: T[]; end: number }[] = [];
  for (const item of [...items].sort((a, b) => a.start - b.start)) {
    const row = rows.find((r) => r.end <= item.start);
    if (row) {
      row.items.push(item);
      row.end = item.end;
    } else {
      rows.push({ items: [item], end: item.end });
    }
  }
  return rows.map((r) => r.items);
}

// An entry's span (ms). One without an end (a one-day gift, a JP paid scout "until further notice") counts as a
// single day.
export function spanOf(entry: { start: string; end: string | null }): { start: number; end: number } {
  const start = Date.parse(entry.start);
  return { start, end: entry.end ? Date.parse(entry.end) : start + DAY };
}

// The Timeline's lane groups, in order: the banner sections (support cards first, then trainees), then the event groups
// (EVENT_GROUPS). The one order everything on the Timeline follows (its filter too). `key` is also what folding a
// group remembers (src/timeline/collapsed.js), `label` an i18n key.
export type LaneGroup = { key: string; label: string; kinds: string[] };
export const LANE_GROUPS: LaneGroup[] = [
  { key: 'cards', label: 'timeline.supportCards', kinds: ['cards'] },
  { key: 'characters', label: 'timeline.characters', kinds: ['characters'] },
  ...EVENT_GROUPS.map(([key, kinds]) => ({
    key: `events-${key}`,
    label: `events.group.${key}`,
    kinds,
  })),
];

// entries → [{ key, label, rows }]: the dated entries in their lane groups (by kind), each packed on its own; rows of
// [{ entry, start, end, parts }] (ms), `parts` the rows of the entry's own parts (a celebration's sub-events, an
// event's mission sets), packed the same way. A part is only under its parent, never in a group's rows. Empty groups
// are left out.
// A row item: an entry's span (ms) and the rows of its parts.
export type LaneItem<E extends LaneEntry = LaneEntry> = {
  entry: Dated<E>;
  start: number;
  end: number;
  parts: LaneItem<E>[][];
};
export type LaneGroupRows<E extends LaneEntry = LaneEntry> = { key: string; label: string; rows: LaneItem<E>[][] };

export function laneGroups<E extends LaneEntry>(entries: E[], groups: LaneGroup[] = LANE_GROUPS): LaneGroupRows<E>[] {
  const dated = entries.filter((entry): entry is Dated<E> => !!entry.start);
  const keys = new Set(dated.map((entry) => entry.key));
  const children = new Map<string, Dated<E>[]>();
  for (const entry of dated)
    if (entry.parent && keys.has(entry.parent)) {
      if (!children.has(entry.parent)) children.set(entry.parent, []);
      children.get(entry.parent)?.push(entry);
    }
  const item = (entry: Dated<E>): LaneItem<E> => ({
    entry,
    ...spanOf(entry),
    parts: packRows((children.get(entry.key) ?? []).map(item)),
  });
  const tops = dated.filter((entry) => !entry.parent || !keys.has(entry.parent));
  return groups
    .map(({ key, label, kinds }) => ({
      key,
      label,
      rows: packRows(tops.filter((entry) => kinds.includes(entry.kind)).map(item)),
    }))
    .filter((group) => group.rows.length);
}

// Compact mode: the ids of the rows with an item overlapping [from, to) (ms), so the others can fold away. A group's
// rows are `<index>`; an entry's parts' rows `<entry key>/<index>`, looked at only when the entry is in view.
export function visibleRows(rows: LaneItem[][], from: number, to: number, prefix = ''): string[] {
  return rows.flatMap((row, i) => {
    const inView = row.filter((item) => item.start < to && item.end > from);
    if (!inView.length) return [];
    return [`${prefix}${i}`, ...inView.flatMap((item) => visibleRows(item.parts, from, to, `${item.entry.key}/`))];
  });
}

// How many parts an item has, nested ones included.
export const partCount = (item: LaneItem): number => item.parts.flat().reduce((n, part) => n + 1 + partCount(part), 0);

// The calendar for these entries: everything the axis needs, `at(ms)` → a position in days and `ms(day)` back.
export type Timeline = {
  at: (ms: number) => number;
  ms: (day: number) => number;
  days: number;
  today: number;
  dayDates: { day: number; date: number }[];
  months: { date: Date; day: number }[];
};

export function buildTimeline(
  entries: LaneEntry[],
  { now = Date.now(), utc = true }: { now?: number; utc?: boolean } = {}
): Timeline {
  const f = utc ? UTC : LOCAL;
  const get = (d: Date, part: keyof typeof UTC): number => d[`get${f[part]}`]();
  const set = (d: Date, part: keyof typeof UTC, value: number) => d[`set${f[part]}`](value);
  const startOfDay = (ms: number): number => {
    const d = new Date(ms);
    d[`set${f.hours}`](0, 0, 0, 0);
    return d.getTime();
  };
  const times = entries.filter((e): e is Dated<LaneEntry> => !!e.start).flatMap((e) => Object.values(spanOf(e)));
  // A week of padding before the first entry, a month after the last (or today).
  const origin = startOfDay(Math.min(...times)) - 7 * DAY;
  const last = Math.max(...times, now) + 30 * DAY;
  const day = (ms: number): number => (ms - origin) / DAY;

  // One entry per calendar day, for the day row of the axis.
  const dayDates: { day: number; date: number }[] = [];
  for (const d = new Date(origin); d.getTime() < last; set(d, 'date', get(d, 'date') + 1)) {
    dayDates.push({ day: day(d.getTime()), date: get(d, 'date') });
  }

  const months: { date: Date; day: number }[] = [];
  const cursor = new Date(origin);
  set(cursor, 'date', 1);
  set(cursor, 'month', get(cursor, 'month') + 1);
  while (cursor.getTime() < last) {
    months.push({ date: new Date(cursor), day: day(cursor.getTime()) });
    set(cursor, 'month', get(cursor, 'month') + 1);
  }

  return { at: day, ms: (d: number) => origin + d * DAY, days: day(last), today: day(now), dayDates, months };
}
