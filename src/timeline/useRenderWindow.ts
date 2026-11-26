import { useLayoutEffect, useState } from 'react';
import type { Timeline } from './layout.ts';
import { type View, type Viewport, viewRange } from './useViewport.ts';

// Bars are drawn this far past each side of the screen (in screens), and drawn again once the screen comes within
// REDRAW screens of the drawn range's edge: the whole history's bars took most of the Timeline's loading time.
const AHEAD = 0.75;
const REDRAW = 0.25;

export type RenderWindow = { from: number; to: number };

// The time range (ms) whose bars are drawn; null until the calendar is laid out (no bars yet).
export function useRenderWindow(viewport: Viewport, timeline: Timeline | null, px: number): RenderWindow | null {
  const [range, setRange] = useState<RenderWindow | null>(null);
  useLayoutEffect(() => {
    if (!timeline) return;
    // Drawn anew for a new calendar or zoom, then only when the screen nears the drawn range's edge.
    let drawn: RenderWindow | null = null;
    const update = (view: View) => {
      const needed = viewRange(view, timeline, px, REDRAW);
      if (drawn && drawn.from <= needed.from && drawn.to >= needed.to) return;
      drawn = viewRange(view, timeline, px, AHEAD);
      setRange(drawn);
    };
    const view = viewport.read();
    if (view) update(view);
    return viewport.subscribe(update);
  }, [viewport, timeline, px]);
  return range;
}
