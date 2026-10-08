import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TIER_NAMES } from '../tiers.js';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../i18n/index.js';
import { useDragScroll } from '../useDragScroll.js';

const HEIGHT = 240;
// The rank axis sits in its own column outside the scroller, so it stays put.
const AXIS_WIDTH = 40;
const MARGIN = { top: 16, right: 28, bottom: 44 };
const MONTH_WIDTH = 20; // pixels per month; the plot scrolls once it's wider than the screen
// Months are too narrow to label each one, so only quarters (Jan, Apr, Jul, Oct) are.
const isQuarter = (time) => new Date(time).getUTCMonth() % 3 === 0;

const toTime = (date) => Date.parse(`${date}T00:00:00Z`);
export const formatDay = (date, opts = { year: 'numeric', month: 'short', day: 'numeric' }) =>
  formatDate(toTime(date), { ...opts, timeZone: 'UTC' });
const formatMonth = (time) => formatDate(time, { month: 'short', timeZone: 'UTC' });

// About `count` round rank ticks between 1 and max (1, 5, 10… or 1, 10, 20…).
function rankTicks(max, count = 4) {
  const raw = max / count;
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => s >= raw) ?? 100;
  const ticks = [1];
  for (let t = step; t <= max; t += step) if (t > 1) ticks.push(t);
  return ticks;
}

// Every month start from the month holding `from` to the one after `to`, as UTC times.
function monthStarts(from, to) {
  const d = new Date(from);
  const months = [];
  for (let m = d.getUTCMonth(); ; m++) {
    const t = Date.UTC(d.getUTCFullYear(), m, 1);
    months.push(t);
    if (t > to) return months;
  }
}

function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

// Step chart of a card's tier list position over time (#1 at the top), from
// rankHistory() points. The last real step runs on to today; points marked
// `predicted` continue from there as a dashed line. Scrolls sideways, and opens
// scrolled to today.
export default function RankChart({ history, nameOf }) {
  const { t } = useTranslation();
  const wrapper = useRef(null);
  const scroller = useRef(null);
  const svg = useRef(null);
  const viewWidth = useWidth(scroller);
  const [active, setActive] = useState(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  useDragScroll(scroller);

  const now = Date.now();
  const months = monthStarts(toTime(history[0].date), Math.max(now, toTime(history.at(-1).date)));
  const from = months[0];
  const to = months.at(-1);
  const maxRank = Math.max(...history.map((p) => p.position), 2);

  const width = Math.max(viewWidth, (months.length - 1) * MONTH_WIDTH + MARGIN.right);
  const plotW = width - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (t) => ((t - from) / (to - from)) * plotW;
  const y = (rank) => MARGIN.top + ((rank - 1) / (maxRank - 1)) * plotH;

  const points = history.map((p) => ({ ...p, x: x(toTime(p.date)), y: y(p.position) }));
  const actual = points.filter((p) => !p.predicted);
  const future = points.filter((p) => p.predicted);
  // Today, or the last real step if that's later (a release dated today in another time zone).
  const todayX = Math.max(x(now), actual.at(-1)?.x ?? 0);
  const steps = (from, rest) => `M${from.x},${from.y}${rest.map((p) => `H${p.x}V${p.y}`).join('')}`;
  const realPath = actual.length > 0 && `${steps(actual[0], actual.slice(1))}H${todayX}`;
  const futureStart = actual.length > 0 ? { x: todayX, y: actual.at(-1).y } : future[0];
  const futurePath = future.length > 0 && steps(futureStart, actual.length > 0 ? future : future.slice(1));
  // Dots where the position changed, plus the start and the current and last positions.
  const marked = points.filter(
    (p, i) => i === 0 || p === actual.at(-1) || i === points.length - 1 || p.position !== points[i - 1].position
  );
  const current = actual.at(-1);
  const last = points.at(-1);
  const ticks = rankTicks(maxRank);

  // Open on today (a third of the way in when predictions follow it, else at the right edge):
  // on first layout and when the data changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these deps are the triggers, not values the effect reads.
  useLayoutEffect(() => {
    const el = scroller.current;
    el.scrollLeft = future.length > 0 ? todayX - el.clientWidth / 3 : el.scrollWidth;
  }, [history, viewWidth > 0]);

  // Keep the point picked with the arrow keys in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the picked point changes; `points` is rebuilt every render.
  useEffect(() => {
    if (active === null || document.activeElement !== svg.current) return;
    const el = scroller.current;
    const px = points[active].x;
    if (px < el.scrollLeft + 40 || px > el.scrollLeft + el.clientWidth - 40) {
      el.scrollTo({ left: px - el.clientWidth / 2, behavior: 'smooth' });
    }
  }, [active]);

  function pointAt(clientX) {
    const left = clientX - svg.current.getBoundingClientRect().left;
    let index = 0;
    points.forEach((p, i) => {
      if (p.x <= left) index = i;
    });
    return index;
  }

  function onKeyDown(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.key === 'ArrowLeft' ? -1 : 1;
    setActive((i) => Math.min(Math.max((i ?? points.length - 1) + step, 0), points.length - 1));
  }

  const hovered = active !== null ? points[active] : null;
  // The tooltip lives outside the scroller (so it isn't clipped); place it in view coordinates.
  const tooltipX = hovered && AXIS_WIDTH + hovered.x - scrollLeft;
  const wrapperWidth = AXIS_WIDTH + viewWidth;

  return (
    <div className="rank-chart" ref={wrapper}>
      <svg className="rank-axis" width={AXIS_WIDTH} height={HEIGHT} aria-hidden="true">
        {ticks.map((rank) => (
          <text
            key={rank}
            className="axis-label"
            x={AXIS_WIDTH - 6}
            y={y(rank)}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {t('common.rank', { position: rank })}
          </text>
        ))}
      </svg>
      <div className="rank-scroller" ref={scroller} onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}>
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
              .filter(Boolean)
              .join('. ')}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users can step through the points with the arrow keys.
            tabIndex={0}
            onPointerMove={(e) => setActive(pointAt(e.clientX))}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={onKeyDown}
          >
            {ticks.map((rank) => (
              <line key={rank} className="grid" x1={0} x2={width} y1={y(rank)} y2={y(rank)} />
            ))}
            {months.map((t, i) => {
              const date = new Date(t);
              const january = date.getUTCMonth() === 0;
              const mx = x(t);
              // Label the first month's year too, unless the next January is too close for it to fit.
              const nextJanuary = months.findIndex((m, j) => j > 0 && new Date(m).getUTCMonth() === 0);
              const showYear =
                i < months.length - 1 && (january || (i === 0 && (nextJanuary === -1 || nextJanuary >= 3)));
              return (
                <g key={t}>
                  <line
                    className={january ? 'grid year' : 'month-tick'}
                    x1={mx}
                    x2={mx}
                    y1={january ? MARGIN.top : MARGIN.top + plotH}
                    y2={MARGIN.top + plotH + 6}
                  />
                  {isQuarter(t) && i < months.length - 1 && (
                    <text className="axis-label" x={mx + 4} y={HEIGHT - MARGIN.bottom + 18}>
                      {formatMonth(t)}
                    </text>
                  )}
                  {showYear && (
                    <text className="axis-label year-label" x={mx + 4} y={HEIGHT - MARGIN.bottom + 34}>
                      {date.getUTCFullYear()}
                    </text>
                  )}
                </g>
              );
            })}
            <line className="today-line" x1={todayX} x2={todayX} y1={MARGIN.top} y2={MARGIN.top + plotH} />
            {realPath && <path className="rank-line" d={realPath} />}
            {futurePath && <path className="rank-line predicted" d={futurePath} />}
            {marked.map((p) => (
              <circle
                key={p.date}
                className={p.predicted ? 'rank-dot predicted' : 'rank-dot'}
                cx={p.x}
                cy={p.y}
                r={4}
              />
            ))}
            {current && (
              <text className="end-label" x={todayX + 4} y={current.y - 10} textAnchor="middle">
                {t('common.rank', current)}
              </text>
            )}
            {last.predicted && (
              <text className="end-label predicted" x={last.x + 4} y={last.y - 10} textAnchor="middle">
                {t('common.rank', last)}
              </text>
            )}
            {hovered && (
              <g className="crosshair">
                <line x1={hovered.x} x2={hovered.x} y1={MARGIN.top} y2={MARGIN.top + plotH} />
                <circle
                  className={hovered.predicted ? 'rank-dot predicted' : 'rank-dot'}
                  cx={hovered.x}
                  cy={hovered.y}
                  r={5}
                />
              </g>
            )}
          </svg>
        )}
      </div>
      {hovered && tooltipX >= AXIS_WIDTH && tooltipX <= wrapperWidth && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(Math.max(tooltipX, 90), wrapperWidth - 90), top: Math.max(hovered.y - 12, 0) }}
        >
          <span className="tooltip-date">
            {hovered.predicted ? t('chart.predictedDate', { date: formatDay(hovered.date) }) : formatDay(hovered.date)}
          </span>
          <span className="tooltip-rank">
            <span className={`tier-chip tier-${hovered.tier}`}>{TIER_NAMES[hovered.tier]}</span>
            {t('common.rankOf', hovered)}
          </span>
          {hovered.overtakenBy.length > 0 && (
            <span className="tooltip-note">
              {t('chart.passedBy', { names: hovered.overtakenBy.map((c) => nameOf(c.id)) })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
