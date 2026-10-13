// @ts-nocheck
import { Fragment, memo, useMemo } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { partCount } from './layout.ts';
import { barLabel, dateRange, kindName } from './format.ts';

// Bars too short for a label are chips: no label, no art (name in the tooltip and sheet).
const CHIP_WIDTH = 64;
const MIN_WIDTH = 6;

// A lane group (laneGroups() in ./layout.js): its label, which folds it away (`onToggleGroup(key)`), and its rows of
// bars. `at(ms)` → px; `unfolded`: the keys of entries whose parts are open; `visible`: in compact mode, the ids of
// the rows in view (visibleRows() in ./layout.js, joined with commas: a string, so it compares by value), else null.
// Memoised: a group holds hundreds of bars,
// and re-rendering them all (on opening or closing a sheet) would stall the sheet's animation, so give it stable
// props (callbacks from useCallback).
export const LaneGroup = memo(function LaneGroup({
  group,
  collapsed,
  visible,
  onToggleGroup,
  at,
  format,
  unfolded,
  onToggleParts,
  onSelect,
}) {
  const { t } = useTranslation();
  const label = t(group.label);
  const shown = useMemo(() => (visible === null ? null : new Set(visible.split(','))), [visible]);
  return (
    <section className="lane-group">
      <button
        type="button"
        className={clsx('lane-label', collapsed && 'collapsed')}
        aria-expanded={!collapsed}
        title={t(collapsed ? 'timeline.showGroup' : 'timeline.hideGroup', { name: label })}
        onClick={() => onToggleGroup(group.key)}
      >
        {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        {label}
        {/* Compact mode, nothing of the group in view: said beside its name. */}
        {!collapsed && visible === '' && <span className="lane-empty">{t('timeline.nothingInView')}</span>}
      </button>
      {!collapsed && (
        <Rows
          rows={group.rows}
          shown={shown}
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

// Rows of bars; an entry with parts has a fold button (+N), and its parts' rows open under its row, over a band in
// its colour spanning it. Rows not `shown` (compact mode; ids as visibleRows() gives them) fold away.
function Rows({ rows, shown, at, format, unfolded, onToggleParts, onSelect, depth = 0, prefix = '' }) {
  return rows.map((row, i) => {
    const open = row.filter((item) => item.parts.length && unfolded.has(item.entry.key));
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: lanes have no identity of their own; their order is stable.
      <Fragment key={i}>
        <div className={clsx('lane', depth && 'part-lane', shown && !shown.has(`${prefix}${i}`) && 'hidden')}>
          {row.map((item) => (
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
          <div key={item.entry.key} className="part-rows" data-tone={item.entry.tone}>
            <div
              className="part-band"
              style={{ left: at(item.start), width: Math.max(at(item.end) - at(item.start), MIN_WIDTH) }}
            />
            <Rows
              rows={item.parts}
              shown={shown}
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

const TITLE_KEY = { predicted: 'timeline.predictedBarTitle', confirmed: 'timeline.confirmedBarTitle' };

// One banner or event: its art behind a darkened label, edged in its colour, faded by its status. The whole bar is
// one button (`.bar-hit`, under the rest); over it, its label sticks to the screen's left edge and its +N fold button
// to the right while the bar runs off either side, so a long bar on a phone still shows both. Memoised: folding one
// entry's parts re-renders its bar alone, not every bar on the calendar.
const Bar = memo(function Bar({ item, at, format, open, onToggleParts, onSelect }) {
  const { t } = useTranslation();
  const { entry } = item;
  const left = at(item.start);
  const width = Math.max(at(item.end) - left, MIN_WIDTH);
  const chip = width < CHIP_WIDTH;
  const parts = partCount(item);
  const label = barLabel(entry);
  const title = t(TITLE_KEY[entry.status] ?? 'timeline.barTitle', {
    label,
    kind: kindName(entry),
    dates: dateRange(entry, format.long),
  });
  return (
    <div
      data-tone={entry.tone}
      className={clsx('bar', entry.status, {
        chip,
        'official-art': entry.art?.official,
        'has-parts': parts > 0,
      })}
      style={{ left, width, ...(entry.art && !chip && { backgroundImage: `url(${entry.art.src})` }) }}
    >
      <button
        type="button"
        className="bar-hit"
        data-testid="bar"
        title={title}
        aria-label={title}
        onClick={() => onSelect(entry)}
      />
      {!chip && (
        <span className="bar-label" aria-hidden="true">
          <strong>{label}</strong>
          <small>{dateRange(entry, format.short)}</small>
        </span>
      )}
      {parts > 0 && (
        // Its track runs from just after the label to the bar's end: the button sticks to the screen's right edge
        // within it, so it never slides back over the label.
        <span className="bar-fold-track">
          <button
            type="button"
            className={clsx('bar-fold', open && 'open')}
            aria-expanded={open}
            aria-label={t(open ? 'timeline.hideParts' : 'timeline.showParts', { count: parts, name: label })}
            onClick={() => onToggleParts(entry.key)}
          >
            {`+${parts}`}
            {/* The arrow says it opens: its parts unfold under the bar, and fold back up. */}
            {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          </button>
        </span>
      )}
    </div>
  );
});
