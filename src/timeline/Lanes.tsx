import { Fragment, memo, useMemo } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { Entry } from './entries.ts';
import { type LaneGroupRows, type LaneItem, partCount } from './layout.ts';
import type { DateFormats } from './format.ts';
import type { RenderWindow } from './useRenderWindow.ts';
import styles from './Lanes.module.css';
import { barLabel, dateRange, kindName, raceLabel } from './format.ts';

// Bars too short for a label are chips: no label, no art (name in the tooltip and sheet).
const CHIP_WIDTH = 64;
const MIN_WIDTH = 6;

type Callbacks = {
  at: (ms: number) => number;
  format: DateFormats;
  unfolded: Set<string>;
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
  at,
  format,
  unfolded,
  onToggleParts,
  onSelect,
}: Callbacks & {
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
          rows={group.rows}
          shown={shown}
          range={range}
          at={at}
          format={format}
          unfolded={unfolded}
          onToggleParts={onToggleParts}
          onSelect={onSelect}
        />
      )}
    </section>
  );
});

// Nested rows' ids are prefixed with their parent's key, as visibleRows() gives them.
function Rows({
  rows,
  shown,
  range,
  at,
  format,
  unfolded,
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
                item={item}
                at={at}
                format={format}
                open={unfolded.has(item.entry.key)}
                onToggleParts={onToggleParts}
                onSelect={onSelect}
              />
            ))}
        </div>
        {open.map((item) => (
          <div key={item.entry.key} className={styles.partRows} data-tone={item.entry.tone}>
            <div
              className={styles.partBand}
              style={{ left: at(item.start), width: Math.max(at(item.end) - at(item.start), MIN_WIDTH) }}
            />
            <Rows
              rows={item.parts}
              shown={shown}
              range={range}
              prefix={`${item.entry.key}/`}
              at={at}
              format={format}
              unfolded={unfolded}
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
const Bar = memo(function Bar({
  item,
  at,
  format,
  open,
  onToggleParts,
  onSelect,
}: Omit<Callbacks, 'unfolded'> & { item: LaneItem<Entry>; open: boolean }) {
  const { t } = useTranslation();
  const entry = item.entry;
  const left = at(item.start);
  const width = Math.max(at(item.end) - left, MIN_WIDTH);
  const chip = width < CHIP_WIDTH;
  const parts = partCount(item);
  const label = barLabel(entry);
  const race = raceLabel(entry);
  const title = t(TITLE_KEY[entry.status] ?? 'timeline.barTitle', {
    label,
    kind: kindName(entry),
    dates: dateRange(entry, format.long),
  });
  return (
    <div
      data-tone={entry.tone}
      className={clsx(
        styles.bar,
        styles[entry.status],
        chip && styles.chip,
        entry.art?.official && styles.officialArt,
        parts > 0 && styles.hasParts
      )}
      style={{ left, width, ...(entry.art && !chip && { backgroundImage: `url(${entry.art.src})` }) }}
    >
      <button
        type="button"
        className={styles.barHit}
        data-testid="bar"
        title={title}
        aria-label={title}
        onClick={() => onSelect(entry)}
      />
      {!chip && (
        <span className={styles.barLabel} aria-hidden="true">
          <strong>{race ? t('timeline.withRace', { label, race }) : label}</strong>
          <small>{dateRange(entry, format.short)}</small>
        </span>
      )}
      {parts > 0 && (
        // The button sticks to the track's right end, so it never slides back over the label.
        <span className={styles.barFoldTrack}>
          <button
            type="button"
            className={clsx(styles.barFold, open && styles.open)}
            aria-expanded={open}
            aria-label={t(open ? 'timeline.hideParts' : 'timeline.showParts', { count: parts, name: label })}
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
