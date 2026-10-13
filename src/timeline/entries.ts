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

import type { Banner, BannerId, BannerItem } from '../../shared/schemas/banner.ts';
import type { CardsFile } from '../../shared/schemas/card.ts';
import type { EventItem, EventKind, GameEvent, Phase, PredictedEvent } from '../../shared/schemas/event.ts';
import { cardIcon } from '../gametora.ts';
import { DAY } from './layout.ts';

// What withArt() (src/gametora.ts) adds to a banner file: each item's `icon`, the banner's `officialArt` flag.
export type ArtItem = BannerItem & { icon?: string | null };
export type ArtBanner = Omit<Banner, 'featured' | 'main'> & {
  featured: ArtItem[];
  main: ArtItem | null;
  officialArt?: boolean;
};
export type ArtBannerFile = { characters: ArtBanner[]; cards: ArtBanner[] };

export type EntryGroup = 'characters' | 'cards' | 'event';
export type EntryKind = 'characters' | 'cards' | EventKind;
export type EntryStatus = 'confirmed' | 'predicted' | 'upcoming' | 'ended' | 'live';
export type Tone = 'kind-characters' | `type-${string}` | `kind-${EventKind}`;
export type Art = { src: string | undefined; official: boolean };
export type Prediction = {
  from: { start: string | undefined; end: string | null };
  margin: number | undefined;
  confirmed: boolean;
};
export type NewsLink = { url: string; site: string };
export type Relation = {
  type: 'rerunOf' | 'reheld' | 'partOf';
  target: string | null;
  start: string;
  end: string | null;
};
export type Featured = {
  key: string | number;
  id: number | null;
  name: string;
  title: string | null;
  icon: string | null;
  card: boolean;
  isNew: boolean;
  stars: number | null;
  copies: number | null;
};
export type Counterpart = { server: 'gl' | 'jp'; id: number | string };

export type Entry = {
  // unique across the calendar: 'characters:<id>', 'cards:<id>', 'event:<id>'
  key: string;
  // the banner's or event's own id
  id: BannerId | string;
  // 'characters' | 'cards' | 'event'
  group: EntryGroup;
  // 'characters' | 'cards' | an event kind (EVENT_KINDS): its lane group, pill and colour
  kind: EntryKind;
  // the class that colours its bar and pill: 'kind-characters', 'type-<main card's type>', 'kind-<kind>'
  tone: Tone;
  // its own name (a scout's from its post, an event's) or null
  name: string | null;
  // the featured item a banner bar is labelled by (and how many more), or null
  main: { name: string; others: number } | null;
  // ISO; end null for a one-day event or, with `openEnded`, a scout running "until further notice"
  start: string;
  end: string | null;
  openEnded: boolean;
  // as bannerStatus()
  status: EntryStatus;
  // { src, official } or null
  art: Art | null;
  // a paid scout (JP)
  paid: boolean;
  // { from: { start, end } (JP's dates), margin (± days), confirmed } for Global's predicted entries
  prediction: Prediction | null;
  // { url, site } the post it's from and its site's host name (umamusume.com / umamusume.jp), or null
  news: NewsLink | null;
  // the same banner or event on the other server (filled by loadTimeline()), or null
  counterpart: Counterpart | null;
  // [{ type: 'rerunOf' | 'reheld' | 'partOf', target (an entry key), start, end }]
  relations: Relation[];
  // the key of the entry it's part of, or null
  parent: string | null;
  // its parts' keys, by start
  parts: string[];
  // what a scout with no featured items draws from (JP's paid scouts), or null
  note: string | null;
  // a banner's featured items, an event's support cards (`card`: a support card, ranked; `stars`: a trainee's rarity)
  featured: Featured[];
  // an event's other rewards, schedule and titles (empty for a banner)
  items: EventItem[];
  phases: Phase[];
  titles: string[];
};

// bannerStatus(): the banner's dates (Global's predicted ones carry `predicted`, `confirmed` when known).
type StatusDates = Pick<Banner, 'start' | 'end' | 'confirmed' | 'predicted'>;

export function bannerStatus(banner: StatusDates, now: number = Date.now()): EntryStatus {
  if (banner.confirmed) return 'confirmed';
  if (banner.predicted) return 'predicted';
  if (now < Date.parse(banner.start)) return 'upcoming';
  if (banner.end && now > Date.parse(banner.end)) return 'ended';
  return 'live';
}

// `predicted` only on predicted banners and predicted events (PredictedEvent).
const isPredicted = (x: Banner | GameEvent): x is Banner | PredictedEvent => 'predicted' in x && Boolean(x.predicted);

const prediction = (x: Banner | GameEvent): Prediction | null =>
  isPredicted(x)
    ? { from: { start: x.jp_start, end: x.jp_end ?? null }, margin: x.margin_days, confirmed: !!x.confirmed }
    : null;
// The post it's from, and the site it's on (umamusume.com: Global's; umamusume.jp: JP's, a predicted entry's too).
const news = (x: { news_url?: string | null }): NewsLink | null =>
  x.news_url ? { url: x.news_url, site: new URL(x.news_url).hostname.replace(/^www\./, '') } : null;

function bannerEntry(
  banner: ArtBanner,
  group: 'characters' | 'cards',
  byId: Map<BannerId, ArtBanner>,
  now: number
): Entry {
  const key = (id: BannerId) => `${group}:${id}`;
  const relation = (type: Relation['type'], other: ArtBanner | false | undefined): Relation | false | undefined =>
    other && { type, target: key(other.id), start: other.start, end: other.end };
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
        type: 'reheld' as const,
        target: byId.has(banner.rerun.id) ? key(banner.rerun.id) : null,
        start: banner.rerun.start,
        end: banner.rerun.end,
      },
    ].filter((r): r is Relation => Boolean(r)),
    parent: null,
    parts: [],
    note: banner.note ?? null,
    featured: banner.featured.map(
      (item): Featured => ({
        key: item.id ?? `${item.title}|${item.name}`,
        id: item.id,
        name: item.name ?? `#${item.id}`,
        title: item.title ?? null,
        icon: item.icon ?? null,
        card: group === 'cards',
        isNew: !!item.new,
        stars: group === 'characters' ? item.rarity : null,
        copies: null,
      })
    ),
    items: [],
    phases: [],
    titles: [],
  };
}

export function bannerEntries(file: ArtBannerFile, { now = Date.now() }: { now?: number } = {}): Entry[] {
  return (['cards', 'characters'] as const).flatMap((group) => {
    const byId = new Map(file[group].map((b) => [b.id, b] as const));
    return file[group].map((banner) => bannerEntry(banner, group, byId, now));
  });
}

export function eventEntries(
  events: GameEvent[],
  { cards, now = Date.now() }: { cards?: CardsFile; now?: number } = {}
): Entry[] {
  const key = (id: string) => `event:${id}`;
  const byId = new Map(events.map((e) => [e.id, e] as const));
  // Each event's parts (a celebration's sub-events, an event's mission sets), by start.
  const parts = Map.groupBy(
    events.filter((e) => e.parent && e.start),
    (e) => e.parent
  );
  for (const list of parts.values()) list.sort((a, b) => a.start.localeCompare(b.start));
  return events.map((event): Entry => {
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
      relations: parent
        ? [{ type: 'partOf' as const, target: key(parent.id), start: parent.start, end: parent.end }]
        : [],
      parent: parent ? key(parent.id) : null,
      parts: (parts.get(event.id) ?? []).map((part) => key(part.id)),
      note: null,
      featured: event.cards.map(
        (card): Featured => ({
          key: `${card.title}|${card.name}`,
          id: card.id ?? null,
          // A predicted event's cards are JP's: Global's English name where the card data has one.
          name: (isPredicted(event) && cards?.[card.id]?.name.en) || card.name,
          title: card.title ? `[${card.title}]` : null,
          icon: card.id != null ? cardIcon(card.id, cards) : null,
          card: true,
          isNew: false,
          stars: null,
          copies: card.copies ?? null,
        })
      ),
      items: event.items,
      phases: event.phases ?? [],
      titles: event.titles,
    };
  });
}
