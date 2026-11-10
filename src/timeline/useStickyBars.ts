import { type RefObject, useEffect } from 'react';
import styles from './Lanes.module.css';

// How far past the screen's edges a bar still counts as crossing them (in screens): scrolling runs ahead of the main
// thread, so a label turns sticky a little before its bar reaches the edge.
const MARGIN = 0.25;

// Marks the bars crossing the screen's left / right edge (`data-stuck-start` / `data-stuck-end`), whose label / fold
// button alone are sticky (Lanes.module.css). Bars are placed in days (`--x`, `--w`, Lanes.tsx).
export function useStickyBars(scroller: RefObject<HTMLElement | null>, px: number, enabled: boolean): void {
  useEffect(() => {
    const el = scroller.current;
    if (!el || !enabled) return;
    const bars = el.getElementsByClassName(styles.bar ?? '');
    // Read on scroll and resize only: reading them right after React adds bars would force a layout.
    let scrollLeft = el.scrollLeft;
    let width = el.clientWidth;
    const mark = () => {
      const left = scrollLeft / px;
      const right = (scrollLeft + width) / px;
      const margin = (width * MARGIN) / px;
      const crosses = (edge: number, x: number, w: number) => x < edge + margin && x + w > edge - margin;
      for (const bar of bars) {
        if (!(bar instanceof HTMLElement)) continue;
        const x = Number.parseFloat(bar.style.getPropertyValue('--x'));
        const w = Number.parseFloat(bar.style.getPropertyValue('--w'));
        bar.toggleAttribute('data-stuck-start', crosses(left, x, w));
        bar.toggleAttribute('data-stuck-end', crosses(right, x, w));
      }
    };
    mark();
    // New bars (scrolled or zoomed into the drawn range, parts unfolded) are marked before they're painted.
    const observer = new MutationObserver(mark);
    observer.observe(el, { childList: true, subtree: true });
    // Marked in the next frame: writing in the scroll event would make the Timeline's other scroll handlers' reads
    // force a layout.
    let frame = 0;
    const onScroll = () => {
      scrollLeft = el.scrollLeft;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(mark);
    };
    const onResize = () => {
      width = el.clientWidth;
      onScroll();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [scroller, px, enabled]);
}
