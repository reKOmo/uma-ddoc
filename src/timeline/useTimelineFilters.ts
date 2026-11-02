// Hidden entries leave the lanes (a hidden event's parts of shown kinds stand on their own); the dates and sheets keep
// everything. A support card banner stays while one of its cards has a shown pull verdict. A search keeps only its
// results (search.ts), matches the filter hides included unless the filter says otherwise.
import { useCallback, useMemo } from 'react';
import { cards } from '../../tierlist/cards.ts';
import { type Verdict, bannerVerdicts, loadPullGuide } from '../pullGuide.ts';
import { useAsync } from '../useAsync.ts';
import type { Entry } from './entries.ts';
import { getHidden, saveHidden, useHiddenStore } from './hidden.ts';
import { type LaneGroupRows, laneGroups } from './layout.ts';
import { DEFAULT_ORDER, isDefaultOrder, orderedGroups, reorderGroups, saveOrder, useOrderStore } from './order.ts';
import { type Term, jumpTarget, searchIndex, searchResults } from './search.ts';
import { useSearchOverrideStore } from './searchOverride.ts';
import { pullKey } from './TimelineFilter.tsx';

const NONE = new Set<string>();
const NO_GROUPS: LaneGroupRows<Entry>[] = [];

export function useTimelineFilters(entries: Entry[] | null, chips: Term[]) {
  const hidden = useHiddenStore((state) => state.hidden);
  const changeHidden = useCallback((update: (old: Set<string>) => Set<string>) => saveHidden(update(getHidden())), []);
  const order = useOrderStore((state) => state.order);
  const laneOrder = useMemo(() => orderedGroups(order), [order]);
  const present = useMemo(() => new Set(entries?.map((e) => e.kind)), [entries]);
  const kinds = useMemo(
    () => laneOrder.flatMap((group) => group.kinds).filter((kind) => present.has(kind as Entry['kind'])),
    [laneOrder, present]
  );
  const presentGroups = useMemo(
    () => laneOrder.filter((group) => group.kinds.some((kind) => present.has(kind as Entry['kind']))),
    [laneOrder, present]
  );
  const guide = useAsync(loadPullGuide, []).data ?? null;
  const verdictsOf = useMemo(() => {
    if (!guide || !entries?.some((e) => e.group === 'cards' && guide.banners[e.id])) return null;
    return (entry: Entry): Set<Verdict> =>
      bannerVerdicts(
        guide,
        entry.id,
        entry.featured.flatMap((item) => (item.card && item.id != null ? [Number(item.id)] : []))
      );
  }, [guide, entries]);
  const index = useMemo(() => entries && searchIndex(entries, cards, verdictsOf), [entries, verdictsOf]);
  const override = useSearchOverrideStore((state) => state.override);
  const { groups, search } = useMemo(() => {
    if (!entries || !index) return { groups: NO_GROUPS, search: null };
    const pullShown = (entry: Entry) =>
      entry.group !== 'cards' || !verdictsOf || [...verdictsOf(entry)].some((v) => !hidden.has(pullKey(v)));
    const filtered = (e: Entry) => !hidden.has(e.kind) && pullShown(e);
    const results = chips.length ? searchResults(entries, chips, index) : null;
    const shown = (e: Entry) => (!results || results.shown.has(e.key)) && ((results && override) || filtered(e));
    // In date order: the search's previous / next buttons step through them.
    const matched = (results?.matched.filter((e) => e.start && shown(e)) ?? []).toSorted(
      (a, b) => Date.parse(a.start) - Date.parse(b.start)
    );
    return {
      groups: laneGroups(entries.filter(shown), laneOrder),
      search: results && {
        matched,
        hiddenMatches: results.matched.length - matched.length,
        unfold: results.unfold,
        target: jumpTarget(matched),
      },
    };
  }, [entries, index, chips, override, hidden, verdictsOf, laneOrder]);
  const reorder = (from: number, to: number) =>
    saveOrder(
      reorderGroups(
        laneOrder.map((group) => group.key),
        presentGroups.map((group) => group.key),
        from,
        to
      )
    );
  const resetOrder = () => saveOrder(DEFAULT_ORDER);
  const defaultOrder = isDefaultOrder(laneOrder.map((group) => group.key));
  return {
    hidden,
    changeHidden,
    kinds,
    presentGroups,
    laneOrder,
    defaultOrder,
    verdictsOf,
    reorder,
    resetOrder,
    groups,
    terms: index?.terms ?? [],
    search,
    unfold: search?.unfold ?? NONE,
  };
}
