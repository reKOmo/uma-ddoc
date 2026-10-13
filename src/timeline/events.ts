// Each server's in-game events (data/global_events.json, data/jp_events.json) for the Timeline. Pure. (Their lanes:
// laneGroups() in ./layout.js, by EVENT_GROUPS.)
//
// itemList(items) → an event's items with the common currencies first (carats, monies, shards, tickets, vouchers),
//   the rest in the post's order.
// withPredicted(real, predicted) → the real events, then the predicted ones (Global's future events from JP's,
//   `predicted: true`, ids `jp-…`) Global's own news hasn't overtaken: a predicted event is left out, with its parts,
//   when a real top-level event of its kind starts at or after it (the prediction is stale or the same event).

import type { EventItem, EventKind, GameEvent, PredictedEvent } from '../../shared/schemas/event.ts';

// (JP items Global has go by Global's names; a JP voucher is an 引換券.)
const FIRST = [/^carats$/i, /^monies$/i, /crystal shards/i, /scout tickets?$/i, /voucher|引換券/i];

// The Timeline's event groups, in order, and the kinds in each: what gives cards and pulls first (story events,
// celebrations, gifts, bonuses, missions), then competitive modes, then the rest.
export type EventGroupKey =
  | 'story'
  | 'celebration'
  | 'gifts'
  | 'bonuses'
  | 'missions'
  | 'champions_meeting'
  | 'league_of_heroes'
  | 'legend_race'
  | 'shops'
  | 'transfers';

export const EVENT_GROUPS: [EventGroupKey, EventKind[]][] = [
  ['story', ['story', 'special', 'factor_research', 'masters_challenge']],
  ['celebration', ['celebration']],
  ['gifts', ['gift', 'login_bonus']],
  ['bonuses', ['campaign']],
  ['missions', ['missions']],
  ['champions_meeting', ['champions_meeting']],
  ['league_of_heroes', ['league_of_heroes']],
  ['legend_race', ['legend_race']],
  ['shops', ['shop', 'sale']],
  ['transfers', ['transfer_requests', 'uma_outing']],
];

export function itemList(items: EventItem[]): EventItem[] {
  const rank = (item: EventItem) => {
    const i = FIRST.findIndex((re) => re.test(item.name));
    return i < 0 ? FIRST.length : i;
  };
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i)
    .map(({ item }) => item);
}

export function withPredicted(real: GameEvent[], predicted: PredictedEvent[]): GameEvent[] {
  const latest = new Map<string, number>(); // kind → the latest start of a real top-level event of it (ms)
  for (const event of real)
    if (event.start && !event.parent) {
      const start = Date.parse(event.start);
      if (!((latest.get(event.kind) ?? Number.NEGATIVE_INFINITY) >= start)) latest.set(event.kind, start);
    }
  const byId = new Map(predicted.map((event) => [event.id, event] as const));
  const top = (event: PredictedEvent): PredictedEvent => {
    const parent = event.parent && byId.get(event.parent);
    return parent && parent !== event ? top(parent) : event;
  };
  const kept = predicted.filter((event) => {
    const root = top(event);
    return !root.start || !((latest.get(root.kind) ?? Number.NEGATIVE_INFINITY) >= Date.parse(root.start));
  });
  return [...real, ...kept];
}
