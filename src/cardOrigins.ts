// @ts-nocheck
// Where a support card comes from: every banner featuring it and every event giving it, as Timeline entries
// (src/timeline/entries.js), real or predicted, oldest first. Pure.
//
// cardOrigins(cardId, byServer) → [{ entry, server, kind, rerun }], oldest first; `byServer`: { [server]: entries }
//   kind   ORIGIN_KINDS ('other': shown by the event's own kind)
//   rerun  a banner on which the card isn't new
//   An event giving it inside an event that lists it too (a celebration's gift) counts once, as the part.

export const ORIGIN_KINDS = ['banner', 'paid_banner', 'story', 'gift', 'shop', 'other'];

const EVENT_KINDS = {
  story: 'story',
  gift: 'gift',
  login_bonus: 'gift',
  missions: 'gift',
  campaign: 'gift',
  shop: 'shop',
};

const originKind = (entry) =>
  entry.group === 'event' ? (EVENT_KINDS[entry.kind] ?? 'other') : entry.paid ? 'paid_banner' : 'banner';

function serverOrigins(cardId, entries, server) {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const giving = new Map();
  for (const entry of entries) {
    const item = entry.start && entry.featured.find((f) => f.card && f.id === cardId);
    if (item) giving.set(entry.key, { entry, item });
  }
  // Events whose part gives the card too: the part is where it comes from.
  const ancestors = new Set();
  for (const { entry } of giving.values()) {
    for (let parent = byKey.get(entry.parent); parent; parent = byKey.get(parent.parent)) ancestors.add(parent.key);
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

export function cardOrigins(cardId, byServer) {
  return Object.entries(byServer)
    .flatMap(([server, entries]) => serverOrigins(cardId, entries, server))
    .sort((a, b) => a.entry.start.localeCompare(b.entry.start));
}

// The kinds a card comes by, each once, in the order it first came by them.
export const originKinds = (origins) => [...new Set(origins.map((origin) => origin.kind))];
