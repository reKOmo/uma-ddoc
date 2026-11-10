import { type CSSProperties, Fragment, memo, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { Entry } from './entries.ts';
import { type LaneGroupRows, type LaneItem, ZOOMS, partCount } from './layout.ts';
import type { DateFormats } from './format.ts';
import type { RenderWindow } from './useRenderWindow.ts';
import styles from './Lanes.module.css';
import { barLabel, dateRange, kindName, labelIsFan, raceLabel } from './format.ts';
import { FanTl } from '../ui/FanTl.tsx';
import i18n from '../i18n/index.ts';

// Bars too short for a label are chips: no label, no art (name in the tooltip and sheet).
const CHIP_WIDTH = 64;

// Bars are placed in days (`--x`, `--w`) times the canvas's `--day`, and a bar lists the zoom levels it's a chip at
// (`data-chip`, matched against the canvas's `data-zoom`): zooming changes CSS only, re-rendering no bar.
const chipZooms = (days: number): string => ZOOMS.flatMap((px, i) => (days * px < CHIP_WIDTH ? [i] : [])).join(' ');
const place = (day: (ms: number) => number, start: number, end: number) =>
  ({ '--x': day(start), '--w': day(end) - day(start) }) as CSSProperties;

type Callbacks = {
  // (From LaneGroup's useTranslation: one hook per group, not per bar.)
  t: TFunction;
  // A time's day on the calendar (Timeline.at).
  day: (ms: number) => number;
  format: DateFormats;
  unfolded: Set<string>;
  // The search's current match: ringed, and scrolled into view when it's drawn.
  focused: string | null;
  onToggleParts: (key: string) => void;
  onSelect: (entry: Entry) => void;
};

// `visible`: compact mode's rows in view, comma-joined (a string compares by value), else null. `range`: the time range
// whose bars are drawn (useRenderWindow), none while null.
// Memoised with stable props: a group holds hundreds of bars, and re-rendering them on every sheet open would stall
// the sheet's animation.
export const LaneGroup = memo(function LaneGroup({
  group,
  collapsed,
  visible,
  range,
  onToggleGroup,
  day,
  format,
  unfolded,
  focused,
  onToggleParts,
  onSelect,
}: Omit<Callbacks, 't'> & {
  group: LaneGroupRows<Entry>;
  collapsed: boolean;
  visible: string | null;
  range: RenderWindow | null;
  onToggleGroup: (key: string) => void;
}) {
  const { t } = useTranslation();
  const label = t(group.label);
  const shown = useMemo(() => (visible === null ? null : new Set(visible.split(','))), [visible]);
  return (
    <section className={styles.laneGroup}>
      <button
        type="button"
        className={clsx(styles.laneLabel, collapsed && styles.collapsed)}
        aria-expanded={!collapsed}
        title={t(collapsed ? 'timeline.showGroup' : 'timeline.hideGroup', { name: label })}
        onClick={() => onToggleGroup(group.key)}
      >
        {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        {label}
        {!collapsed && visible === '' && <span className={styles.laneEmpty}>{t('timeline.nothingInView')}</span>}
      </button>
      {!collapsed && (
        <Rows
          t={t}
          rows={group.rows}
          shown={shown}
          range={range}
          day={day}
          format={format}
          unfolded={unfolded}
          focused={focused}
          onToggleParts={onToggleParts}
          onSelect={onSelect}
        />
      )}
    </section>
  );
});

// Nested rows' ids are prefixed with their parent's key, as visibleRows() gives them.
function Rows({
  t,
  rows,
  shown,
  range,
  day,
  format,
  unfolded,
  focused,
  onToggleParts,
  onSelect,
  depth = 0,
  prefix = '',
}: Callbacks & {
  rows: LaneItem<Entry>[][];
  shown: Set<string> | null;
  range: RenderWindow | null;
  depth?: number;
  prefix?: string;
}) {
  return rows.map((row, i) => {
    const open = row.filter((item) => item.parts.length && unfolded.has(item.entry.key));
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: lanes have no identity of their own; their order is stable.
      <Fragment key={i}>
        <div
          className={clsx(
            styles.lane,
            depth > 0 && styles.partLane,
            shown && !shown.has(`${prefix}${i}`) && styles.hidden
          )}
        >
          {row
            .filter((item) => range && item.start < range.to && item.end > range.from)
            .map((item) => (
              <Bar
                key={item.entry.key}
                t={t}
                item={item}
                day={day}
                format={format}
                open={unfolded.has(item.entry.key)}
                focused={item.entry.key === focused}
                onToggleParts={onToggleParts}
                onSelect={onSelect}
              />
            ))}
        </div>
        {open.map((item) => (
          <div key={item.entry.key} className={styles.partRows} data-tone={item.entry.tone}>
            <div className={styles.partBand} style={place(day, item.start, item.end)} />
            <Rows
              t={t}
              rows={item.parts}
              shown={shown}
              range={range}
              prefix={`${item.entry.key}/`}
              day={day}
              format={format}
              unfolded={unfolded}
              focused={focused}
              onToggleParts={onToggleParts}
              onSelect={onSelect}
              depth={depth + 1}
            />
          </div>
        ))}
      </Fragment>
    );
  });
}

const TITLE_KEY: Partial<Record<Entry['status'], string>> = {
  predicted: 'timeline.predictedBarTitle',
  confirmed: 'timeline.confirmedBarTitle',
};

// The whole bar is one button (`.bar-hit`) under the label and fold button, which stick to the screen's edges while
// the bar runs off them. Memoised: folding one entry's parts re-renders its bar alone.
// A bar's texts, worked out once per entry (per language and date format): bars are drawn again each time they scroll
// into the drawn range, and the dates' Intl formatting was most of their cost.
// `name`: without the race (the fold button's label).
type BarText = { title: string; name: string; label: string; dates: string };
// (By language, not by `t`: each group's useTranslation gives its own.)
let barTexts: { language: string; format: DateFormats; of: WeakMap<Entry, BarText> } | null = null;
function barText(entry: Entry, t: TFunction, format: DateFormats): BarText {
  const { language } = i18n;
  if (barTexts?.language !== language || barTexts.format !== format) barTexts = { language, format, of: new WeakMap() };
  let text = barTexts.of.get(entry);
  if (!text) {
    const label = barLabel(entry);
    const race = raceLabel(entry);
    text = {
      title: t(TITLE_KEY[entry.status] ?? 'timeline.barTitle', {
        label,
        kind: kindName(entry),
        dates: dateRange(entry, format.long),
      }),
      name: label,
      label: race ? t('timeline.withRace', { label, race }) : label,
      dates: dateRange(entry, format.short),
    };
    barTexts.of.set(entry, text);
  }
  return text;
}

const Bar = memo(function Bar({
  t,
  item,
  day,
  format,
  open,
  focused,
  onToggleParts,
  onSelect,
}: Omit<Callbacks, 'unfolded' | 'focused'> & { item: LaneItem<Entry>; open: boolean; focused: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // (Also when it's first drawn: the page scrolls to its day first, which brings it into the drawn range.)
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [focused]);
  const entry = item.entry;
  const parts = partCount(item);
  const { title, name, label, dates } = barText(entry, t, format);
  return (
    <div
      ref={ref}
      data-tone={entry.tone}
      className={clsx(
        styles.bar,
        focused && styles.focused,
        styles[entry.status],
        entry.endPredicted && styles.endPredicted,
        entry.art?.official && styles.officialArt,
        parts > 0 && styles.hasParts
      )}
      data-chip={chipZooms(day(item.end) - day(item.start))}
      style={{ ...place(day, item.start, item.end), ...(entry.art && { backgroundImage: `url(${entry.art.src})` }) }}
    >
      <button
        type="button"
        className={styles.barHit}
        data-testid="bar"
        aria-current={focused || undefined}
        title={title}
        aria-label={title}
        onClick={() => onSelect(entry)}
      />
      <span className={styles.barLabel} aria-hidden="true">
        <strong>
          <FanTl fan={labelIsFan(entry)}>{label}</FanTl>
        </strong>
        <small>{dates}</small>
      </span>
      {parts > 0 && (
        // The button sticks to the track's right end, so it never slides back over the label.
        <span className={styles.barFoldTrack}>
          <button
            type="button"
            className={clsx(styles.barFold, open && styles.open)}
            aria-expanded={open}
            aria-label={t(open ? 'timeline.hideParts' : 'timeline.showParts', { count: parts, name })}
            onClick={() => onToggleParts(entry.key)}
          >
            {`+${parts}`}
            {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          </button>
        </span>
      )}
    </div>
  );
});
