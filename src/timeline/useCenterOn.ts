// Where the calendar is scrolled to: centred on a day after the next render (the first load: the linked entry, else
// today; a zoom; "Today"; an entry opened from another's sheet), or smoothly scrolled to one.
//
// useCenterOn(scroller, timeline, px, linked) → { centerOn, centerOnMiddle, scrollToDay }
//   centerOn(day)      centre on this day after the next render (a day on the calendar: `timeline.at(ms)`)
//   centerOnMiddle()   centre on what's in the middle of the screen now, after the next render (for a zoom: the
//                      pixels per day change under it)
//   scrollToDay(day)   scroll there smoothly, now
// `linked`: the entry to centre on first (the address's), else today.

import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react';
import { type Timeline, spanOf } from './layout.ts';

// The middle of an entry's span (ms).
export const middleOf = (entry: { start: string; end: string | null }): number => {
  const { start, end } = spanOf(entry);
  return (start + end) / 2;
};

export function useCenterOn(
  scroller: RefObject<HTMLElement | null>,
  timeline: Timeline | null,
  px: number,
  linked: { start: string; end: string | null } | null
) {
  // Day to centre on after the next render.
  const target = useRef<number | null>(null);

  // Centred on the linked banner, else today.
  useLayoutEffect(() => {
    if (!timeline || target.current !== null) return;
    target.current = linked ? timeline.at(middleOf(linked)) : timeline.today;
  }, [timeline, linked]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || target.current === null) return;
    el.scrollLeft = target.current * px - el.clientWidth / 2;
    target.current = null;
  });

  const centerOn = useCallback((day: number) => {
    target.current = day;
  }, []);
  const centerOnMiddle = useCallback(() => {
    const el = scroller.current;
    if (el) target.current = (el.scrollLeft + el.clientWidth / 2) / px;
  }, [scroller, px]);
  const scrollToDay = useCallback(
    (day: number) => {
      const el = scroller.current;
      el?.scrollTo({ left: day * px - el.clientWidth / 2, behavior: 'smooth' });
    },
    [scroller, px]
  );
  return { centerOn, centerOnMiddle, scrollToDay };
}
