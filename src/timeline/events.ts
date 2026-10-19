import type { EventItem, EventKind, GameEvent, PredictedEvent } from '../../shared/schemas/event.ts';

// JP items Global has go by Global's names; a JP voucher is 引換券.
const FIRST = [/^carats$/i, /^monies$/i, /crystal shards/i, /scout tickets?$/i, /voucher|引換券/i];

// What gives cards and pulls comes first, then competitive modes.
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

// A predicted event (with its parts) is dropped once a real top-level event of its kind starts at or after it.
export function withPredicted(real: GameEvent[], predicted: PredictedEvent[]): GameEvent[] {
  const latest = new Map<string, number>();
  for (const event of real)
    if (!event.parent) {
      const start = Date.parse(event.start.date);
      if (!((latest.get(event.kind) ?? Number.NEGATIVE_INFINITY) >= start)) latest.set(event.kind, start);
    }
  const byId = new Map(predicted.map((event) => [event.id, event] as const));
  const top = (event: PredictedEvent): PredictedEvent => {
    const parent = event.parent && byId.get(event.parent);
    return parent && parent !== event ? top(parent) : event;
  };
  const kept = predicted.filter((event) => {
    const root = top(event);
    return !((latest.get(root.kind) ?? Number.NEGATIVE_INFINITY) >= Date.parse(root.start.date));
  });
  return [...real, ...kept];
}
