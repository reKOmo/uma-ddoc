import { type CSSProperties, type Ref, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { formatDate, formatDateRange, formatDay, scenarioName } from '../../i18n/index.ts';
import { useDragScroll } from '../../hooks/useDragScroll.ts';
import type { HistoryPoint } from '../../lib/rankHistory.ts';
import { TIER_NAMES } from '../../lib/tiers.ts';
import TierChip from '../../ui/TierChip.tsx';
import { scenarioStyle } from '../../lib/vividColor.ts';
import { scenarioUrl } from '../../routes.ts';
import { DAY, dayStart } from '../../lib/dates.ts';
import type { ScenarioSegment } from '../../lib/scenarioStrip.ts';
import styles from './RankChart.module.css';

// The rank axis and the tier chips sit in their own columns outside the scroller, so they stay put; in the scroller,
// room above the plot for "Today", below for the dates and the scenario rule, and a little at each end for the dots.
const AXIS_WIDTH = 36;
const CHIPS_WIDTH = 32;
const MARGIN = { top: 28, bottom: 50, side: 10 };
// The tier chips beside the plot (TierChip, made smaller here: --chip-size in the CSS).
const CHIP_SIZE = 20;
// The time after the last step drawn, so its label and dot aren't on the edge; and the least span shown (a card out
// this week would otherwise stretch a few days across the whole width).
const TAIL = 30 * DAY;
const MIN_SPAN = 120 * DAY;
// Least room between two date labels; the step (1, 3, 6 or 12 months) is the smallest that leaves this much.
const DATE_LABEL_GAP = 44;
// A label's width estimate per character (11px bold), for keeping labels from overlapping.
const CHAR_WIDTH = 6.6;

const formatMonth = (time: number): string => formatDate(time, { month: 'short', timeZone: 'UTC' });

// Round ticks from lo up to hi, about `count` of them (1, 5, 10… or 40, 50, 60…): lo itself only when it's #1.
function rankTicks(lo: number, hi: number, count = 4): number[] {
  const raw = (hi - lo) / count;
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => s >= raw) ?? 100;
  const ticks = lo === 1 ? [1] : [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) if (t > 1 && t >= lo) ticks.push(t);
  return ticks;
}

// The ranks the axis spans: the card's own, with a little room above (from #1 when it's near the top), so a card that
// has only ever ranked #40–60 doesn't leave the chart's top half empty.
function rankRange(history: HistoryPoint[]): { lo: number; hi: number } {
  const positions = history.map((p) => p.position);
  const min = Math.min(...positions);
  const hi = Math.max(...positions, min + 1);
  const room = Math.max(1, Math.ceil((hi - min) * 0.1));
  const lo = min - room <= 3 ? 1 : min - room;
  return { lo, hi };
}

function monthStarts(from: number, to: number): number[] {
  const d = new Date(from);
  const months: number[] = [];
  for (let m = d.getUTCMonth() + 1; ; m++) {
    const t = Date.UTC(d.getUTCFullYear(), m, 1);
    if (t > to) return months;
    months.push(t);
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

type RankChartProps = {
  history: HistoryPoint[];
  className?: string;
  ref?: Ref<HTMLDivElement>;
  /** The server's scenarios, as a coloured rule under the dates. */
  scenarios?: ScenarioSegment[];
  /** Called with a marker's date when it's clicked: the release, or a date other cards pass it. */
  onSelect?: (date: string) => void;
  /** The chart's height in pixels. */
  height?: number;
  /** How many times the panel's width the plot is (1: the whole life fits); past 1 it scrolls sideways. */
  zoom?: number;
};

// A band per tier the card is in over time, from the ranks it holds in each: the line between two tiers halfway between
// the last rank of one and the first of the next.
function tierBands(points: HistoryPoint[]): { tier: number; from: number; to: number }[] {
  const spans = new Map<number, { min: number; max: number }>();
  for (const p of points) {
    const span = spans.get(p.tier);
    spans.set(
      p.tier,
      span
        ? { min: Math.min(span.min, p.position), max: Math.max(span.max, p.position) }
        : { min: p.position, max: p.position }
    );
  }
  const tiers = [...spans.keys()].sort((a, b) => a - b);
  return tiers.map((tier, i) => {
    const span = spans.get(tier) ?? { min: 1, max: 1 };
    const before = i > 0 ? spans.get(tiers[i - 1]) : undefined;
    const after = i < tiers.length - 1 ? spans.get(tiers[i + 1]) : undefined;
    return {
      tier,
      from: before ? (before.max + span.min) / 2 : Number.NEGATIVE_INFINITY,
      to: after ? (span.max + after.min) / 2 : Number.POSITIVE_INFINITY,
    };
  });
}

const tierStyle = (tier: number) => ({ '--band': `var(--tier-${tier})` }) as CSSProperties;

type Label = { key: string; x: number; y: number; text: string; tier: number; predicted: boolean; end?: boolean };

// The card's whole life, at the panel's width or `zoom` times it (then scrolling sideways): its rank as a step line in the colour of the tier it's in, dashed once
// it's predicted. Labelled only at its release, today, the last prediction and each tier change.
export default function RankChart({
  history,
  className,
  ref,
  onSelect,
  scenarios = [],
  height: HEIGHT = 300,
  zoom = 1,
}: RankChartProps) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const viewWidth = useWidth(scroller);
  const width = viewWidth * zoom;
  useDragScroll(scroller, zoom > 1);

  const now = Date.now();
  const from = dayStart(history[0].date);
  const to = Math.max(from + MIN_SPAN, Math.max(now, dayStart(history[history.length - 1].date)) + TAIL);
  const { lo: minRank, hi: maxRank } = rankRange(history);
  const plotL = MARGIN.side;
  const plotR = width - MARGIN.side;
  const plotT = MARGIN.top;
  const plotB = HEIGHT - MARGIN.bottom;
  const x = (time: number): number => plotL + ((time - from) / (to - from)) * (plotR - plotL);
  const y = (rank: number): number => plotT + ((rank - minRank) / (maxRank - minRank || 1)) * (plotB - plotT);

  const points = history.map((p) => ({ ...p, x: x(dayStart(p.date)), y: y(p.position) }));
  const current = points.filter((p) => !p.predicted).at(-1);
  const last = points[points.length - 1];
  // Today, or the last real step if that's later (a release dated today in another time zone).
  const todayX = Math.max(x(now), current?.x ?? 0);
  // Not for a card still to come: today is before its line starts.
  const showToday = now >= from;
  const hasFuture = last.predicted;

  // Each step: the drop into it, then its flat part to the next, in its tier's colour; the step running through today
  // turns dashed there.
  const segments = points.flatMap((p, i) => {
    const prev = points[i - 1];
    const endX = points[i + 1]?.x ?? p.x;
    const head = prev ? `M${p.x},${prev.y}V${p.y}` : `M${p.x},${p.y}`;
    if (p.predicted) return [{ key: p.date, d: `${head}H${endX}`, tier: p.tier, predicted: true }];
    if (p === current && hasFuture)
      return [
        { key: p.date, d: `${head}H${todayX}`, tier: p.tier, predicted: false },
        { key: `${p.date}-next`, d: `M${todayX},${p.y}H${endX}`, tier: p.tier, predicted: true },
      ];
    return [{ key: p.date, d: `${head}H${p === current ? todayX : endX}`, tier: p.tier, predicted: false }];
  });
  const tierChanges = points.filter((p, i) => i > 0 && p.tier !== points[i - 1].tier);

  // Labels by priority, each kept only where it doesn't overlap one already placed.
  const candidates: Label[] = [
    {
      key: 'release',
      x: points[0].x,
      y: points[0].y,
      text: t('common.rank', points[0]),
      tier: points[0].tier,
      predicted: points[0].predicted,
    },
    ...(current && showToday
      ? [
          {
            key: 'now',
            x: todayX,
            y: current.y,
            text: t('common.rank', current),
            tier: current.tier,
            predicted: false,
            end: true,
          },
        ]
      : []),
    // (unless it's a tier change: that label says its rank too)
    ...(hasFuture && last !== points[0] && !tierChanges.includes(last)
      ? [
          {
            key: 'end',
            x: last.x,
            y: last.y,
            text: t('common.rank', last),
            tier: last.tier,
            predicted: true,
            end: true,
          },
        ]
      : []),
    ...tierChanges.map((p) => ({
      key: `tier-${p.date}`,
      x: p.x,
      y: p.y,
      text: t('chart.tierChange', { tier: TIER_NAMES[p.tier], rank: t('common.rank', p) }),
      tier: p.tier,
      predicted: p.predicted,
    })),
  ];
  const placed: { label: Label; l: number; r: number }[] = [];
  for (const label of candidates) {
    const w = label.text.length * CHAR_WIDTH;
    // Right of its point, unless that runs past the plot.
    const end = label.end || label.x + 6 + w > width;
    const l = end ? label.x - 6 - w : label.x + 6;
    const r = l + w;
    if (placed.some((p) => l < p.r + 4 && r > p.l - 4 && Math.abs(p.label.y - label.y) < 14)) continue;
    placed.push({ label: { ...label, end }, l, r });
  }
  const dots = [points[0], ...tierChanges, ...(hasFuture ? [last] : [])];
  // A smaller dot at every other step down, where other cards pass it (hollow when predicted).
  const drops = points.filter((p, i) => i > 0 && p.position !== points[i - 1].position && !dots.includes(p));

  const bands = tierBands(history).map((b) => ({
    tier: b.tier,
    top: b.from === Number.NEGATIVE_INFINITY ? plotT : Math.max(y(b.from), plotT),
    bottom: b.to === Number.POSITIVE_INFINITY ? plotB : Math.min(y(b.to), plotB),
    rule: b.to === Number.POSITIVE_INFINITY ? null : y(b.to),
  }));
  // A chip at the middle of each band, pushed down past the one above where bands are thinner than a chip.
  const chips: { tier: number; top: number }[] = [];
  for (const b of bands) {
    const prev = chips.at(-1);
    const top = Math.max((b.top + b.bottom) / 2 - CHIP_SIZE / 2, prev ? prev.top + CHIP_SIZE + 2 : 0);
    chips.push({ tier: b.tier, top });
  }
  const rankTickValues = rankTicks(minRank, maxRank);

  // Zooming keeps the view's middle where it was; the first zoom in from the whole life centres on today.
  const center = useRef(0.5);
  const prevZoom = useRef(zoom);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a zoom change is the trigger; the rest is read as it is then.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || prevZoom.current === zoom) return;
    if (prevZoom.current === 1 && showToday) center.current = todayX / width;
    prevZoom.current = zoom;
    el.scrollLeft = center.current * el.scrollWidth - el.clientWidth / 2;
  }, [zoom]);
  const onScroll = () => {
    const el = scroller.current;
    if (el) center.current = (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth;
  };

  // Dates: January as its year, other labelled months by name, every `step` months so the labels have room.
  const monthWidth = ((plotR - plotL) * 30.44 * DAY) / (to - from);
  const step = [1, 3, 6, 12].find((s) => s * monthWidth >= DATE_LABEL_GAP) ?? 24;
  const months = monthStarts(from, to).filter((m) => {
    const d = new Date(m);
    return (d.getUTCFullYear() * 12 + d.getUTCMonth()) % step === 0 && x(m) < plotR - 12;
  });
  const shownScenarios = scenarios
    .map((s) => ({
      ...s,
      left: Math.max(x(s.start), plotL),
      right: s.end === null ? plotR : Math.min(x(s.end), plotR),
    }))
    .filter((s) => s.right > s.left);

  return (
    <div className={clsx(styles.rankChart, className)} ref={ref}>
      <svg className={styles.rankAxis} width={AXIS_WIDTH} height={HEIGHT} aria-hidden="true">
        {rankTickValues.map((rank) => (
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
      <div className={clsx(styles.scroller, zoom > 1 && styles.zoomed)} ref={scroller} onScroll={onScroll}>
        {viewWidth > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={[
              current && t('chart.label', { start: t('common.rank', history[0]), now: t('common.rank', current) }),
              last.predicted && t('chart.labelPredicted', { end: t('common.rank', last), date: formatDay(last.date) }),
            ]
              .filter((label): label is string => Boolean(label))
              .join('. ')}
          >
            {rankTickValues.map((rank) => (
              <line key={rank} className={styles.grid} x1={0} x2={width} y1={y(rank)} y2={y(rank)} />
            ))}
            {bands.map((b) => (
              <g key={b.tier} style={tierStyle(b.tier + (b.rule === null ? 0 : 1))}>
                {b.rule !== null && b.rule > plotT && b.rule < plotB && (
                  <line className={styles.tierRule} x1={0} x2={width} y1={b.rule} y2={b.rule} />
                )}
              </g>
            ))}
            <line className={styles.baseline} x1={0} x2={width} y1={plotB} y2={plotB} />
            {months.map((m) => {
              const january = new Date(m).getUTCMonth() === 0;
              return (
                <g key={m}>
                  {january && <line className={styles.yearTick} x1={x(m)} x2={x(m)} y1={plotB} y2={plotB + 5} />}
                  <text
                    className={clsx(styles.axisLabel, january && styles.yearLabel)}
                    x={x(m)}
                    y={plotB + 16}
                    textAnchor="middle"
                  >
                    {january ? new Date(m).getUTCFullYear() : formatMonth(m)}
                  </text>
                </g>
              );
            })}
            {shownScenarios.map((s) => {
              const w = s.right - s.left;
              const name = scenarioName(s.key);
              return (
                <a
                  key={s.key}
                  href={scenarioUrl(s.key)}
                  className={clsx(styles.scenario, s.tag !== 'out' && styles.upcoming)}
                  style={scenarioStyle(s.color)}
                >
                  <title>
                    {t('timeline.scenarioTitle', {
                      name: s.name,
                      status: t(`timeline.scenarioTag.${s.tag}`),
                      dates:
                        s.end === null
                          ? t('timeline.since', { date: formatDate(s.start, { dateStyle: 'medium', timeZone: 'UTC' }) })
                          : formatDateRange(s.start, s.end, { dateStyle: 'medium', timeZone: 'UTC' }),
                    })}
                  </title>
                  {/* A taller transparent target than the 4px rule. */}
                  <rect className={styles.scenarioHit} x={s.left} y={plotB + 22} width={w} height={22} />
                  <rect
                    className={styles.scenarioRule}
                    x={s.left + 1}
                    y={plotB + 24}
                    width={Math.max(w - 2, 1)}
                    height={4}
                    rx={2}
                  />
                  {name.length * 6 + 4 <= w && (
                    <text className={styles.scenarioName} x={s.left + 2} y={plotB + 40}>
                      {name}
                    </text>
                  )}
                </a>
              );
            })}
            {showToday && (
              <g className={styles.today}>
                <line x1={todayX} x2={todayX} y1={plotT - 12} y2={plotB} />
                <text x={Math.min(Math.max(todayX, 20), width - 20)} y={plotT - 16} textAnchor="middle">
                  {t('timeline.today')}
                </text>
                {hasFuture && todayX + 90 < plotR && (
                  <text className={styles.future} x={todayX + 8} y={plotB - 8}>
                    {t('chart.predicted')}
                  </text>
                )}
              </g>
            )}
            {segments.map((s) => (
              <path
                key={s.key}
                className={clsx(styles.segment, s.predicted && styles.predicted)}
                style={tierStyle(s.tier)}
                d={s.d}
              />
            ))}
            {drops.map((p) => (
              <circle
                key={p.date}
                className={clsx(styles.dot, p.predicted && styles.predicted)}
                style={tierStyle(p.tier)}
                cx={p.x}
                cy={p.y}
                r={2.5}
              />
            ))}
            {dots.map((p) => (
              <circle
                key={p.date}
                className={clsx(styles.dot, p.predicted && styles.predicted)}
                style={tierStyle(p.tier)}
                cx={p.x}
                cy={p.y}
                r={4}
              />
            ))}
            {current && showToday && (
              <circle className={styles.dot} style={tierStyle(current.tier)} cx={todayX} cy={current.y} r={4} />
            )}
            {placed.map(({ label, l }) => (
              <text
                key={label.key}
                className={clsx(styles.label, label.predicted && styles.predicted)}
                x={l}
                y={label.y - 8}
              >
                {label.text}
              </text>
            ))}
            {onSelect &&
              points
                .filter((p, i) => i === 0 || p.overtakenBy.length > 0)
                .map((p) => (
                  // A finger-sized target over the marker.
                  // biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut; the Passed by list is the keyboard route to the same rows.
                  <circle
                    key={p.date}
                    className={styles.hit}
                    cx={p.x}
                    cy={p.y}
                    r={12}
                    onClick={() => onSelect(p.date)}
                  />
                ))}
          </svg>
        )}
      </div>
      <div className={styles.chips} style={{ width: CHIPS_WIDTH, height: HEIGHT }} aria-hidden="true">
        {chips.map((c) => (
          <span key={c.tier} className={styles.chip} style={{ top: c.top }}>
            <TierChip tier={c.tier} />
          </span>
        ))}
      </div>
    </div>
  );
}
