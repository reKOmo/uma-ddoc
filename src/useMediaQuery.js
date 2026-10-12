import { useSyncExternalStore } from 'react';

// The desktop layout's breakpoint, as the CSS's `@media (min-width: 768px)`.
export const DESKTOP = '(min-width: 768px)';

// Whether a media query matches now, re-rendering when that changes (a window resized across a breakpoint).
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false // no window (a static render): the phone layout, which the CSS starts from
  );
}
