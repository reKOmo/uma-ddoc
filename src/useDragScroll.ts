// @ts-nocheck
import { useEffect } from 'react';

// Lets a mouse pan a scroll container by dragging. Touch and pens are left to
// native scrolling. A press only becomes a drag after moving a few pixels, so
// plain clicks still reach the content; the click that ends a drag is eaten.
const THRESHOLD = 4;

export function useDragScroll(ref, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let start = null;
    let dragged = false;

    function onPointerDown(e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      dragged = false;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < THRESHOLD) return;
      dragged = true;
      el.classList.add('dragging');
      el.scrollLeft = start.left - dx;
      el.scrollTop = start.top - dy;
    }

    function onPointerUp() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.classList.remove('dragging');
      start = null;
    }

    // Runs before the bars' own handlers, so a drag ending on a bar doesn't open it.
    function onClickCapture(e) {
      if (!dragged) return;
      e.stopPropagation();
      e.preventDefault();
      dragged = false;
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      onPointerUp();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, [ref, enabled]);
}
