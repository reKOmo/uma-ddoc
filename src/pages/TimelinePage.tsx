// @ts-nocheck
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FoldVertical, Globe, LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import scenarioData from '../../data/scenarios.json' with { type: 'json' };
import { useSettings } from '../settings.tsx';
import { useDragScroll } from '../useDragScroll.ts';
import { loadTimeline } from '../timeline/data.ts';
import { useAsync } from '../useAsync.ts';
import { buildTimeline, laneGroups, spanOf, visibleRows } from '../timeline/layout.ts';
import {
  DEFAULT_ORDER,
  isDefaultOrder,
  orderedGroups,
  reorderGroups,
  saveOrder,
  useOrderStore,
} from '../timeline/order.ts';
import { scenarioSegments } from '../timeline/scenarioStrip.ts';
import { getCollapsed, saveCollapsed, useCollapsedStore } from '../timeline/collapsed.ts';
import { getCompact, saveCompact, useCompactStore } from '../timeline/compact.ts';
import { getHidden, saveHidden, useHiddenStore } from '../timeline/hidden.ts';
import TimelineFilter, { pullKey } from '../timeline/TimelineFilter.tsx';
import { VERDICTS, bannerVerdicts, loadPullGuide } from '../pullGuide.ts';
import { dateFormats } from '../timeline/format.ts';
import { CalendarLines, TimelineAxis } from '../timeline/TimelineAxis.tsx';
import { LaneGroup } from '../timeline/Lanes.tsx';
import TimelineSheet from '../timeline/TimelineSheet.tsx';
import '../timeline/timeline.css';

const ZOOMS = [4, 8, 16, 32]; // pixels per day
// A mark's toolbar button icon (marks: loadTimeline() in src/timeline/data.js).
const MARK_ICONS = { global: Globe };
// Compact mode looks this far past each side of the screen (in screens), so rows open before their bars scroll in.
// It updates the rows while scrolling slowly (under COMPACT_SLOW screens a second, at most every COMPACT_EVERY ms),
// and else once scrolling has stopped this long (ms): a fast fling doesn't open and fold rows all the way.
const COMPACT_MARGIN = 0.5;
const COMPACT_SLOW = 1;
const COMPACT_EVERY = 100;
const COMPACT_IDLE = 150;

// A copy of a set with `key` added, or removed if it was in it.
function toggled(set, key) {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}

// The middle of an entry's span (ms).
const middleOf = (entry) => {
  const { start, end } = spanOf(entry);
  return (start + end) / 2;
};

// The Timeline: a server's banners and events on one calendar, the same for every server (only the data differs).
// `linkId` (from #/timeline/<server>/<id>): a banner or event to open and centre on once loaded (ids are unique on a
// server, banners' and events' alike).
// While a sheet is open, the address says which (replaced, not pushed: no history entry per sheet), so coming back
// here (from a card's page) opens it again.
export default function TimelinePage({ server, scenario, linkId }) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(2);
  // The sheet's entry (its key) and whether it's open: it stays after closing until it has slid away.
  const [selected, setSelected] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // (Stable, like every callback the calendar gets: it's memoised, see LaneGroup.)
  const show = useCallback((entry) => {
    setSelected(entry.key);
    setSheetOpen(true);
  }, []);
  const { timeZone } = useSettings().settings;
  const format = useMemo(() => dateFormats(timeZone), [timeZone]);
  const scroller = useRef(null);
  // Day to centre on after the next render (initial load, zoom, "Today", an entry opened from another's sheet).
  const centerOn = useRef(null);

  const loaded = useAsync(() => loadTimeline(server).then((l) => ({ server, ...l })), [server]).data;
  // (Right after a server change, until the hook resets, its data is still the old server's.)
  const current = loaded?.server === server ? loaded : null;

  const byKey = useMemo(() => new Map(current?.entries.map((entry) => [entry.key, entry])), [current]);
  const timeline = useMemo(
    () => current && buildTimeline(current.entries, { utc: timeZone === 'utc' }),
    [current, timeZone]
  );
  // Banner sections and event kinds hidden by the filter, remembered in this browser. Hidden entries leave the lanes (a hidden event's
  // parts of shown kinds stand on their own); the calendar's dates and the sheets still have everything.
  const hidden = useHiddenStore((state) => state.hidden);
  // `update(old)` → the new Set (from the latest one: quick taps don't undo each other).
  const changeHidden = useCallback((update) => saveHidden(update(getHidden())), []);
  // The lane groups' order (the filter's Order tab), remembered in this browser.
  const order = useOrderStore((state) => state.order);
  const changeOrder = saveOrder;
  const laneOrder = useMemo(() => orderedGroups(order), [order]);
  // The kinds this calendar has, and its groups, in that order.
  const present = useMemo(() => new Set(current?.entries.map((e) => e.kind)), [current]);
  const kinds = useMemo(
    () => laneOrder.flatMap((group) => group.kinds).filter((kind) => present.has(kind)),
    [laneOrder, present]
  );
  const presentGroups = useMemo(
    () => laneOrder.filter((group) => group.kinds.some((kind) => present.has(kind))),
    [laneOrder, present]
  );
  // Support card banners by their cards' pull advice (src/pullGuide.js; optional): offered when the guide covers any
  // of this calendar's banners (Global's), and a banner stays while one of its cards has a verdict not hidden
  // ('pull:<verdict>' in `hidden`).
  const guide = useAsync(loadPullGuide, []).data ?? null;
  const verdictsOf = useMemo(() => {
    if (!guide || !current?.entries.some((e) => e.group === 'cards' && guide.banners[e.id])) return null;
    return (entry) =>
      bannerVerdicts(
        guide,
        entry.id,
        entry.featured.filter((item) => item.card && item.id != null).map((item) => item.id)
      );
  }, [guide, current]);
  const groups = useMemo(() => {
    if (!current) return [];
    const pullShown = (entry) =>
      entry.group !== 'cards' || !verdictsOf || [...verdictsOf(entry)].some((v) => !hidden.has(pullKey(v)));
    return laneGroups(
      current.entries.filter((e) => !hidden.has(e.kind) && pullShown(e)),
      laneOrder
    );
  }, [current, hidden, verdictsOf, laneOrder]);
  const scenarios = useMemo(() => scenarioSegments(scenarioData.scenarios, server), [server]);
  const px = ZOOMS[zoom];
  // The scroller only exists once the timeline has loaded.
  useDragScroll(scroller, !!timeline);

  const linked = useMemo(
    () => (linkId && current?.entries.find((entry) => String(entry.id) === linkId)) ?? null,
    [current, linkId]
  );

  // Another server's calendar: the open sheet was the old one's.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on a server change only.
  useEffect(() => {
    setSelected(null);
    setSheetOpen(false);
  }, [server]);

  // Centred on the linked banner, else today.
  useLayoutEffect(() => {
    if (!timeline || centerOn.current !== null) return;
    centerOn.current = linked ? timeline.at(middleOf(linked)) : timeline.today;
  }, [timeline, linked]);

  // A linked banner opens its sheet.
  useEffect(() => {
    if (!linked) return;
    setSelected(linked.key);
    setSheetOpen(true);
  }, [linked]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || centerOn.current === null) return;
    el.scrollLeft = centerOn.current * px - el.clientWidth / 2;
    centerOn.current = null;
  });

  function changeZoom(next) {
    const el = scroller.current;
    centerOn.current = (el.scrollLeft + el.clientWidth / 2) / px;
    setZoom(next);
  }

  function scrollToDay(day) {
    const el = scroller.current;
    el.scrollTo({ left: day * px - el.clientWidth / 2, behavior: 'smooth' });
  }

  // Opening another entry from a sheet (a re-run, a part) centres the calendar on it.
  function select(entry) {
    centerOn.current = timeline.at(middleOf(entry));
    show(entry);
  }

  const [unfolded, setUnfolded] = useState(() => new Set());
  // Groups folded away by their label, remembered in this browser.
  const collapsed = useCollapsedStore((state) => state.collapsed);
  const toggleGroup = useCallback((key) => saveCollapsed(toggled(getCollapsed(), key)), []);
  const toggleParts = useCallback((key) => setUnfolded((old) => toggled(old, key)), []);
  const at = useCallback((ms) => timeline.at(ms) * px, [timeline, px]);

  // Compact mode: rows with nothing in view (or half a screen either side) fold away, so a group is only as tall as
  // what's on screen needs. `visible`: { groups, rows: { [group key]: its rows in view } } (LaneGroup's `visible`),
  // worked out when scrolling stops or the zoom changes, and only replaced when a group's rows change (each LaneGroup
  // is memoised). `groups` is what it was worked out for: another server's (or a reloaded timeline's) isn't used.
  const compact = useCompactStore((state) => state.compact);
  const [visible, setVisible] = useState(null);
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el || !timeline) return;
    const margin = el.clientWidth * COMPACT_MARGIN;
    const from = timeline.ms((el.scrollLeft - margin) / px);
    const to = timeline.ms((el.scrollLeft + el.clientWidth + margin) / px);
    const rows = Object.fromEntries(groups.map((group) => [group.key, visibleRows(group.rows, from, to).join(',')]));
    setVisible((old) =>
      old?.groups === groups && groups.every((group) => old.rows[group.key] === rows[group.key])
        ? old
        : { groups, rows }
    );
  }, [timeline, groups, px]);
  // (After the calendar is centred, above: it reads the new scroll position.)
  useLayoutEffect(() => {
    if (compact) measure();
  }, [compact, measure]);
  useEffect(() => {
    const el = scroller.current;
    if (!compact || !el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = { x: el.scrollLeft, at: performance.now() };
    let measured = 0;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, COMPACT_IDLE);
    };
    const onScroll = () => {
      later();
      const now = performance.now();
      const speed = (Math.abs(el.scrollLeft - last.x) / Math.max(now - last.at, 1)) * 1000; // px a second
      last = { x: el.scrollLeft, at: now };
      if (speed < el.clientWidth * COMPACT_SLOW && now - measured >= COMPACT_EVERY) {
        measured = now;
        measure();
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', later);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', later);
    };
  }, [compact, measure]);
  function toggleCompact() {
    saveCompact(!getCompact());
  }

  const entry = selected && byKey.get(selected);

  // The address follows the open sheet (see `linkId` above).
  useEffect(() => {
    const hash = sheetOpen && entry ? `#/timeline/${server}/${entry.id}` : '#/timeline';
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
  }, [sheetOpen, entry, server]);
  return (
    <div className="timeline-page">
      <header className="timeline-header">
        <div className="toolbar">
          {current?.marks.map((mark) => {
            const Icon = MARK_ICONS[mark.key];
            return (
              <button
                type="button"
                key={mark.key}
                onClick={() => scrollToDay(timeline.at(mark.at))}
                title={t(`timeline.mark.${mark.key}.title`)}
              >
                {Icon && <Icon size={18} aria-hidden="true" />}
                {t(`timeline.mark.${mark.key}.button`)}
              </button>
            );
          })}
          <TimelineFilter
            kinds={kinds}
            verdicts={verdictsOf ? VERDICTS : []}
            hidden={hidden}
            onChange={changeHidden}
            groups={presentGroups}
            onReorder={(from, to) =>
              changeOrder(
                reorderGroups(
                  laneOrder.map((group) => group.key),
                  presentGroups.map((group) => group.key),
                  from,
                  to
                )
              )
            }
            onResetOrder={() => changeOrder(DEFAULT_ORDER)}
            defaultOrder={isDefaultOrder(laneOrder.map((group) => group.key))}
            disabled={!timeline}
          />
          <button type="button" onClick={() => scrollToDay(timeline.today)} disabled={!timeline}>
            <LocateFixed size={18} aria-hidden="true" />
            {t('timeline.today')}
          </button>
          <button
            type="button"
            onClick={toggleCompact}
            disabled={!timeline}
            aria-pressed={compact}
            aria-label={t('timeline.compact')}
            title={t('timeline.compactTitle')}
          >
            <FoldVertical size={18} aria-hidden="true" />
          </button>
          <fieldset className="segmented" aria-label={t('timeline.zoom')}>
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

      {!timeline ? (
        <p className="status">{t('timeline.loading')}</p>
      ) : (
        <div className="timeline" ref={scroller}>
          {/* Half a screen of slack at the end, so today can always be centred. */}
          <div
            className="timeline-canvas"
            style={{ width: `calc(${timeline.days * px}px + 50vw)`, '--day': `${px}px` }}
          >
            <TimelineAxis timeline={timeline} scenarios={scenarios} px={px} format={format} />
            <CalendarLines timeline={timeline} scenarios={scenarios} marks={current.marks} px={px} format={format} />
            {groups.map((group) => (
              <LaneGroup
                key={group.key}
                group={group}
                collapsed={collapsed.has(group.key)}
                visible={compact && visible?.groups === groups ? visible.rows[group.key] : null}
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
          lookup={(key) => byKey.get(key)}
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
