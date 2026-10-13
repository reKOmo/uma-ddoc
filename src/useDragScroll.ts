import { type RefObject, useEffect } from 'react';

// A press becomes a drag only after a few pixels, so plain clicks still reach the content; the click that ends a drag
// is eaten. Touch is left to native scrolling.
const THRESHOLD = 4;

export function useDragScroll(ref: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let start: { x: number; y: number; left: number; top: number } | null = null;
    let dragged = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      dragged = false;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!start) return; // set on pointerdown, before this listener is added
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < THRESHOLD) return;
      dragged = true;
      el.dataset.dragging = '';
      el.scrollLeft = start.left - dx;
      el.scrollTop = start.top - dy;
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      delete el.dataset.dragging;
      start = null;
    };

    // Runs before the bars' own handlers, so a drag ending on a bar doesn't open it.
    const onClickCapture = (e: MouseEvent) => {
      if (!dragged) return;
      e.stopPropagation();
      e.preventDefault();
      dragged = false;
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      onPointerUp();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, [ref, enabled]);
}
