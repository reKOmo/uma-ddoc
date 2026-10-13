import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../i18n/index.ts';
import type { HistoryPoint } from '../rankHistory.ts';
import { useDragScroll } from '../useDragScroll.ts';
import TierChip from '../ui/TierChip.tsx';
import styles from './RankChart.module.css';

const HEIGHT = 240;
// The rank axis sits in its own column outside the scroller, so it stays put.
const AXIS_WIDTH = 40;
const MARGIN = { top: 16, right: 28, bottom: 44 };
const MONTH_WIDTH = 20; // pixels per month; the plot scrolls once it's wider than the screen
// Months are too narrow to label each one, so only quarters (Jan, Apr, Jul, Oct) are.
const isQuarter = (time: number): boolean => new Date(time).getUTCMonth() % 3 === 0;

const toTime = (date: string): number => Date.parse(`${date}T00:00:00Z`);
export const formatDay = (
  date: string,
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string => formatDate(toTime(date), { ...opts, timeZone: 'UTC' });
const formatMonth = (time: number): string => formatDate(time, { month: 'short', timeZone: 'UTC' });

// About `count` round rank ticks between 1 and max (1, 5, 10… or 1, 10, 20…).
function rankTicks(max: number, count = 4): number[] {
  const raw = max / count;
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => s >= raw) ?? 100;
  const ticks = [1];
  for (let t = step; t <= max; t += step) if (t > 1) ticks.push(t);
  return ticks;
}

// Every month start from the month holding `from` to the one after `to`, as UTC times.
function monthStarts(from: number, to: number): number[] {
  const d = new Date(from);
  const months: number[] = [];
  for (let m = d.getUTCMonth(); ; m++) {
    const t = Date.UTC(d.getUTCFullYear(), m, 1);
    months.push(t);
    if (t > to) return months;
  }
}

function useWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

type Point = HistoryPoint & { x: number; y: number };
type Coords = { x: number; y: number };

export type RankChartProps = {
  history: HistoryPoint[];
  nameOf: (id: number) => string | undefined;
};

// Step chart of a card's tier list position over time (#1 at the top), from
// rankHistory() points. The last real step runs on to today; points marked
// `predicted` continue from there as a dashed line. Scrolls sideways, and opens
// scrolled to today.
export default function RankChart({ history, nameOf }: RankChartProps) {
  const { t } = useTranslation();
  const wrapper = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const viewWidth = useWidth(scroller);
  const [active, setActive] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  useDragScroll(scroller);

  const now = Date.now();
  const months = monthStarts(toTime(history[0].date), Math.max(now, toTime(history[history.length - 1].date)));
  const from = months[0];
  const to = months[months.length - 1];
  const maxRank = Math.max(...history.map((p) => p.position), 2);

  const width = Math.max(viewWidth, (months.length - 1) * MONTH_WIDTH + MARGIN.right);
  const plotW = width - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (time: number): number => ((time - from) / (to - from)) * plotW;
  const y = (rank: number): number => MARGIN.top + ((rank - 1) / (maxRank - 1)) * plotH;

  const points: Point[] = history.map((p) => ({ ...p, x: x(toTime(p.date)), y: y(p.position) }));
  const actual = points.filter((p) => !p.predicted);
  const future = points.filter((p) => p.predicted);
  const current = actual.at(-1);
  const last = points[points.length - 1];
  // Today, or the last real step if that's later (a release dated today in another time zone).
  const todayX = Math.max(x(now), current?.x ?? 0);
  const steps = (start: Coords, rest: Coords[]): string =>
    `M${start.x},${start.y}${rest.map((p) => `H${p.x}V${p.y}`).join('')}`;
  const realPath = actual.length > 0 ? `${steps(actual[0], actual.slice(1))}H${todayX}` : null;
  const futureStart: Coords | undefined = current ? { x: todayX, y: current.y } : future[0];
  const futurePath = future.length > 0 && futureStart ? steps(futureStart, current ? future : future.slice(1)) : null;
  // Dots where the position changed, plus the start and the current and last positions.
  const marked = points.filter(
    (p, i) => i === 0 || p === current || i === points.length - 1 || p.position !== points[i - 1].position
  );
  const ticks = rankTicks(maxRank);

  // Open on today (a third of the way in when predictions follow it, else at the right edge):
  // on first layout and when the data changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these deps are the triggers, not values the effect reads.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = future.length > 0 ? todayX - el.clientWidth / 3 : el.scrollWidth;
  }, [history, viewWidth > 0]);

  // Keep the point picked with the arrow keys in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the picked point changes; `points` is rebuilt every render.
  useEffect(() => {
    const el = scroller.current;
    if (active === null || !el || document.activeElement !== svg.current) return;
    const px = points[active].x;
    if (px < el.scrollLeft + 40 || px > el.scrollLeft + el.clientWidth - 40) {
      el.scrollTo({ left: px - el.clientWidth / 2, behavior: 'smooth' });
    }
  }, [active]);

  function pointAt(clientX: number): number {
    const left = clientX - (svg.current?.getBoundingClientRect().left ?? 0);
    let index = 0;
    points.forEach((p, i) => {
      if (p.x <= left) index = i;
    });
    return index;
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.key === 'ArrowLeft' ? -1 : 1;
    setActive((i) => Math.min(Math.max((i ?? points.length - 1) + step, 0), points.length - 1));
  }

  const hovered = active !== null ? points[active] : null;
  // The tooltip lives outside the scroller (so it isn't clipped); place it in view coordinates.
  const tooltipX = hovered ? AXIS_WIDTH + hovered.x - scrollLeft : null;
  const wrapperWidth = AXIS_WIDTH + viewWidth;

  return (
    <div className={styles.rankChart} ref={wrapper}>
      <svg className={styles.rankAxis} width={AXIS_WIDTH} height={HEIGHT} aria-hidden="true">
        {ticks.map((rank) => (
          <text
            key={rank}
            className={styles.axisLabel}
            x={AXIS_WIDTH - 6}
            y={y(rank)}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {t('common.rank', { position: rank })}
          </text>
        ))}
      </svg>
      <div className={styles.rankScroller} ref={scroller} onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}>
        {viewWidth > 0 && (
          <svg
            ref={svg}
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={[
              current && t('chart.label', { start: t('common.rank', history[0]), now: t('common.rank', current) }),
              last.predicted && t('chart.labelPredicted', { end: t('common.rank', last), date: formatDay(last.date) }),
            ]
              .filter((label): label is string => Boolean(label))
              .join('. ')}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users can step through the points with the arrow keys.
            tabIndex={0}
            onPointerMove={(e) => setActive(pointAt(e.clientX))}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={onKeyDown}
          >
            {ticks.map((rank) => (
              <line key={rank} className={styles.grid} x1={0} x2={width} y1={y(rank)} y2={y(rank)} />
            ))}
            {months.map((monthStart, i) => {
              const date = new Date(monthStart);
              const january = date.getUTCMonth() === 0;
              const mx = x(monthStart);
              // Label the first month's year too, unless the next January is too close for it to fit.
              const nextJanuary = months.findIndex((m, j) => j > 0 && new Date(m).getUTCMonth() === 0);
              const showYear =
                i < months.length - 1 && (january || (i === 0 && (nextJanuary === -1 || nextJanuary >= 3)));
              return (
                <g key={monthStart}>
                  <line
                    className={january ? clsx(styles.grid, styles.year) : styles.monthTick}
                    x1={mx}
                    x2={mx}
                    y1={january ? MARGIN.top : MARGIN.top + plotH}
                    y2={MARGIN.top + plotH + 6}
                  />
                  {isQuarter(monthStart) && i < months.length - 1 && (
                    <text className={styles.axisLabel} x={mx + 4} y={HEIGHT - MARGIN.bottom + 18}>
                      {formatMonth(monthStart)}
                    </text>
                  )}
                  {showYear && (
                    <text
                      className={clsx(styles.axisLabel, styles.yearLabel)}
                      x={mx + 4}
                      y={HEIGHT - MARGIN.bottom + 34}
                    >
                      {date.getUTCFullYear()}
                    </text>
                  )}
                </g>
              );
            })}
            <line className={styles.todayLine} x1={todayX} x2={todayX} y1={MARGIN.top} y2={MARGIN.top + plotH} />
            {realPath && <path className={styles.rankLine} d={realPath} />}
            {futurePath && <path className={clsx(styles.rankLine, styles.predicted)} d={futurePath} />}
            {marked.map((p) => (
              <circle
                key={p.date}
                className={clsx(styles.rankDot, p.predicted && styles.predicted)}
                cx={p.x}
                cy={p.y}
                r={4}
              />
            ))}
            {current && (
              <text className={styles.endLabel} x={todayX + 4} y={current.y - 10} textAnchor="middle">
                {t('common.rank', current)}
              </text>
            )}
            {last.predicted && (
              <text
                className={clsx(styles.endLabel, styles.predicted)}
                x={last.x + 4}
                y={last.y - 10}
                textAnchor="middle"
              >
                {t('common.rank', last)}
              </text>
            )}
            {hovered && (
              <g className={styles.crosshair}>
                <line x1={hovered.x} x2={hovered.x} y1={MARGIN.top} y2={MARGIN.top + plotH} />
                <circle
                  className={clsx(styles.rankDot, hovered.predicted && styles.predicted)}
                  cx={hovered.x}
                  cy={hovered.y}
                  r={5}
                />
              </g>
            )}
          </svg>
        )}
      </div>
      {hovered && tooltipX !== null && tooltipX >= AXIS_WIDTH && tooltipX <= wrapperWidth && (
        <div
          className={styles.tooltip}
          style={{ left: Math.min(Math.max(tooltipX, 90), wrapperWidth - 90), top: Math.max(hovered.y - 12, 0) }}
        >
          <span className={styles.tooltipDate}>
            {hovered.predicted ? t('chart.predictedDate', { date: formatDay(hovered.date) }) : formatDay(hovered.date)}
          </span>
          <span className={styles.tooltipRank}>
            <TierChip tier={hovered.tier} />
            {t('common.rankOf', hovered)}
          </span>
          {hovered.overtakenBy.length > 0 && (
            <span className={styles.tooltipNote}>
              {t('chart.passedBy', { names: hovered.overtakenBy.map((c) => nameOf(c.id)) })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
