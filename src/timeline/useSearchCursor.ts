import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import type { Timeline } from './layout.ts';
import type { Term } from './search.ts';
import { middleOf } from './useCenterOn.ts';
import type { useTimelineFilters } from './useTimelineFilters.ts';

type Search = ReturnType<typeof useTimelineFilters>['search'];

// The search's current match (an index into its matches, in date order): the previous / next buttons step through
// them, the page scrolling to each (its bar scrolls itself into view, ringed).
export function useSearchCursor(
  search: Search,
  searched: Term[],
  timeline: Timeline | null,
  scrollToDay: (day: number) => void,
  setUnfolded: Dispatch<SetStateAction<Set<string>>>
) {
  const [cursor, setCursor] = useState(0);
  const matched = search?.matched;
  const focused = matched?.[cursor]?.key ?? null;
  const goToMatch = (index: number) => {
    const match = matched?.[index];
    if (!match || !timeline) return;
    setCursor(index);
    scrollToDay(timeline.at(middleOf(match)));
  };
  // A new search unfolds the parents of its matches and goes to its first match ahead (search.ts).
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a new search (or calendar) only, not on filter changes.
  useEffect(() => {
    if (!search || !timeline) return;
    setUnfolded((old) => new Set([...old, ...search.unfold]));
    const index = search.target ? search.matched.indexOf(search.target) : 0;
    setCursor(index);
    if (search.target) scrollToDay(timeline.at(middleOf(search.target)));
  }, [searched, timeline]);
  return { cursor, focused, goToMatch };
}
