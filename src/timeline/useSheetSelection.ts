import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Server } from '../lib/servers.ts';
import { timelineUrl } from '../routes.ts';
import type { Entry } from './entries.ts';

export function useSheetSelection(
  server: Server,
  entries: Entry[] | null,
  byKey: Map<string, Entry>,
  linkId: string | null | undefined
) {
  // The sheet's entry (its key) and whether it's open: it stays after closing until it has slid away. Another server's
  // calendar ignores it (it was the old one's).
  const [selected, setSelected] = useState<{ server: Server; key: string; open: boolean } | null>(null);
  // (Stable per server, like every callback the calendar gets: it's memoised, see LaneGroup.)
  const show = useCallback((entry: Entry) => setSelected({ server, key: entry.key, open: true }), [server]);

  const linked = useMemo(
    () => (linkId && entries?.find((entry) => String(entry.id) === linkId)) || null,
    [entries, linkId]
  );

  // A link opens its entry once: the address isn't routed again when the sheet closes, so the link would otherwise
  // reopen it after a server switch and back.
  const openedLink = useRef<string | null>(null);
  useEffect(() => {
    if (!linked || openedLink.current === `${server}/${linkId}`) return;
    openedLink.current = `${server}/${linkId}`;
    show(linked);
  }, [linked, server, linkId, show]);

  const entry = selected?.server === server ? byKey.get(selected.key) : undefined;
  const sheetOpen = !!entry && !!selected?.open;
  return {
    linked,
    show,
    entry,
    sheetOpen,
    close: () => setSelected((old) => old && { ...old, open: false }),
    clear: () => setSelected(null),
  };
}

// The address follows the open sheet (replaced, not pushed), so going back from a card reopens it. Apart from
// useSheetSelection because the page calls it last: this effect has always run after the calendar's.
export function useSheetHash(server: Server, entry: Entry | undefined, sheetOpen: boolean) {
  useEffect(() => {
    const hash = sheetOpen && entry ? timelineUrl(server, entry.id) : timelineUrl();
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
  }, [sheetOpen, entry, server]);
}
