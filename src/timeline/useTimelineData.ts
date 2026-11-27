import { useMemo } from 'react';
import { useAsync } from '../hooks/useAsync.ts';
import type { Server } from '../lib/servers.ts';
import type { Language } from '../lib/translations.ts';
import { type Mark, loadTimeline } from './data.ts';
import { buildTimeline } from './layout.ts';

const NO_MARKS: Mark[] = [];

export function useTimelineData(server: Server, language: Language, utc: boolean) {
  const loaded = useAsync(
    () => loadTimeline(server, { language }).then((l) => ({ server, ...l })),
    [server, language]
  ).data;
  // (Right after a server change, until the hook resets, its data is still the old server's.)
  const current = loaded?.server === server ? loaded : null;
  // Loaded after the calendar is drawn; only the sheet's entries get their counterpart (the bars don't show it).
  const loadedOthers = useAsync(async () => current && { of: current, ...(await current.others()) }, [current]).data;
  const others = loadedOthers?.of === current ? loadedOthers : null;
  const marks = others?.marks ?? NO_MARKS;

  const byKey = useMemo(
    () =>
      new Map(
        current?.entries.map((entry) => {
          const counterpart = others?.counterparts.get(String(entry.id));
          return [entry.key, counterpart ? { ...entry, counterpart } : entry];
        })
      ),
    [current, others]
  );
  const timeline = useMemo(() => current && buildTimeline(current.entries, { utc }), [current, utc]);
  return { current, marks, byKey, timeline };
}
