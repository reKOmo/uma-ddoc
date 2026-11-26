import type { CSSProperties, ReactNode, RefObject } from 'react';
import clsx from 'clsx';
import { WIDE, useMediaQuery } from '../hooks/useMediaQuery.ts';
import FoldToggle from './FoldToggle.tsx';
import styles from './RailList.module.css';

// filled: out or running; ring: dated; dashed: predicted (the line into it dashed too).
export type RailDot = 'filled' | 'ring' | 'dashed';

type RailListProps<T> = {
  ref: RefObject<HTMLOListElement | null>;
  items: T[];
  itemKey: (item: T, i: number) => string;
  dot: (item: T, i: number) => RailDot;
  children: (item: T, i: number) => ReactNode;
  // Folded on a phone: this many rows, the next fading out under the toggle; wide, every row.
  shown: number;
  unfolded: boolean;
  onToggle: () => void;
  // useRowsHeight's cap for the unfolded list (the caller's, so it can wait for it).
  rowsHeight: CSSProperties | undefined;
  moreLabel: string;
  lessLabel: string;
  className?: string;
};

// A timeline list: a dot per row on a rail, a line from each to the next. The toggle sits over the fading row, so the
// caller's box around it is `position: relative`. Rows indent by `calc(var(--rail) * 2)`; the caller's `className` sets
// --dot-y to put the dots on their first line.
export default function RailList<T>({
  ref,
  items,
  itemKey,
  dot,
  children,
  shown,
  unfolded,
  onToggle,
  rowsHeight,
  moreLabel,
  lessLabel,
  className,
}: RailListProps<T>) {
  const fold = !useMediaQuery(WIDE) && items.length > shown;
  const expanded = fold && unfolded;
  const rows = fold && !unfolded ? items.slice(0, shown + 1) : items;
  return (
    <>
      <ol
        ref={ref}
        className={clsx('scroll-fade', styles.list, expanded && styles.expanded, className)}
        style={rowsHeight}
      >
        {rows.map((item, i) => {
          const next = items[i + 1];
          const fading = fold && !unfolded && i === shown;
          return (
            <li
              key={itemKey(item, i)}
              className={clsx(
                styles[dot(item, i)],
                next && styles.hasNext,
                next && dot(next, i + 1) === 'dashed' && styles.nextDashed,
                fading && styles.fading
              )}
              inert={fading || undefined}
            >
              <span className={styles.dot} aria-hidden="true" />
              {children(item, i)}
            </li>
          );
        })}
      </ol>
      {fold && (
        <FoldToggle
          className={clsx(styles.fold, !unfolded && styles.over)}
          expanded={unfolded}
          onToggle={() => {
            // Folding back: the list starts from its top again, not wherever it was scrolled to.
            if (unfolded && ref.current) ref.current.scrollTop = 0;
            onToggle();
          }}
          moreLabel={moreLabel}
          lessLabel={lessLabel}
        />
      )}
    </>
  );
}
