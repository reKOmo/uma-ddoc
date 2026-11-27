import { type RefObject, useLayoutEffect, useRef } from 'react';

// Zooming keeps the view's middle where it was; the first zoom in from the whole life centres on `todayAt` (today's
// place across the plot, 0–1; null when today isn't on it). Returns the scroller's onScroll, which tracks the middle.
export function useZoomCenter(
  scroller: RefObject<HTMLDivElement | null>,
  zoom: number,
  todayAt: number | null
): () => void {
  const center = useRef(0.5);
  const prevZoom = useRef(zoom);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a zoom change is the trigger; the rest is read as it is then.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || prevZoom.current === zoom) return;
    if (prevZoom.current === 1 && todayAt !== null) center.current = todayAt;
    prevZoom.current = zoom;
    el.scrollLeft = center.current * el.scrollWidth - el.clientWidth / 2;
  }, [zoom]);
  return () => {
    const el = scroller.current;
    if (el) center.current = (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth;
  };
}
