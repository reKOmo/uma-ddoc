// Where a support card comes from: every banner featuring it and every event giving it, as Timeline entries
// (src/timeline/entries.js), real or predicted, oldest first. Pure.
//
// cardOrigins(cardId, byServer) → [{ entry, server, kind, rerun }], oldest first; `byServer`: { [server]: entries }
//   kind   ORIGIN_KINDS ('other': shown by the event's own kind)
//   rerun  a banner on which the card isn't new
//   An event giving it inside an event that lists it too (a celebration's gift) counts once, as the part.

import type { Entry } from './timeline/entries.ts';

export const ORIGIN_KINDS = ['banner', 'paid_banner', 'story', 'gift', 'shop', 'other'] as const;
export type OriginKind = (typeof ORIGIN_KINDS)[number];

// The fields of a Timeline entry this reads (src/timeline/entries.ts documents the whole shape; that file is typed by
// its own task, so this is kept loose).
export type OriginEntry = Pick<Entry, 'key' | 'group' | 'kind' | 'paid' | 'start' | 'parent' | 'featured'>;

export type Origin = { entry: OriginEntry; server: string; kind: OriginKind; rerun: boolean };

const EVENT_KINDS: Partial<Record<string, OriginKind>> = {
  story: 'story',
  gift: 'gift',
  login_bonus: 'gift',
  missions: 'gift',
  campaign: 'gift',
  shop: 'shop',
};

const originKind = (entry: OriginEntry): OriginKind =>
  entry.group === 'event' ? (EVENT_KINDS[entry.kind] ?? 'other') : entry.paid ? 'paid_banner' : 'banner';

function serverOrigins(cardId: number, entries: OriginEntry[], server: string): Origin[] {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const parentOf = (entry: OriginEntry): OriginEntry | undefined =>
    entry.parent == null ? undefined : byKey.get(entry.parent);
  const giving = new Map<string, { entry: OriginEntry; item: OriginEntry['featured'][number] }>();
  for (const entry of entries) {
    const item = entry.start && entry.featured.find((f) => f.card && f.id === cardId);
    if (item) giving.set(entry.key, { entry, item });
  }
  // Events whose part gives the card too: the part is where it comes from.
  const ancestors = new Set<string>();
  for (const { entry } of giving.values()) {
    for (let parent = parentOf(entry); parent; parent = parentOf(parent)) ancestors.add(parent.key);
  }
  return [...giving.values()]
    .filter(({ entry }) => !ancestors.has(entry.key))
    .map(({ entry, item }) => ({
      entry,
      server,
      kind: originKind(entry),
      rerun: entry.group !== 'event' && !item.isNew,
    }));
}

export function cardOrigins(cardId: number, byServer: Record<string, OriginEntry[]>): Origin[] {
  return Object.entries(byServer)
    .flatMap(([server, entries]) => serverOrigins(cardId, entries, server))
    .sort((a, b) => a.entry.start.localeCompare(b.entry.start));
}

// The kinds a card comes by, each once, in the order it first came by them.
export const originKinds = (origins: Origin[]): OriginKind[] => [...new Set(origins.map((origin) => origin.kind))];
