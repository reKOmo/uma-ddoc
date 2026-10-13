import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Globe, LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import scenarioData from '../../data/scenarios.json' with { type: 'json' };
import { useSettings } from '../settings.jsx';
import { useDragScroll } from '../useDragScroll.js';
import { loadTimeline } from '../timeline/data.js';
import { buildTimeline, laneGroups, spanOf } from '../timeline/layout.js';
import { scenarioSegments } from '../timeline/scenarioStrip.js';
import { getCollapsed, saveCollapsed } from '../timeline/collapsed.js';
import { dateFormats } from '../timeline/format.js';
import { CalendarLines, TimelineAxis } from '../timeline/TimelineAxis.jsx';
import { LaneGroup } from '../timeline/Lanes.jsx';
import TimelineSheet from '../timeline/TimelineSheet.jsx';
import '../timeline/timeline.css';

const ZOOMS = [4, 8, 16, 32]; // pixels per day
// A mark's toolbar button icon (marks: loadTimeline() in src/timeline/data.js).
const MARK_ICONS = { global: Globe };

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
  const [data, setData] = useState(null); // { server, entries, marks }
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

  useEffect(() => {
    let cancelled = false;
    loadTimeline(server).then((loaded) => !cancelled && setData({ server, ...loaded }));
    return () => {
      cancelled = true;
    };
  }, [server]);
  // (Another server's data is still the old one's until it loads.)
  const current = data?.server === server ? data : null;

  const byKey = useMemo(() => new Map(current?.entries.map((entry) => [entry.key, entry])), [current]);
  const timeline = useMemo(
    () => current && buildTimeline(current.entries, { utc: timeZone === 'utc' }),
    [current, timeZone]
  );
  const groups = useMemo(() => (current ? laneGroups(current.entries) : []), [current]);
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
  const [collapsed, setCollapsed] = useState(getCollapsed);
  const toggleGroup = useCallback(
    (key) =>
      setCollapsed((old) => {
        const next = toggled(old, key);
        saveCollapsed(next);
        return next;
      }),
    []
  );
  const toggleParts = useCallback((key) => setUnfolded((old) => toggled(old, key)), []);
  const at = useCallback((ms) => timeline.at(ms) * px, [timeline, px]);

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
          <button type="button" onClick={() => scrollToDay(timeline.today)} disabled={!timeline}>
            <LocateFixed size={18} aria-hidden="true" />
            {t('timeline.today')}
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
