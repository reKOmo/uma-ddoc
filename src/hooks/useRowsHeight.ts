import { type CSSProperties, type RefObject, useLayoutEffect, useState } from 'react';

// The scroll fade's height (global.css's .scroll-fade).
export const FADE = 56;

// An unfolded list's height for its first `rows` rows, whatever their wrapping (measured once they're shown), as the
// `--rows-height` style to cap it at: with more rows after them, plus the fade, so the last shown stays sharp and the
// next peeks in.
export function useRowsHeight(
  ref: RefObject<HTMLElement | null>,
  unfolded: boolean,
  rows = 6
): CSSProperties | undefined {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const list = ref.current;
    const last = list?.children[rows - 1];
    if (!unfolded || !list || !last) return;
    const fade = list.children.length > rows ? FADE : 0;
    setHeight(
      Math.ceil(last.getBoundingClientRect().bottom - list.getBoundingClientRect().top + list.scrollTop + fade)
    );
  }, [ref, unfolded, rows]);
  // TODO(ts): CSSProperties has no index for custom properties.
  return height ? ({ '--rows-height': `${height}px` } as CSSProperties) : undefined;
}
