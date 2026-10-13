// Compact mode's measuring (the toolbar's fold button): rows with nothing in view (or half a screen either side) fold
// away, so a group is only as tall as what's on screen needs.
//
// useCompactRows(scroller, timeline, groups, px) → { compact, toggleCompact, visible }
//   compact         whether the mode is on (src/timeline/compact.ts, remembered in this browser)
//   visible         { groups, rows: { [group key]: its rows in view } } (LaneGroup's `visible`), worked out when
//                   scrolling stops or the zoom changes, and only replaced when a group's rows change (each LaneGroup
//                   is memoised); null before the first measure. `groups` is what it was worked out for: another
//                   server's (or a reloaded timeline's) isn't used.
//
// Call it after useCenterOn: its layout effect reads the scroll position the centring sets.

import { type RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { getCompact, saveCompact, useCompactStore } from './compact.ts';
import { type LaneGroupRows, type Timeline, visibleRows } from './layout.ts';

// Compact mode looks this far past each side of the screen (in screens), so rows open before their bars scroll in.
// It updates the rows while scrolling slowly (under COMPACT_SLOW screens a second, at most every COMPACT_EVERY ms),
// and else once scrolling has stopped this long (ms): a fast fling doesn't open and fold rows all the way.
const COMPACT_MARGIN = 0.5;
const COMPACT_SLOW = 1;
const COMPACT_EVERY = 100;
const COMPACT_IDLE = 150;

export type VisibleRows = { groups: LaneGroupRows[]; rows: Record<string, string> };

export function useCompactRows(
  scroller: RefObject<HTMLElement | null>,
  timeline: Timeline | null,
  groups: LaneGroupRows[],
  px: number
) {
  const compact = useCompactStore((state) => state.compact);
  const [visible, setVisible] = useState<VisibleRows | null>(null);
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el || !timeline) return;
    const margin = el.clientWidth * COMPACT_MARGIN;
    const from = timeline.ms((el.scrollLeft - margin) / px);
    const to = timeline.ms((el.scrollLeft + el.clientWidth + margin) / px);
    const rows = Object.fromEntries(groups.map((group) => [group.key, visibleRows(group.rows, from, to).join(',')]));
    setVisible((old) =>
      old?.groups === groups && groups.every((group) => old.rows[group.key] === rows[group.key])
        ? old
        : { groups, rows }
    );
  }, [scroller, timeline, groups, px]);
  useLayoutEffect(() => {
    if (compact) measure();
  }, [compact, measure]);
  useEffect(() => {
    const el = scroller.current;
    if (!compact || !el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = { x: el.scrollLeft, at: performance.now() };
    let measured = 0;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, COMPACT_IDLE);
    };
    const onScroll = () => {
      later();
      const now = performance.now();
      const speed = (Math.abs(el.scrollLeft - last.x) / Math.max(now - last.at, 1)) * 1000; // px a second
      last = { x: el.scrollLeft, at: now };
      if (speed < el.clientWidth * COMPACT_SLOW && now - measured >= COMPACT_EVERY) {
        measured = now;
        measure();
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', later);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', later);
    };
  }, [scroller, compact, measure]);
  const toggleCompact = useCallback(() => saveCompact(!getCompact()), []);
  return { compact, toggleCompact, visible };
}
