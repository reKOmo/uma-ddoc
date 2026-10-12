// Each server's in-game events (data/global_events.json, data/jp_events.json) for their lanes on the banner calendar.
// Pure.
//
// eventGroups(events) → [{ key, rows }]: the events in labelled groups by type (EVENT_GROUPS), each packed on its own
//   so overlapping events stack; rows of [{ event, start, end, parts }] (times in ms; `parts`: the rows of its own
//   parts, a celebration's sub-events or an event's mission sets, packed the same way). A part is only under its
//   parent, never in a group's rows. Events without a start are left out; one without an end counts as a single day.
// itemList(items) → an event's items with the common currencies first (carats, monies, shards, tickets, vouchers),
//   the rest in the post's order.
// subEvents(event, events) → a celebration's sub-events, by start.

import { DAY, packRows } from './timeline.js';

// (JP items Global has go by Global's names; a JP voucher is an 引換券.)
const FIRST = [/^carats$/i, /^monies$/i, /crystal shards/i, /scout tickets?$/i, /voucher|引換券/i];

// The Timeline's event groups, in order, and the kinds in each.
export const EVENT_GROUPS = [
  ['story', ['story', 'special', 'factor_research', 'masters_challenge']],
  ['champions_meeting', ['champions_meeting']],
  ['league_of_heroes', ['league_of_heroes']],
  ['legend_race', ['legend_race']],
  ['celebration', ['celebration']],
  ['gifts', ['gift', 'login_bonus']],
  ['missions', ['missions']],
  ['bonuses', ['campaign']],
  ['shops', ['shop', 'sale']],
  ['transfers', ['transfer_requests', 'uma_outing']],
];

export function eventGroups(events) {
  const dated = events.filter((event) => event.start);
  const ids = new Set(dated.map((event) => event.id));
  const children = new Map();
  for (const event of dated)
    if (event.parent && ids.has(event.parent)) {
      if (!children.has(event.parent)) children.set(event.parent, []);
      children.get(event.parent).push(event);
    }
  const span = (event) => {
    const start = Date.parse(event.start);
    const end = event.end ? Date.parse(event.end) : start + DAY;
    return { event, start, end, parts: packRows((children.get(event.id) ?? []).map(span)) };
  };
  const tops = dated.filter((event) => !event.parent || !ids.has(event.parent));
  return EVENT_GROUPS.map(([key, kinds]) => ({
    key,
    rows: packRows(tops.filter((event) => kinds.includes(event.kind)).map(span)),
  })).filter((group) => group.rows.length);
}

// How many parts an event has, nested ones included.
export const partCount = (item) => item.parts.flat().reduce((n, part) => n + 1 + partCount(part), 0);

export function itemList(items) {
  const rank = (item) => {
    const i = FIRST.findIndex((re) => re.test(item.name));
    return i < 0 ? FIRST.length : i;
  };
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i)
    .map(({ item }) => item);
}

export function subEvents(event, events) {
  return events.filter((e) => e.parent === event.id).sort((a, b) => a.start.localeCompare(b.start));
}
