import { type CSSProperties, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FoldVertical, Globe, LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SCENARIOS } from '../scenarioRelease.ts';
import { useSettings } from '../settings.tsx';
import { useLanguage } from '../translations.ts';
import { useDragScroll } from '../useDragScroll.ts';
import { type Mark, loadTimeline } from '../timeline/data.ts';
import { useAsync } from '../useAsync.ts';
import { buildTimeline } from '../timeline/layout.ts';
import { scenarioSegments } from '../timeline/scenarioStrip.ts';
import { getCollapsed, saveCollapsed, useCollapsedStore } from '../timeline/collapsed.ts';
import TimelineFilter from '../timeline/TimelineFilter.tsx';
import TimelineSearch from '../timeline/TimelineSearch.tsx';
import TimelineSkeleton from '../timeline/TimelineSkeleton.tsx';
import type { Term } from '../timeline/search.ts';
import { VERDICTS } from '../pullGuide.ts';
import { dateFormats } from '../timeline/format.ts';
import { CalendarLines, TimelineAxis } from '../timeline/TimelineAxis.tsx';
import { LaneGroup } from '../timeline/Lanes.tsx';
import TimelineSheet from '../timeline/TimelineSheet.tsx';
import type { Entry } from '../timeline/entries.ts';
import { endOfToday, middleOf, useCenterOn } from '../timeline/useCenterOn.ts';
import { useCompactRows } from '../timeline/useCompactRows.ts';
import { useRenderWindow } from '../timeline/useRenderWindow.ts';
import { useTimelineFilters } from '../timeline/useTimelineFilters.ts';
import { ToolbarButton } from '../ui/ToolbarButton.tsx';
import { timelineUrl } from '../routes.ts';
import type { Server } from '../servers.ts';
import styles from './TimelinePage.module.css';

const ZOOMS = [4, 8, 16, 32]; // pixels per day
const MARK_ICONS: Record<string, LucideIcon> = { global: Globe };
const NO_MARKS: Mark[] = [];

function toggled<T>(set: Set<T>, key: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}

// The Timeline: a server's banners and events on one calendar, the same for every server (only the data differs).
// Ids are unique per server, banners and events alike. The address follows the open sheet
// (replaced, not pushed), so going back from a card reopens it.
export default function TimelinePage({
  server,
  scenario,
  linkId,
}: {
  server: Server;
  scenario: string;
  linkId?: string | null;
}) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(2);
  // The sheet's entry (its key) and whether it's open: it stays after closing until it has slid away.
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // (Stable, like every callback the calendar gets: it's memoised, see LaneGroup.)
  const show = useCallback((entry: Entry) => {
    setSelected(entry.key);
    setSheetOpen(true);
  }, []);
  const { timeZone, clock } = useSettings().settings;
  const format = useMemo(() => dateFormats(timeZone, clock), [timeZone, clock]);
  const scroller = useRef<HTMLDivElement>(null);

  const language = useLanguage(server);
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
  const timeline = useMemo(
    () => current && buildTimeline(current.entries, { utc: timeZone === 'utc' }),
    [current, timeZone]
  );
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

  const linked = useMemo(
    () => (linkId && current?.entries.find((entry) => String(entry.id) === linkId)) || null,
    [current, linkId]
  );

  // Another server's calendar: the open sheet was the old one's.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on a server change only.
  useEffect(() => {
    setSelected(null);
    setSheetOpen(false);
  }, [server]);

  // A link opens its entry once: the address isn't routed again when the sheet closes, so the link would otherwise
  // reopen it after a server switch and back.
  const openedLink = useRef<string | null>(null);
  useEffect(() => {
    if (!linked || openedLink.current === `${server}/${linkId}`) return;
    openedLink.current = `${server}/${linkId}`;
    setSelected(linked.key);
    setSheetOpen(true);
  }, [linked, server, linkId]);

  const { centerOn, centerOnMiddle, scrollToDay } = useCenterOn(scroller, timeline, px, linked);
  const range = useRenderWindow(scroller, timeline, px);

  function changeZoom(next: number) {
    centerOnMiddle();
    setZoom(next);
  }

  function select(entry: Entry) {
    if (timeline) centerOn(timeline.at(middleOf(entry)));
    show(entry);
  }

  const [unfolded, setUnfolded] = useState<Set<string>>(() => new Set());
  const collapsed = useCollapsedStore((state) => state.collapsed);
  const toggleGroup = useCallback((key: string) => saveCollapsed(toggled(getCollapsed(), key)), []);
  const toggleParts = useCallback((key: string) => setUnfolded((old) => toggled(old, key)), []);
  const at = useCallback((ms: number) => (timeline ? timeline.at(ms) : 0) * px, [timeline, px]);

  // (After the calendar is centred, above: it reads the new scroll position.)
  const { compact, toggleCompact, visible } = useCompactRows(scroller, timeline, groups, px);

  // The search's current match (an index into its matches, in date order): the previous / next buttons step through
  // them, the page scrolling to each (its bar scrolls itself into view, ringed).
  const [cursor, setCursor] = useState(0);
  const matched = filters.search?.matched;
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
    const search = filters.search;
    if (!search || !timeline) return;
    setUnfolded((old) => new Set([...old, ...search.unfold]));
    const index = search.target ? search.matched.indexOf(search.target) : 0;
    setCursor(index);
    if (search.target) scrollToDay(timeline.at(middleOf(search.target)));
  }, [searched, timeline]);

  const entry = selected ? byKey.get(selected) : undefined;

  useEffect(() => {
    const hash = sheetOpen && entry ? timelineUrl(server, entry.id) : timelineUrl();
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
  }, [sheetOpen, entry, server]);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.toolbar}>
          {/* Always open: under the buttons on phones, before them on desktop (CSS order). */}
          <div className={styles.searchSlot}>
            <TimelineSearch terms={filters.terms} chips={chips} onChange={setChips} />
          </div>
          {marks.map((mark) => (
            <ToolbarButton
              key={mark.key}
              icon={MARK_ICONS[mark.key]}
              label={t(`timeline.mark.${mark.key}.button`)}
              title={t(`timeline.mark.${mark.key}.title`)}
              phoneIconOnly
              onClick={() => timeline && scrollToDay(timeline.at(mark.at))}
            />
          ))}
          <TimelineFilter
            kinds={filters.kinds}
            verdicts={filters.verdictsOf ? VERDICTS : []}
            hidden={filters.hidden}
            onChange={filters.changeHidden}
            groups={filters.presentGroups}
            onReorder={filters.reorder}
            onResetOrder={filters.resetOrder}
            defaultOrder={filters.defaultOrder}
            disabled={!timeline}
          />
          <ToolbarButton
            icon={LocateFixed}
            label={t('timeline.today')}
            phoneIconOnly
            onClick={() => timeline && scrollToDay(endOfToday(timeline))}
            disabled={!timeline}
          />
          <ToolbarButton
            icon={FoldVertical}
            label={t('timeline.compact')}
            title={t('timeline.compactTitle')}
            onClick={toggleCompact}
            disabled={!timeline}
            pressed={compact}
            iconOnly
          />
          {/* Not a Segmented: the buttons aren't a choice (no pressed one) and each disables at its own end. */}
          <fieldset className={styles.zoom} aria-label={t('timeline.zoom')}>
            <button
              type="button"
              onClick={() => changeZoom(zoom - 1)}
              disabled={!timeline || zoom === 0}
              aria-label={t('timeline.zoomOut')}
            >
              <ZoomOut size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => changeZoom(zoom + 1)}
              disabled={!timeline || zoom === ZOOMS.length - 1}
              aria-label={t('timeline.zoomIn')}
            >
              <ZoomIn size={18} aria-hidden="true" />
            </button>
          </fieldset>
        </div>
        {filters.search && (
          <p className={styles.searchNote} role="status">
            {filters.search.matched.length > 0 && (
              <span className={styles.matchNav}>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={() => goToMatch(cursor - 1)}
                  disabled={cursor <= 0}
                  aria-label={t('timeline.search.previous')}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                {t('timeline.search.position', {
                  position: Math.min(cursor, filters.search.matched.length - 1) + 1,
                  count: filters.search.matched.length,
                })}
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={() => goToMatch(cursor + 1)}
                  disabled={cursor >= filters.search.matched.length - 1}
                  aria-label={t('timeline.search.next')}
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </span>
            )}
            {!filters.search.matched.length && t('timeline.search.noMatches')}
            {filters.search.hiddenMatches > 0 &&
              ` · ${t('timeline.search.hiddenMatches', { count: filters.search.hiddenMatches })}`}
          </p>
        )}
      </header>

      {!timeline || !current ? (
        <TimelineSkeleton />
      ) : (
        <div className={styles.timeline} ref={scroller}>
          {/* Half a screen of slack at the end, so today can always be centred. */}
          <div
            className={styles.canvas}
            style={{ width: `calc(${timeline.days * px}px + 50vw)`, '--day': `${px}px` } as CSSProperties}
          >
            <TimelineAxis timeline={timeline} scenarios={scenarios} px={px} format={format} />
            <CalendarLines timeline={timeline} scenarios={scenarios} marks={marks} px={px} format={format} />
            {groups.map((group) => (
              <LaneGroup
                key={group.key}
                group={group}
                collapsed={collapsed.has(group.key)}
                visible={compact && visible?.groups === groups ? (visible.rows[group.key] ?? null) : null}
                range={range}
                onToggleGroup={toggleGroup}
                at={at}
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
          onClose={() => setSheetOpen(false)}
          onClosed={() => setSelected(null)}
        />
      )}
    </div>
  );
}
