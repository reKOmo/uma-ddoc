import type { HistoryPoint } from '../../../lib/rankHistory.ts';
import { DAY, dayStart } from '../../../lib/dates.ts';
import type { ScenarioSegment } from '../../../lib/scenarioStrip.ts';

// The rank axis and the tier chips sit in their own columns outside the scroller, so they stay put; in the scroller,
// room above the plot for "Today", below for the dates and the scenario rule, and a little at each end for the dots.
export const AXIS_WIDTH = 36;
export const CHIPS_WIDTH = 32;
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

// Round ticks from lo up to hi, about `count` of them (1, 5, 10… or 40, 50, 60…): lo itself only when it's #1.
export function rankTicks(lo: number, hi: number, count = 4): number[] {
  const raw = (hi - lo) / count;
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => s >= raw) ?? 100;
  const ticks = lo === 1 ? [1] : [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) if (t > 1 && t >= lo) ticks.push(t);
  return ticks;
}

// The ranks the axis spans: the card's own, with a little room above (from #1 when it's near the top), so a card that
// has only ever ranked #40–60 doesn't leave the chart's top half empty.
export function rankRange(history: HistoryPoint[]): { lo: number; hi: number } {
  const positions = history.map((p) => p.position);
  const min = Math.min(...positions);
  const hi = Math.max(...positions, min + 1);
  const room = Math.max(1, Math.ceil((hi - min) * 0.1));
  const lo = min - room <= 3 ? 1 : min - room;
  return { lo, hi };
}

export function monthStarts(from: number, to: number): number[] {
  const d = new Date(from);
  const months: number[] = [];
  for (let m = d.getUTCMonth() + 1; ; m++) {
    const t = Date.UTC(d.getUTCFullYear(), m, 1);
    if (t > to) return months;
    months.push(t);
  }
}

// A band per tier the card is in over time, from the ranks it holds in each: the line between two tiers halfway between
// the last rank of one and the first of the next.
export function tierBands(points: HistoryPoint[]): { tier: number; from: number; to: number }[] {
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

export type ChartPoint = HistoryPoint & { x: number; y: number };
type Label = { key: string; x: number; y: number; text: string; tier: number; predicted: boolean; end?: boolean };
export type PlacedLabel = { label: Label; l: number; r: number };
export type Plot = { l: number; r: number; t: number; b: number };
export type Band = { tier: number; top: number; bottom: number; rule: number | null };
export type Segment = { key: string; d: string; tier: number; predicted: boolean };
export type MonthTick = { time: number; x: number; january: boolean };
export type ShownScenario = ScenarioSegment & { left: number; right: number };

export type RankChartLayoutOptions = {
  width: number;
  height: number;
  now: number;
  scenarios: ScenarioSegment[];
  // The labels' texts (translated by the caller; their length decides where they fit).
  rankText: (point: ChartPoint) => string;
  tierChangeText: (point: ChartPoint) => string;
};

// The card's whole life across `width`: its rank as a step line in the colour of the tier it's in, dashed once it's
// predicted. Labelled only at its release, today, the last prediction and each tier change.
export function rankChartLayout(
  history: HistoryPoint[],
  { width, height, now, scenarios, rankText, tierChangeText }: RankChartLayoutOptions
) {
  const from = dayStart(history[0].date);
  const to = Math.max(from + MIN_SPAN, Math.max(now, dayStart(history[history.length - 1].date)) + TAIL);
  const { lo: minRank, hi: maxRank } = rankRange(history);
  const plot: Plot = { l: MARGIN.side, r: width - MARGIN.side, t: MARGIN.top, b: height - MARGIN.bottom };
  const x = (time: number): number => plot.l + ((time - from) / (to - from)) * (plot.r - plot.l);
  const y = (rank: number): number => plot.t + ((rank - minRank) / (maxRank - minRank || 1)) * (plot.b - plot.t);

  const points: ChartPoint[] = history.map((p) => ({ ...p, x: x(dayStart(p.date)), y: y(p.position) }));
  const current = points.filter((p) => !p.predicted).at(-1);
  const last = points[points.length - 1];
  // Today, or the last real step if that's later (a release dated today in another time zone).
  const todayX = Math.max(x(now), current?.x ?? 0);
  // Not for a card still to come: today is before its line starts.
  const showToday = now >= from;
  const hasFuture = last.predicted;

  // Each step: the drop into it, then its flat part to the next, in its tier's colour; the step running through today
  // turns dashed there.
  const segments: Segment[] = points.flatMap((p, i) => {
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
      text: rankText(points[0]),
      tier: points[0].tier,
      predicted: points[0].predicted,
    },
    ...(current && showToday
      ? [
          {
            key: 'now',
            x: todayX,
            y: current.y,
            text: rankText(current),
            tier: current.tier,
            predicted: false,
            end: true,
          },
        ]
      : []),
    // (unless it's a tier change: that label says its rank too)
    ...(hasFuture && last !== points[0] && !tierChanges.includes(last)
      ? [{ key: 'end', x: last.x, y: last.y, text: rankText(last), tier: last.tier, predicted: true, end: true }]
      : []),
    ...tierChanges.map((p) => ({
      key: `tier-${p.date}`,
      x: p.x,
      y: p.y,
      text: tierChangeText(p),
      tier: p.tier,
      predicted: p.predicted,
    })),
  ];
  const labels: PlacedLabel[] = [];
  for (const label of candidates) {
    const w = label.text.length * CHAR_WIDTH;
    // Right of its point, unless that runs past the plot.
    const end = label.end || label.x + 6 + w > width;
    const l = end ? label.x - 6 - w : label.x + 6;
    const r = l + w;
    if (labels.some((p) => l < p.r + 4 && r > p.l - 4 && Math.abs(p.label.y - label.y) < 14)) continue;
    labels.push({ label: { ...label, end }, l, r });
  }
  // (a Set: the last prediction can also be a tier change, and one point is one dot)
  const dots = [...new Set([points[0], ...tierChanges, ...(hasFuture ? [last] : [])])];
  // A smaller dot at every other step down, where other cards pass it (hollow when predicted).
  const drops = points.filter((p, i) => i > 0 && p.position !== points[i - 1].position && !dots.includes(p));

  const bands: Band[] = tierBands(history).map((b) => ({
    tier: b.tier,
    top: b.from === Number.NEGATIVE_INFINITY ? plot.t : Math.max(y(b.from), plot.t),
    bottom: b.to === Number.POSITIVE_INFINITY ? plot.b : Math.min(y(b.to), plot.b),
    rule: b.to === Number.POSITIVE_INFINITY ? null : y(b.to),
  }));
  // A chip at the middle of each band, pushed down past the one above where bands are thinner than a chip.
  const chips: { tier: number; top: number }[] = [];
  for (const b of bands) {
    const prev = chips.at(-1);
    const top = Math.max((b.top + b.bottom) / 2 - CHIP_SIZE / 2, prev ? prev.top + CHIP_SIZE + 2 : 0);
    chips.push({ tier: b.tier, top });
  }
  const rankTickValues = rankTicks(minRank, maxRank).map((rank) => ({ rank, y: y(rank) }));

  // Dates: January as its year, other labelled months by name, every `step` months so the labels have room.
  const monthWidth = ((plot.r - plot.l) * 30.44 * DAY) / (to - from);
  const step = [1, 3, 6, 12].find((s) => s * monthWidth >= DATE_LABEL_GAP) ?? 24;
  const months: MonthTick[] = monthStarts(from, to)
    .filter((m) => {
      const d = new Date(m);
      return (d.getUTCFullYear() * 12 + d.getUTCMonth()) % step === 0 && x(m) < plot.r - 12;
    })
    .map((m) => ({ time: m, x: x(m), january: new Date(m).getUTCMonth() === 0 }));
  const shownScenarios: ShownScenario[] = scenarios
    .map((s) => ({
      ...s,
      left: Math.max(x(s.start), plot.l),
      right: s.end === null ? plot.r : Math.min(x(s.end), plot.r),
    }))
    .filter((s) => s.right > s.left);

  return {
    plot,
    points,
    current,
    last,
    todayX,
    showToday,
    hasFuture,
    segments,
    labels,
    dots,
    drops,
    bands,
    chips,
    rankTicks: rankTickValues,
    months,
    scenarios: shownScenarios,
  };
}

export type RankChartLayout = ReturnType<typeof rankChartLayout>;
