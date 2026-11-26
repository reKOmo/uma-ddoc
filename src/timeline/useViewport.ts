import { type RefObject, useEffect, useState } from 'react';
import { createStore } from 'zustand/vanilla';
import type { Timeline } from './layout.ts';
import { useCenterOn } from './useCenterOn.ts';

// The calendar's visible part of the scroller, in px.
export type View = { left: number; width: number };

export type Viewport = {
  scroller: RefObject<HTMLElement | null>;
  // Reads the scroller now (in a layout effect: after the centring has moved it); null without one.
  read: () => View | null;
  // Called once per frame while it scrolls or the window resizes, all listeners with the same view: reading it once
  // before any of them writes keeps the frame from forcing a layout.
  subscribe: (listener: (view: View) => void) => () => void;
};

// The time range (ms) from `margin` screens before the view to as far past it.
export function viewRange(view: View, timeline: Timeline, px: number, margin: number) {
  const pad = view.width * margin;
  return { from: timeline.ms((view.left - pad) / px), to: timeline.ms((view.left + view.width + pad) / px) };
}

// The scroller's position: it centres it (useCenterOn), then publishes what's in view to the hooks derived from it
// (useRenderWindow, useStickyBars, useCompactRows). They take the viewport, so they come after the centring and their
// layout effects read the position it sets.
export function useViewport(
  scroller: RefObject<HTMLElement | null>,
  timeline: Timeline | null,
  px: number,
  linked: { start: string; end: string | null } | null
) {
  const centring = useCenterOn(scroller, timeline, px, linked);
  const [{ store, viewport }] = useState(() => {
    const store = createStore<View>(() => ({ left: 0, width: 0 }));
    const read = (): View | null => {
      const el = scroller.current;
      return el && { left: el.scrollLeft, width: el.clientWidth };
    };
    const viewport: Viewport = {
      scroller,
      read,
      subscribe: store.subscribe,
    };
    return { store, viewport };
  });
  // The scroller only exists while the calendar is drawn.
  const drawn = !!timeline;
  useEffect(() => {
    const el = scroller.current;
    if (!drawn || !el) return;
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => store.setState({ left: el.scrollLeft, width: el.clientWidth }));
    };
    el.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', later);
      window.removeEventListener('resize', later);
    };
  }, [scroller, drawn, store]);
  return { viewport, ...centring };
}
