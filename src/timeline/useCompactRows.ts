import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { getCompact, saveCompact, useCompact } from './compact.ts';
import { type LaneGroupRows, type Timeline, visibleRows } from './layout.ts';
import { type View, type Viewport, viewRange } from './useViewport.ts';

// Compact mode looks this far past each side of the screen (in screens), so rows open before their bars scroll in.
// It updates the rows while scrolling slowly (under COMPACT_SLOW screens a second, at most every COMPACT_EVERY ms),
// and else once scrolling has stopped this long (ms): a fast fling doesn't open and fold rows all the way.
const COMPACT_MARGIN = 0.5;
const COMPACT_SLOW = 1;
const COMPACT_EVERY = 100;
const COMPACT_IDLE = 150;

type VisibleRows = { groups: LaneGroupRows[]; rows: Record<string, string> };

export function useCompactRows(viewport: Viewport, timeline: Timeline | null, groups: LaneGroupRows[], px: number) {
  const compact = useCompact();
  const [visible, setVisible] = useState<VisibleRows | null>(null);
  // What `visible` was last set to: compared without a state update, so scrolling renders only when a row changes.
  const shown = useRef<VisibleRows | null>(null);
  useLayoutEffect(() => {
    if (!compact || !timeline) return;
    const measure = (view: View) => {
      const { from, to } = viewRange(view, timeline, px, COMPACT_MARGIN);
      const rows = Object.fromEntries(groups.map((group) => [group.key, visibleRows(group.rows, from, to).join(',')]));
      const old = shown.current;
      if (old?.groups === groups && groups.every((group) => old.rows[group.key] === rows[group.key])) return;
      shown.current = { groups, rows };
      setVisible(shown.current);
    };
    const first = viewport.read();
    if (!first) return;
    measure(first);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = { x: first.left, at: performance.now() };
    let measured = 0;
    const unsubscribe = viewport.subscribe((view) => {
      clearTimeout(timer);
      timer = setTimeout(() => measure(view), COMPACT_IDLE);
      const now = performance.now();
      const speed = (Math.abs(view.left - last.x) / Math.max(now - last.at, 1)) * 1000;
      last = { x: view.left, at: now };
      if (speed < view.width * COMPACT_SLOW && now - measured >= COMPACT_EVERY) {
        measured = now;
        measure(view);
      }
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [viewport, compact, timeline, groups, px]);
  const toggleCompact = useCallback(() => saveCompact(!getCompact()), []);
  return { compact, toggleCompact, visible };
}
