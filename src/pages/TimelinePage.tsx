import { type CSSProperties, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { SCENARIOS } from '../../shared/scenarioRelease.ts';
import { useSettings } from '../state/settings.ts';
import { useLanguage } from '../lib/translations.ts';
import { useDragScroll } from '../hooks/useDragScroll.ts';
import { ZOOMS } from '../timeline/layout.ts';
import { scenarioSegments } from '../lib/scenarioStrip.ts';
import { getCollapsed, saveCollapsed, useCollapsed } from '../timeline/collapsed.ts';
import TimelineSkeleton from '../timeline/TimelineSkeleton.tsx';
import type { Term } from '../timeline/search.ts';
import { useDateFormats } from '../lib/dates.ts';
import { CalendarLines, TimelineAxis } from '../timeline/TimelineAxis.tsx';
import { LaneGroup } from '../timeline/Lanes.tsx';
import TimelineSheet from '../timeline/TimelineSheet.tsx';
import type { Entry } from '../timeline/entries.ts';
import { middleOf } from '../timeline/useCenterOn.ts';
import { useCompactRows } from '../timeline/useCompactRows.ts';
import { useRenderWindow } from '../timeline/useRenderWindow.ts';
import { useStickyBars } from '../timeline/useStickyBars.ts';
import { useViewport } from '../timeline/useViewport.ts';
import { toggled } from '../timeline/sets.ts';
import { useTimelineFilters } from '../timeline/useTimelineFilters.ts';
import { useTimelineData } from '../timeline/useTimelineData.ts';
import { useSheetHash, useSheetSelection } from '../timeline/useSheetSelection.ts';
import { useSearchCursor } from '../timeline/useSearchCursor.ts';
import TimelineToolbar from '../timeline/toolbar/TimelineToolbar.tsx';
import SearchStatus from '../timeline/toolbar/SearchStatus.tsx';
import type { Server } from '../lib/servers.ts';
import styles from './TimelinePage.module.css';

// The Timeline: a server's banners and events on one calendar, the same for every server (only the data differs).
// Ids are unique per server, banners and events alike. The address follows the open sheet
// (replaced, not pushed), so going back from a card reopens it.
// The hooks' order is their effects' order: the link opens its sheet before the calendar centres, the address
// follows the sheet last.
export default function TimelinePage({
  server,
  scenario,
  linkId,
}: {
  server: Server;
  scenario: string;
  linkId?: string | null;
}) {
  const [zoom, setZoom] = useState(2);
  const { timeZone } = useSettings().settings;
  const format = useDateFormats();
  const scroller = useRef<HTMLDivElement>(null);

  const language = useLanguage(server);
  const { current, marks, byKey, timeline } = useTimelineData(server, language, timeZone === 'utc');
  // The search's chips: kept for this visit only (also across a server switch: characters and kinds are the same).
  const [chips, setChips] = useState<Term[]>([]);
  // The calendar follows the chips a moment later: the search field shows a removed (or added) chip at once, the
  // lanes' refiltering renders after it.
  const searched = useDeferredValue(chips);
  const filters = useTimelineFilters(current?.entries ?? null, searched, language);
  const { groups } = filters;
  const scenarios = useMemo(() => scenarioSegments(SCENARIOS, server), [server]);
  const px = ZOOMS[zoom] ?? 1;
  // The scroller only exists once the timeline has loaded.
  useDragScroll(scroller, !!timeline);

  const sheet = useSheetSelection(server, current?.entries ?? null, byKey, linkId);
  const { entry, sheetOpen, show } = sheet;

  const { viewport, centerOn, centerOnMiddle, scrollToDay } = useViewport(scroller, timeline, px, sheet.linked);
  const range = useRenderWindow(viewport, timeline, px);
  useStickyBars(viewport, px, !!timeline);

  function changeZoom(next: number) {
    centerOnMiddle();
    setZoom(next);
  }

  function select(entry: Entry) {
    if (timeline) centerOn(timeline.at(middleOf(entry)));
    show(entry);
  }

  const [unfolded, setUnfolded] = useState<Set<string>>(() => new Set());
  const collapsed = useCollapsed();
  const toggleGroup = useCallback((key: string) => saveCollapsed(toggled(getCollapsed(), key)), []);
  const toggleParts = useCallback((key: string) => setUnfolded((old) => toggled(old, key)), []);

  const { compact, toggleCompact, visible } = useCompactRows(viewport, timeline, groups, px);

  const { cursor, focused, goToMatch } = useSearchCursor(filters.search, searched, timeline, scrollToDay, setUnfolded);

  useSheetHash(server, entry, sheetOpen);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <TimelineToolbar
          filters={filters}
          chips={chips}
          onChips={setChips}
          marks={marks}
          timeline={timeline}
          scrollToDay={scrollToDay}
          compact={compact}
          onToggleCompact={toggleCompact}
          zoom={zoom}
          onZoom={changeZoom}
        />
        {filters.search && <SearchStatus search={filters.search} cursor={cursor} onGoTo={goToMatch} />}
      </header>

      {!timeline || !current ? (
        <TimelineSkeleton />
      ) : (
        <div className={styles.timeline} ref={scroller}>
          {/* Half a screen of slack at the end, so today can always be centred. */}
          <div
            className={styles.canvas}
            data-zoom={zoom}
            style={{ width: `calc(${timeline.days * px}px + 50vw)`, '--day': `${px}px` } as CSSProperties}
          >
            <TimelineAxis timeline={timeline} scenarios={scenarios} px={px} format={format} range={range} />
            <CalendarLines timeline={timeline} scenarios={scenarios} marks={marks} px={px} format={format} />
            {groups.map((group) => (
              <LaneGroup
                key={group.key}
                group={group}
                collapsed={collapsed.has(group.key)}
                visible={compact && visible?.groups === groups ? (visible.rows[group.key] ?? null) : null}
                range={range}
                onToggleGroup={toggleGroup}
                day={timeline.at}
                format={format}
                unfolded={unfolded}
                focused={focused}
                onToggleParts={toggleParts}
                onSelect={show}
              />
            ))}
          </div>
        </div>
      )}

      {entry && (
        <TimelineSheet
          entry={entry}
          lookup={(key: string) => byKey.get(key)}
          server={server}
          scenario={scenario}
          format={format}
          onSelect={select}
          open={sheetOpen}
          onClose={sheet.close}
          onClosed={sheet.clear}
        />
      )}
    </div>
  );
}
