// Banners and events as Timeline entries: one shape for everything on the calendar, whichever server or source it
// came from, so the page and its sheet have no server-specific code. Every difference between the data files (JP's
// scout names and re-runs, Global's predicted banners, art from the news or GameTora, events' parts) is read here and
// nowhere else. Pure.
//
// bannerEntries(file, { now }) → entries of a banner file ({ characters, cards }, after withArt() in
//   src/gametora.js), real or predicted
// eventEntries(events, { cards, now }) → entries of an events file (real + predicted, src/timeline/events.js)
// bannerStatus(banner, now) → 'confirmed' | 'predicted' | 'upcoming' | 'ended' | 'live'
//
// An entry:
//   key        unique across the calendar: 'characters:<id>', 'cards:<id>', 'event:<id>'
//   id         the banner's or event's own id
//   group      'characters' | 'cards' | 'event'
//   kind       'characters' | 'cards' | an event kind (EVENT_KINDS): its lane group, pill and colour
//   tone       the class that colours its bar and pill: 'kind-characters', 'type-<main card's type>', 'kind-<kind>'
//   name       its own name (a scout's from its post, an event's) or null
//   main       { name, others } the featured item a banner bar is labelled by (and how many more), or null
//   start, end ISO; end null for a one-day event or, with `openEnded`, a scout running "until further notice"
//   status     as bannerStatus()
//   art        { src, official } or null
//   paid       a paid scout (JP)
//   prediction { from: { start, end } (JP's dates), margin (± days), confirmed } for Global's predicted entries
//   news       { url, site } the post it's from and its site's host name (umamusume.com / umamusume.jp), or null
//   relations  [{ type: 'rerunOf' | 'reheld' | 'partOf', target (an entry key), start, end }]
//   counterpart { server, id } the same banner or event on the other server (filled by loadTimeline()), or null
//   parent     the key of the entry it's part of, or null; `parts`: its parts' keys, by start
//   note       what a scout with no featured items draws from (JP's paid scouts), or null
//   featured   [{ key, id, name, title, icon, card, isNew, stars, copies }]: a banner's featured items, an event's
//              support cards (`card`: a support card, ranked; `stars`: a trainee's rarity)
//   items, phases, titles  an event's other rewards, schedule and titles (empty for a banner)

import { cardIcon } from '../gametora.js';
import { DAY } from './layout.js';

export function bannerStatus(banner, now = Date.now()) {
  if (banner.confirmed) return 'confirmed';
  if (banner.predicted) return 'predicted';
  if (now < Date.parse(banner.start)) return 'upcoming';
  if (banner.end && now > Date.parse(banner.end)) return 'ended';
  return 'live';
}

const prediction = (x) =>
  x.predicted
    ? { from: { start: x.jp_start, end: x.jp_end ?? null }, margin: x.margin_days, confirmed: !!x.confirmed }
    : null;
// The post it's from, and the site it's on (umamusume.com: Global's; umamusume.jp: JP's, a predicted entry's too).
const news = (x) => (x.news_url ? { url: x.news_url, site: new URL(x.news_url).hostname.replace(/^www\./, '') } : null);

function bannerEntry(banner, group, byId, now) {
  const key = (id) => `${group}:${id}`;
  const relation = (type, other) => other && { type, target: key(other.id), start: other.start, end: other.end };
  return {
    key: key(banner.id),
    id: banner.id,
    group,
    kind: group,
    tone: group === 'cards' ? `type-${banner.main?.type ?? 'none'}` : 'kind-characters',
    name: banner.name ?? null,
    main: banner.main ? { name: banner.main.name, others: banner.featured.length - 1 } : null,
    start: banner.start,
    end: banner.end ?? null,
    openEnded: !banner.end,
    status: bannerStatus(banner, now),
    art: { src: banner.image, official: !!banner.officialArt },
    paid: !!banner.paid,
    prediction: prediction(banner),
    news: news(banner),
    // A re-run and its original (JP: a scout re-held after an issue) point to each other; a re-run not on the
    // calendar keeps its dates (no target).
    counterpart: null,
    relations: [
      relation('rerunOf', banner.rerunOf != null && byId.get(banner.rerunOf)),
      banner.rerun && {
        type: 'reheld',
        target: byId.has(banner.rerun.id) ? key(banner.rerun.id) : null,
        start: banner.rerun.start,
        end: banner.rerun.end,
      },
    ].filter(Boolean),
    parent: null,
    parts: [],
    note: banner.note ?? null,
    featured: banner.featured.map((item) => ({
      key: item.id ?? `${item.title}|${item.name}`,
      id: item.id,
      name: item.name ?? `#${item.id}`,
      title: item.title ?? null,
      icon: item.icon ?? null,
      card: group === 'cards',
      isNew: !!item.new,
      stars: group === 'characters' ? item.rarity : null,
      copies: null,
    })),
    items: [],
    phases: [],
    titles: [],
  };
}

export function bannerEntries(file, { now = Date.now() } = {}) {
  return ['cards', 'characters'].flatMap((group) => {
    const byId = new Map(file[group].map((b) => [b.id, b]));
    return file[group].map((banner) => bannerEntry(banner, group, byId, now));
  });
}

export function eventEntries(events, { cards, now = Date.now() } = {}) {
  const key = (id) => `event:${id}`;
  const byId = new Map(events.map((e) => [e.id, e]));
  // Each event's parts (a celebration's sub-events, an event's mission sets), by start.
  const parts = Map.groupBy(
    events.filter((e) => e.parent && e.start),
    (e) => e.parent
  );
  for (const list of parts.values()) list.sort((a, b) => a.start.localeCompare(b.start));
  return events.map((event) => {
    const parent = event.parent && byId.get(event.parent);
    return {
      key: key(event.id),
      id: event.id,
      group: 'event',
      kind: event.kind,
      tone: `kind-${event.kind}`,
      name: event.name ?? null,
      main: null,
      start: event.start,
      end: event.end ?? null,
      openEnded: false,
      // (A one-day event runs the whole day.)
      status: event.start
        ? bannerStatus({ ...event, end: event.end ?? new Date(Date.parse(event.start) + DAY).toISOString() }, now)
        : 'upcoming',
      art: event.image ? { src: event.image, official: true } : null,
      paid: false,
      prediction: prediction(event),
      news: news(event),
      counterpart: null,
      relations: parent ? [{ type: 'partOf', target: key(parent.id), start: parent.start, end: parent.end }] : [],
      parent: parent ? key(parent.id) : null,
      parts: (parts.get(event.id) ?? []).map((part) => key(part.id)),
      note: null,
      featured: event.cards.map((card) => ({
        key: `${card.title}|${card.name}`,
        id: card.id ?? null,
        // A predicted event's cards are JP's: Global's English name where the card data has one.
        name: (event.predicted && cards?.[card.id]?.name.en) || card.name,
        title: card.title ? `[${card.title}]` : null,
        icon: card.id != null ? cardIcon(card.id, cards) : null,
        card: true,
        isNew: false,
        stars: null,
        copies: card.copies ?? null,
      })),
      items: event.items,
      phases: event.phases ?? [],
      titles: event.titles,
    };
  });
}
