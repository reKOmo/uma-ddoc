// What the Timeline's filter and its Order tab decide: which entries leave the lanes, and in what order the lane groups
// stand.
//
// useTimelineFilters(entries) → { hidden, changeHidden, kinds, presentGroups, laneOrder, defaultOrder, verdictsOf,
//   reorder, resetOrder, groups }
//   hidden          banner sections and event kinds hidden by the filter ('pull:<verdict>' too), remembered in this
//                   browser; changeHidden(update) with `update(old)` → the new Set (from the latest one: quick taps
//                   don't undo each other). Hidden entries leave the lanes (a hidden event's parts of shown kinds stand
//                   on their own); the calendar's dates and the sheets still have everything.
//   laneOrder       the lane groups in the viewer's order (the filter's Order tab); reorder(from, to) with indexes among
//                   `presentGroups`, resetOrder(), defaultOrder: whether the order is the default
//   kinds           the kinds this calendar has, and presentGroups its groups, in that order
//   verdictsOf      support card banners by their cards' pull advice (src/pullGuide.ts; optional): a function when the
//                   guide covers any of this calendar's banners (Global's), else null; a banner stays while one of its
//                   cards has a verdict not hidden
//   groups          the lane groups to draw: laneGroups() of what isn't hidden

import { useCallback, useMemo } from 'react';
import { type Verdict, bannerVerdicts, loadPullGuide } from '../pullGuide.ts';
import { useAsync } from '../useAsync.ts';
import type { Entry } from './entries.ts';
import { getHidden, saveHidden, useHiddenStore } from './hidden.ts';
import { type LaneGroupRows, laneGroups } from './layout.ts';
import { DEFAULT_ORDER, isDefaultOrder, orderedGroups, reorderGroups, saveOrder, useOrderStore } from './order.ts';
import { pullKey } from './TimelineFilter.tsx';

export function useTimelineFilters(entries: Entry[] | null) {
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
  const groups = useMemo((): LaneGroupRows<Entry>[] => {
    if (!entries) return [];
    const pullShown = (entry: Entry) =>
      entry.group !== 'cards' || !verdictsOf || [...verdictsOf(entry)].some((v) => !hidden.has(pullKey(v)));
    return laneGroups(
      entries.filter((e) => !hidden.has(e.kind) && pullShown(e)),
      laneOrder
    );
  }, [entries, hidden, verdictsOf, laneOrder]);
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
  };
}
