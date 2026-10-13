import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react';
import { type Timeline, spanOf } from './layout.ts';

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
  const target = useRef<number | null>(null);

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
