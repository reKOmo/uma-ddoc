import { useEffect } from 'react';
import styles from './Lanes.module.css';
import type { View, Viewport } from './useViewport.ts';

// How far past the screen's edges a bar still counts as crossing them (in screens): scrolling runs ahead of the main
// thread, so a label turns sticky a little before its bar reaches the edge.
const MARGIN = 0.25;

// Marks the bars crossing the screen's left / right edge (`data-stuck-start` / `data-stuck-end`), whose label / fold
// button alone are sticky (Lanes.module.css). Bars are placed in days (`--x`, `--w`, Lanes.tsx).
export function useStickyBars(viewport: Viewport, px: number, enabled: boolean): void {
  useEffect(() => {
    const el = viewport.scroller.current;
    const view = viewport.read();
    if (!el || !view || !enabled) return;
    // The screen's edges, in days.
    const edgesOf = ({ left, width }: View) => ({
      left: left / px,
      right: (left + width) / px,
      margin: (width * MARGIN) / px,
    });
    let { left, right, margin } = edgesOf(view);
    const barClass = styles.bar ?? '';
    const bars = el.getElementsByClassName(barClass);
    const mark = (bar: Element) => {
      if (!(bar instanceof HTMLElement)) return;
      const x = Number.parseFloat(bar.style.getPropertyValue('--x'));
      const w = Number.parseFloat(bar.style.getPropertyValue('--w'));
      bar.toggleAttribute('data-stuck-start', x < left + margin && x + w > left - margin);
      bar.toggleAttribute('data-stuck-end', x < right + margin && x + w > right - margin);
    };
    const markAll = () => {
      for (const bar of bars) mark(bar);
    };
    markAll();
    // New bars (scrolled or zoomed into the drawn range, parts unfolded) are marked before they're painted, with the
    // last view: reading the scroller right after React adds bars would force a layout.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.classList.contains(barClass)) mark(node);
          for (const bar of node.getElementsByClassName(barClass)) mark(bar);
        }
      }
    });
    observer.observe(el, { childList: true, subtree: true });
    const unsubscribe = viewport.subscribe((next) => {
      ({ left, right, margin } = edgesOf(next));
      markAll();
    });
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [viewport, px, enabled]);
}
