import type { Banner, BannerId } from '../../shared/schemas/banner.ts';
import type { CardsFile } from '../../shared/schemas/card.ts';
import type { EventItem, EventKind, GameEvent, Phase, PredictedEvent, Race } from '../../shared/schemas/event.ts';
import { type ArtBanner, type ArtBannerFile, type ArtItem, cardIcon } from '../gametora.ts';
import { DAY } from './layout.ts';

export type { ArtBanner, ArtBannerFile, ArtItem };

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
  key: string;
  id: BannerId | string;
  group: EntryGroup;
  kind: EntryKind;
  // A banner takes its main card's type colour.
  tone: Tone;
  name: string | null;
  main: { name: string; others: number } | null;
  start: string;
  end: string | null;
  openEnded: boolean;
  status: EntryStatus;
  art: Art | null;
  paid: boolean;
  prediction: Prediction | null;
  news: NewsLink | null;
  // the same banner or event on the other server (filled by the Timeline page from loadTimeline()'s `others`), or null
  counterpart: Counterpart | null;
  relations: Relation[];
  parent: string | null;
  parts: string[];
  note: string | null;
  // `card`: a support card (ranked); `stars`: a trainee's rarity.
  featured: Featured[];
  items: EventItem[];
  phases: Phase[];
  races: Race[];
  titles: string[];
};

type StatusDates = Pick<Banner, 'start' | 'end' | 'confirmed' | 'predicted'>;

export function bannerStatus(banner: StatusDates, now: number = Date.now()): EntryStatus {
  if (banner.confirmed) return 'confirmed';
  if (banner.predicted) return 'predicted';
  if (now < Date.parse(banner.start)) return 'upcoming';
  if (banner.end && now > Date.parse(banner.end)) return 'ended';
  return 'live';
}

const isPredicted = (x: Banner | GameEvent): x is Banner | PredictedEvent => 'predicted' in x && Boolean(x.predicted);

const prediction = (x: Banner | GameEvent): Prediction | null =>
  isPredicted(x)
    ? { from: { start: x.jp_start, end: x.jp_end ?? null }, margin: x.margin_days, confirmed: !!x.confirmed }
    : null;
const news = (x: { news_url?: string | null }): NewsLink | null =>
  x.news_url ? { url: x.news_url, site: new URL(x.news_url).hostname.replace(/^www\./, '') } : null;

// An item without an id matches by title and name.
const isMain = (banner: ArtBanner, item: ArtBanner['featured'][number]): boolean =>
  banner.main != null &&
  (item.id != null ? item.id === banner.main.id : item.title === banner.main.title && item.name === banner.main.name);

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
    // The card the banner is named after first; the rest as the banner lists them (a stable sort).
    featured: banner.featured
      .toSorted((a, b) => Number(isMain(banner, b)) - Number(isMain(banner, a)))
      .map(
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
    races: [],
    titles: [],
  };
}

export function bannerEntries(
  file: Pick<ArtBannerFile, 'characters' | 'cards'>,
  { now = Date.now() }: { now?: number } = {}
): Entry[] {
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
      // A one-day event (no end) runs the whole day.
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
      races: event.races ?? [],
      titles: event.titles,
    };
  });
}
