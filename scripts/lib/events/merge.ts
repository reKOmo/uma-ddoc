// Merges posts about the same event (same kind and name, overlapping dates) into one event, and what a later post changes.
// The passes buildEvents runs over the fragments: mergePosts, joinUndated, resolveParents, spanParts.

import { en } from '../news/lang/en.ts';
import type { Lexicon } from '../news/lang/index.ts';
import type { EventItem, Race } from '../../../shared/schemas/event.ts';
import type { Fragment } from './fragments.ts';
import { type Dates, span } from './dates.ts';
import { norm } from './rewards.ts';
import { DAY } from '../news/text.ts';

export type Merge = { from: string; into: string; how: 'overlap' | 'same dates' | 'undated' | 'ended' | 'dropped' };

const GROUP_DAYS = 14;
// An event announced without dates comes within this many days ("coming in early February", posted Jan 9; a cup's
// name comes back months later). (JP: `lang.sameEventDays(kind)`, cups announced two months ahead.)
const SAME_EVENT_DAYS = 45;
// How far along a post is: dates from a later stage win.
const STAGE: Record<string, number> = { announced: 1, league_selection: 2, started: 3 };

// (An event without a start, an "ended" post's, never matches: NaN.)
const ms = (date: string | null): number => Date.parse(date ?? '');
const endOf = (e: Dates): number => ms(e.end ?? e.start) || ms(e.start) + DAY;
const overlap = (a: Dates, b: Dates): boolean => ms(a.start) <= endOf(b) && ms(b.start) <= endOf(a);
// One race weekend's post inside a G1 celebration's part for all of them (JP's weekly 「育成報酬」ピース追加キャンペーン
// under the part listing every race's window): less than half its length, within it.
const windowOf = (part: Dates, post: Dates): boolean =>
  endOf(post) - ms(post.start) < (endOf(part) - ms(part.start)) / 2 &&
  ms(post.start) >= ms(part.start) - DAY &&
  endOf(post) <= endOf(part) + DAY;
const sameKey = (e: { kind: string; name: string | null }): string => `${e.kind}|${norm(e.name)}`;

export function mergeItems(a: EventItem[], b: EventItem[]): EventItem[] {
  const items = new Map<string, EventItem>(a.map((i) => [norm(i.name), i]));
  for (const item of b) {
    const old = items.get(norm(item.name));
    if (!old || (item.count != null && (old.count == null || item.count > old.count))) items.set(norm(item.name), item);
  }
  return [...items.values()];
}

// A later post's races, with what it leaves out ("Outer → Inner / Rain / Heavy", no season) from an earlier post's same
// races.
function laterRaces(old: Race[] = [], next: Race[]): Race[] {
  if (old.length !== next.length || old.some((race, i) => race.track !== next[i].track)) return next;
  return next.map((race, i) => {
    const filled = { ...race };
    for (const [key, value] of Object.entries(old[i]) as [keyof Race, Race[keyof Race]][])
      if (filled[key] == null) Object.assign(filled, { [key]: value });
    return filled;
  });
}

function merge(event: Fragment, next: Fragment, lang: Lexicon = en): Fragment {
  const later = (STAGE[next.phase ?? ''] ?? 0) >= (STAGE[event.phase ?? ''] ?? 0) && next.start;
  // (JP: posts at the same stage each give some of an event's windows, `lang.unionDates`: one race weekend's piece
  // campaign in its own post, all of them in a celebration's.)
  const union = lang.unionDates && later && event.start && next.phase === event.phase;
  const cards = new Map(event.cards.map((card) => [card.id, card]));
  for (const card of next.cards)
    cards.set(card.id, { ...card, copies: Math.max(card.copies ?? 0, cards.get(card.id)?.copies ?? 0) || null });
  return {
    ...event,
    // A cup's schedule from the latest post that has one ("coming soon" posts give only rough starts).
    ...(next.phases?.length && { phases: next.phases }),
    // Race conditions too (a cup's can change after it's announced).
    ...(next.races?.length && { races: laterRaces(event.races, next.races) }),
    ...(later && {
      // (Both begun: the first post's start stands; a story's later episodes don't move it.)
      start: next.phase === 'started' && event.phase === 'started' && event.start ? event.start : next.start,
      end: next.end ?? event.end,
      phase: next.phase,
      news_url: next.news_url,
    }),
    ...(union && span([event, next])),
    // An event with a post of its own that a celebration's post lists too is that celebration's part.
    parent: event.parent ?? next.parent,
    image: event.image ?? next.image,
    cards: [...cards.values()],
    items: mergeItems(event.items, next.items),
    titles: [...new Set([...event.titles, ...next.titles])],
    // (A celebration lists the same windows as the campaign's own post: the later post's.)
    ...((next.scouts ?? event.scouts) && { scouts: next.scouts?.length ? next.scouts : event.scouts }),
  };
}

// The fragments merged into events: `events` are the kept ones, `byKey` the events per sameKey(), `alias` a merged
// fragment's id → its event's id.
type Joined = { events: Fragment[]; byKey: Map<string, Fragment[]>; alias: Map<string, string> };

// (A later post's dated fragment joins the first event it overlaps and may join, see joins().)
function findMatch(f: Fragment, same: Fragment[], joins: (e: Fragment, f: Fragment) => boolean): Fragment | undefined {
  if (f.start) return same.find((e) => overlap(e, f) && joins(e, f));
  return same
    .filter((e) => ms(e.start) <= Date.parse(f.posted))
    .find((e) => Date.parse(f.posted) - endOf(e) <= GROUP_DAYS * DAY);
}

// (JP: a typo in one post's name. The same kind with the very same dates is the same event, `lang.sameDates`; the
// later post's name wins.)
function findTwin(f: Fragment, events: Fragment[], lang: Lexicon): Fragment | undefined {
  if (!f.start || f.parent || !lang.sameDates?.includes(f.kind)) return undefined;
  return events.find((e) => !e.parent && e.kind === f.kind && e.start === f.start && e.end === f.end);
}

export function mergePosts(fragments: Fragment[], lang: Lexicon, merges: Merge[]): Joined {
  const events: Fragment[] = [];
  const byKey = new Map<string, Fragment[]>();
  const alias = new Map<string, string>(); // a merged fragment's id → its event's (sub-events point at their post's celebration)
  const byFragmentId = new Map(fragments.map((f) => [f.id, f]));
  const series = (part: Fragment) =>
    norm(byFragmentId.get(part.parent ?? '')?.name?.replace(/\s*(?:part \d+|第\d+弾)$/i, '') ?? null);
  // (the celebration a part belongs to, after its posts merged)
  const owner = (part: Fragment) => part.parent && (alias.get(part.parent) ?? part.parent);
  // (Parts of two celebration posts are one event only within one series, and only a shop re-listed with new items
  // or a part with the very same start (a re-listing): New Beginnings' Star Pieces aren't Fall G1's, a Part 3's
  // "Discounted Carats" or "Daily Free Scout" isn't Part 2's, though they overlap.)
  const relisted = (e: Fragment, f: Fragment) =>
    series(e) === series(f) && (owner(e) === owner(f) || f.kind === 'shop' || e.start === f.start);
  // (A standalone post and a part are one event, unless the post is one window of the part's: its own bar.)
  const joins = (e: Fragment, f: Fragment): boolean => {
    if (e.parent && f.parent) return relisted(e, f);
    if (e.parent) return !windowOf(e, f);
    if (f.parent) return !windowOf(f, e);
    return e.start === f.start || !lang.ownPosts?.test(f.name ?? '');
  };
  for (const f of fragments) {
    const key = sameKey(f);
    const same = byKey.get(key) ?? [];
    const match = findMatch(f, same, joins);
    const twin = match ? undefined : findTwin(f, events, lang);
    if (match) {
      Object.assign(match, merge(match, f, lang));
      alias.set(f.id, match.id);
      merges.push({ from: f.id, into: match.id, how: f.start ? 'overlap' : f.phase === 'ended' ? 'ended' : 'undated' });
    } else if (twin) {
      Object.assign(twin, merge(twin, f, lang), { name: f.name });
      alias.set(f.id, twin.id);
      byKey.set(key, [...same, twin]);
      merges.push({ from: f.id, into: twin.id, how: 'same dates' });
    } else if (f.start) {
      events.push(f);
      byKey.set(key, [...same, f]);
    } else merges.push({ from: f.id, into: '', how: 'dropped' });
  }
  return { events, byKey, alias };
}

// An event announced without dates is the same-named one starting within SAME_EVENT_DAYS after the post (its own
// "starts when posted" bar is dropped), else it stays (announced, not scheduled yet).
export function joinUndated({ events, byKey, alias }: Joined, merges: Merge[], lang: Lexicon): Fragment[] {
  const dropped = new Set<Fragment>();
  for (const f of events.filter((e) => e.undated)) {
    const days = lang.sameEventDays?.(f.kind) ?? SAME_EVENT_DAYS;
    const later = byKey
      .get(sameKey(f))
      ?.find(
        (e) => !e.undated && ms(e.start) >= Date.parse(f.posted) && ms(e.start) - Date.parse(f.posted) <= days * DAY
      );
    if (!later) continue;
    // One event, under the first post's id, with the dated post's dates.
    merges.push({ from: later.id, into: f.id, how: 'undated' });
    Object.assign(later, merge({ ...f, start: null }, later, lang), { id: f.id, start: later.start, end: later.end });
    alias.set(later.id, f.id);
    dropped.add(f);
  }
  return events.filter((e) => !dropped.has(e));
}

export function resolveParents(events: Fragment[], alias: Map<string, string>): void {
  for (const e of events) {
    const parent = e.parent && alias.get(e.parent);
    if (parent) e.parent = parent;
  }
}

// An event spans its parts (a celebration dated from its first section, a 3-day collab, runs as long as its login
// bonus and gifts).
// (lang.notSpanning: parts that don't stretch their event; JP: sales, a pack on sale for a year or more after it.)
export function spanParts(events: Fragment[], lang: Lexicon): void {
  const parts = Map.groupBy(
    events.filter((e) => e.parent && !lang.notSpanning?.(e)),
    (e) => e.parent
  );
  for (const e of events) if (parts.has(e.id)) Object.assign(e, span([e, ...(parts.get(e.id) ?? [])]));
}
