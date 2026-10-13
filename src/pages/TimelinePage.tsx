import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FoldVertical, Globe, LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SCENARIOS } from '../scenarioRelease.ts';
import { useSettings } from '../settings.tsx';
import { useDragScroll } from '../useDragScroll.ts';
import { type Mark, loadTimeline } from '../timeline/data.ts';
import { useAsync } from '../useAsync.ts';
import { buildTimeline } from '../timeline/layout.ts';
import { scenarioSegments } from '../timeline/scenarioStrip.ts';
import { getCollapsed, saveCollapsed, useCollapsedStore } from '../timeline/collapsed.ts';
import TimelineFilter from '../timeline/TimelineFilter.tsx';
import { VERDICTS } from '../pullGuide.ts';
import { dateFormats } from '../timeline/format.ts';
import { CalendarLines, TimelineAxis } from '../timeline/TimelineAxis.tsx';
import { LaneGroup } from '../timeline/Lanes.tsx';
import TimelineSheet from '../timeline/TimelineSheet.tsx';
import type { Entry } from '../timeline/entries.ts';
import { middleOf, useCenterOn } from '../timeline/useCenterOn.ts';
import { useCompactRows } from '../timeline/useCompactRows.ts';
import { useRenderWindow } from '../timeline/useRenderWindow.ts';
import { useTimelineFilters } from '../timeline/useTimelineFilters.ts';
import Status from '../ui/Status.tsx';
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
  const { timeZone } = useSettings().settings;
  const format = useMemo(() => dateFormats(timeZone), [timeZone]);
  const scroller = useRef<HTMLDivElement>(null);

  const loaded = useAsync(() => loadTimeline(server).then((l) => ({ server, ...l })), [server]).data;
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
  const filters = useTimelineFilters(current?.entries ?? null);
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

  useEffect(() => {
    if (!linked) return;
    setSelected(linked.key);
    setSheetOpen(true);
  }, [linked]);

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

  const entry = selected ? byKey.get(selected) : undefined;

  useEffect(() => {
    const hash = sheetOpen && entry ? timelineUrl(server, entry.id) : timelineUrl();
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
  }, [sheetOpen, entry, server]);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.toolbar}>
          {marks.map((mark) => (
            <ToolbarButton
              key={mark.key}
              icon={MARK_ICONS[mark.key]}
              label={t(`timeline.mark.${mark.key}.button`)}
              title={t(`timeline.mark.${mark.key}.title`)}
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
            onClick={() => timeline && scrollToDay(timeline.today)}
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
      </header>

      {!timeline || !current ? (
        <Status className={styles.status}>{t('timeline.loading')}</Status>
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
