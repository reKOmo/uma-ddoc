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

// A predicted event (with its parts) shows until 14 days past its predicted start, Global's news or not: JP's events
// come to Global, at times later than predicted (ml/events.py writes them for as long, its SHOWN_DAYS).
const SHOWN_MS = 14 * 24 * 3600 * 1000;

export function withPredicted(real: GameEvent[], predicted: PredictedEvent[], now: number = Date.now()): GameEvent[] {
  const byId = new Map(predicted.map((event) => [event.id, event] as const));
  const top = (event: PredictedEvent): PredictedEvent => {
    const parent = event.parent && byId.get(event.parent);
    return parent && parent !== event ? top(parent) : event;
  };
  const kept = predicted.filter((event) => Date.parse(top(event).start.date) + SHOWN_MS >= now);
  return [...real, ...kept];
}
