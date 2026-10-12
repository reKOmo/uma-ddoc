// Pure layout for the Timeline: positions in days from an origin, so the view only multiplies by its zoom (pixels
// per day). Days are UTC days, like the game's announcements ("10:00 p.m., Oct 14 (UTC)"), or the viewer's own with
// `utc: false`. Banners and events are laid out alike: both are entries (src/timeline/entries.js).

import { EVENT_GROUPS } from './events.js';

export const DAY = 24 * 60 * 60 * 1000;

// Date getters/setters for UTC or local calendar days.
const UTC = { hours: 'UTCHours', date: 'UTCDate', month: 'UTCMonth' };
const LOCAL = { hours: 'Hours', date: 'Date', month: 'Month' };

// Greedy interval packing: each item goes in the first row that's free by its start, so overlapping items stack and
// the row count stays minimal. Items: { start, end } (ms) plus anything else.
export function packRows(items) {
  const rows = [];
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
export function spanOf(entry) {
  const start = Date.parse(entry.start);
  return { start, end: entry.end ? Date.parse(entry.end) : start + DAY };
}

// The Timeline's lane groups, in order: the banner sections, then the event groups (EVENT_GROUPS). `key` is also
// what folding a group remembers (src/timeline/collapsed.js), `label` an i18n key.
export const LANE_GROUPS = [
  { key: 'characters', label: 'timeline.characters', kinds: ['characters'] },
  { key: 'cards', label: 'timeline.supportCards', kinds: ['cards'] },
  ...EVENT_GROUPS.map(([key, kinds]) => ({ key: `events-${key}`, label: `events.group.${key}`, kinds })),
];

// entries → [{ key, label, rows }]: the dated entries in their lane groups (by kind), each packed on its own; rows of
// [{ entry, start, end, parts }] (ms), `parts` the rows of the entry's own parts (a celebration's sub-events, an
// event's mission sets), packed the same way. A part is only under its parent, never in a group's rows. Empty groups
// are left out.
export function laneGroups(entries, groups = LANE_GROUPS) {
  const dated = entries.filter((entry) => entry.start);
  const keys = new Set(dated.map((entry) => entry.key));
  const children = new Map();
  for (const entry of dated)
    if (entry.parent && keys.has(entry.parent)) {
      if (!children.has(entry.parent)) children.set(entry.parent, []);
      children.get(entry.parent).push(entry);
    }
  const item = (entry) => ({ entry, ...spanOf(entry), parts: packRows((children.get(entry.key) ?? []).map(item)) });
  const tops = dated.filter((entry) => !entry.parent || !keys.has(entry.parent));
  return groups
    .map(({ key, label, kinds }) => ({
      key,
      label,
      rows: packRows(tops.filter((entry) => kinds.includes(entry.kind)).map(item)),
    }))
    .filter((group) => group.rows.length);
}

// How many parts an item has, nested ones included.
export const partCount = (item) => item.parts.flat().reduce((n, part) => n + 1 + partCount(part), 0);

// The calendar for these entries: everything the axis needs, and `at(ms)` → a position in days.
export function buildTimeline(entries, { now = Date.now(), utc = true } = {}) {
  const f = utc ? UTC : LOCAL;
  const get = (d, part) => d[`get${f[part]}`]();
  const set = (d, part, value) => d[`set${f[part]}`](value);
  const startOfDay = (ms) => {
    const d = new Date(ms);
    d[`set${f.hours}`](0, 0, 0, 0);
    return d.getTime();
  };
  const times = entries.filter((e) => e.start).flatMap((e) => Object.values(spanOf(e)));
  // A week of padding before the first entry, a month after the last (or today).
  const origin = startOfDay(Math.min(...times)) - 7 * DAY;
  const last = Math.max(...times, now) + 30 * DAY;
  const day = (ms) => (ms - origin) / DAY;

  // One entry per calendar day, for the day row of the axis.
  const dayDates = [];
  for (const d = new Date(origin); d.getTime() < last; set(d, 'date', get(d, 'date') + 1)) {
    dayDates.push({ day: day(d.getTime()), date: get(d, 'date') });
  }

  const months = [];
  const cursor = new Date(origin);
  set(cursor, 'date', 1);
  set(cursor, 'month', get(cursor, 'month') + 1);
  while (cursor.getTime() < last) {
    months.push({ date: new Date(cursor), day: day(cursor.getTime()) });
    set(cursor, 'month', get(cursor, 'month') + 1);
  }

  return { at: day, days: day(last), today: day(now), dayDates, months };
}
