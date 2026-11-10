import { useLayoutEffect, useState } from 'react';
import { DESKTOP, useMediaQuery } from './useMediaQuery.ts';
import styles from './App.module.css';

type Box = { left: number; top: number; width: number; height: number };

// The open tab's pill, one element that slides to the newly opened tab: behind its icon on phones, behind the whole
// tab on desktop (measured from the tab bar; remeasured when the bar resizes).
export default function TabHighlight({ nav, tab }: { nav: HTMLElement | null; tab: string }) {
  const desktop = useMediaQuery(DESKTOP);
  const [box, setBox] = useState<Box | null>(null);
  // No slide into the first place it's put (nor across a layout change): only from tab to tab.
  const [placed, setPlaced] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new tab is what moves it (read from the DOM, not from tab).
  useLayoutEffect(() => {
    const bar = nav;
    if (!bar) return;
    const measure = () => {
      const link = bar.querySelector<HTMLElement>('a[aria-current="page"]');
      const target = desktop ? link : link?.querySelector('svg');
      if (!target) return setBox(null);
      const outer = bar.getBoundingClientRect();
      const inner = target.getBoundingClientRect();
      // (inside the bar's border: an absolute box is placed from its padding edge)
      setBox({
        left: inner.left - outer.left - bar.clientLeft,
        top: inner.top - outer.top - bar.clientTop,
        width: inner.width,
        height: inner.height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [nav, tab, desktop]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a layout change re-places it without a slide.
  useLayoutEffect(() => {
    setPlaced(false);
  }, [desktop]);
  useLayoutEffect(() => {
    if (box && !placed) requestAnimationFrame(() => setPlaced(true));
  }, [box, placed]);

  if (!box) return null;
  return (
    <span
      className={styles.tabHighlight}
      data-placed={placed || undefined}
      aria-hidden="true"
      style={{ width: box.width, height: box.height, translate: `${box.left}px ${box.top}px` }}
    />
  );
}
