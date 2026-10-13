import { type RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import type { Timeline } from './layout.ts';

// Bars are drawn this far past each side of the screen (in screens), and drawn again once the screen comes within
// REDRAW screens of the drawn range's edge: the whole history's bars took most of the Timeline's loading time.
const AHEAD = 1.5;
const REDRAW = 0.5;

export type RenderWindow = { from: number; to: number };

// The time range (ms) whose bars are drawn; null until the calendar is laid out (no bars yet).
// Call it after useCenterOn: its layout effect reads the scroll position the centring sets.
export function useRenderWindow(
  scroller: RefObject<HTMLElement | null>,
  timeline: Timeline | null,
  px: number
): RenderWindow | null {
  const [range, setRange] = useState<RenderWindow | null>(null);
  const measure = useCallback(
    (always: boolean) => {
      const el = scroller.current;
      if (!el || !timeline) return;
      const screen = el.clientWidth / px;
      const left = el.scrollLeft / px;
      const right = left + screen;
      setRange((old) =>
        !always &&
        old &&
        old.from <= timeline.ms(left - screen * REDRAW) &&
        old.to >= timeline.ms(right + screen * REDRAW)
          ? old
          : { from: timeline.ms(left - screen * AHEAD), to: timeline.ms(right + screen * AHEAD) }
      );
    },
    [scroller, timeline, px]
  );
  useLayoutEffect(() => measure(true), [measure]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure(false));
    };
    el.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', later);
      window.removeEventListener('resize', later);
    };
  }, [scroller, measure]);
  return range;
}
