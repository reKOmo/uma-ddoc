import { type CSSProperties, type RefObject, useEffect, useRef } from 'react';
import { FADE } from '../../../hooks/useRowsHeight.ts';
import type { HistoryPoint } from '../../../lib/rankHistory.ts';

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

// The nearest ancestor that scrolls vertically.
function scrollParent(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}

type ScrollToPickedOptions = {
  list: RefObject<HTMLOListElement | null>;
  picked: { date: string; n: number } | null | undefined;
  passes: HistoryPoint[];
  shownCount: number;
  cardId: number;
  setUnfolded: (cardId: number) => void;
  showAll: boolean;
  expanded: boolean;
  rowsHeight: CSSProperties | undefined;
  keepInView: RefObject<HTMLElement | null> | undefined;
};

// A date picked on the chart: its row scrolled to and flashed, unfolding the list first when it's folded away.
export function useScrollToPicked({
  list,
  picked,
  passes,
  shownCount,
  cardId,
  setUnfolded,
  showAll,
  expanded,
  rowsHeight,
  keepInView,
}: ScrollToPickedOptions): void {
  // The pick already scrolled to, so folding the list again afterwards doesn't unfold it for the same pick.
  const handled = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: list and setUnfolded are stable (a ref, a state setter).
  useEffect(() => {
    if (!picked || handled.current === picked.n) return;
    if (passes.findIndex((p) => p.date === picked.date) >= shownCount) {
      setUnfolded(cardId); // runs again once the row is there
      return;
    }
    // Unfolded, not until its height is measured: the page is only as tall as it'll be then, to scroll that far.
    if (expanded && !rowsHeight) return;
    handled.current = picked.n;
    const row = list.current?.querySelector(`[data-date="${picked.date}"]`);
    if (!row) return;
    // The list's own scroll area (desktop's around it beside the chart, a phone's unfolded list): the row to its top.
    let rowTop = row.getBoundingClientRect().top;
    const inner = showAll ? scrollParent(row) : expanded ? list.current : null;
    if (inner) {
      const target = clamp(
        inner.scrollTop + rowTop - inner.getBoundingClientRect().top - FADE,
        0,
        inner.scrollHeight - inner.clientHeight
      );
      rowTop -= target - inner.scrollTop;
      inner.scrollTo({ top: target, behavior: 'smooth' });
    }
    // A phone's page too: the row up to the top, but no further than keeps the chart in view.
    const page = !showAll && list.current ? scrollParent(list.current) : null;
    if (page) {
      const pageTop = page.getBoundingClientRect().top;
      const keep = keepInView?.current?.getBoundingClientRect().top;
      const by = Math.min(rowTop - pageTop - FADE, keep === undefined ? Number.POSITIVE_INFINITY : keep - pageTop - 8);
      page.scrollBy({ top: by, behavior: 'smooth' });
    }
    row.animate(
      [{ backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)' }, { backgroundColor: 'transparent' }],
      { duration: 1800, easing: 'ease-in' }
    );
  }, [picked, shownCount, passes, cardId, showAll, expanded, rowsHeight, keepInView]);
}
