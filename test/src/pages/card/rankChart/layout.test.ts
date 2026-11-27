import { describe, expect, it } from 'vitest';
import type { HistoryPoint } from '../../../../../src/lib/rankHistory.ts';
import type { ScenarioSegment } from '../../../../../src/lib/scenarioStrip.ts';
import { rankChartLayout, rankTicks, tierBands } from '../../../../../src/pages/card/rankChart/layout.ts';

const point = (date: string, position: number, tier: number, predicted = false): HistoryPoint => ({
  date,
  position,
  total: 50,
  tier,
  overtakenBy: [],
  predicted,
});

const NOW = Date.parse('2025-06-15T12:00:00Z');
const layout = (history: HistoryPoint[], width = 600, scenarios: ScenarioSegment[] = []) =>
  rankChartLayout(history, {
    width,
    height: 300,
    now: NOW,
    scenarios,
    rankText: (p) => `#${p.position}`,
    tierChangeText: (p) => `Tier ${p.tier} · #${p.position}`,
  });

describe('rankTicks', () => {
  it('starts at #1 when the range does, then round steps', () => {
    expect(rankTicks(1, 20)).toEqual([1, 5, 10, 15, 20]);
    expect(rankTicks(40, 60)).toEqual([40, 45, 50, 55, 60]);
  });
});

describe('tierBands', () => {
  it('splits two tiers halfway between their nearest ranks, open at the ends', () => {
    expect(tierBands([point('2025-01-01', 3, 0), point('2025-02-01', 9, 1), point('2025-03-01', 12, 1)])).toEqual([
      { tier: 0, from: Number.NEGATIVE_INFINITY, to: 6 },
      { tier: 1, from: 6, to: Number.POSITIVE_INFINITY },
    ]);
  });
});

describe('rankChartLayout', () => {
  const history = [
    point('2025-01-01', 2, 0),
    point('2025-03-01', 5, 0),
    point('2025-05-01', 12, 1),
    point('2025-08-01', 20, 2, true),
  ];

  it('draws each step as a drop then a flat run, dashed from today on', () => {
    const { segments, todayX, points } = layout(history);
    expect(segments.map((s) => [s.key, s.predicted])).toEqual([
      ['2025-01-01', false],
      ['2025-03-01', false],
      ['2025-05-01', false],
      ['2025-05-01-next', true],
      ['2025-08-01', true],
    ]);
    expect(segments[0].d).toBe(`M${points[0].x},${points[0].y}H${points[1].x}`);
    expect(segments[2].d).toBe(`M${points[2].x},${points[1].y}V${points[2].y}H${todayX}`);
    expect(segments[3].d).toBe(`M${todayX},${points[2].y}H${points[3].x}`);
  });

  it('labels the release, today and each tier change', () => {
    const { labels } = layout(history);
    expect(labels.map((l) => [l.label.key, l.label.text])).toEqual([
      ['release', '#2'],
      ['now', '#12'],
      // (May's tier change would run into today's label on the same rank: today's comes first)
      ['tier-2025-08-01', 'Tier 2 · #20'],
    ]);
  });

  it('dots the release, the tier changes and the last prediction, a smaller dot at the other drops', () => {
    const { dots, drops } = layout([...history.slice(0, 3), point('2025-08-01', 20, 1, true)]);
    expect(dots.map((p) => p.date)).toEqual(['2025-01-01', '2025-05-01', '2025-08-01']);
    expect(drops.map((p) => p.date)).toEqual(['2025-03-01']);
  });

  it('dots a last prediction that is also a tier change once', () => {
    expect(layout(history).dots.map((p) => p.date)).toEqual(['2025-01-01', '2025-05-01', '2025-08-01']);
  });

  it("drops a label that would overlap one already placed, and flips one left that would run off the plot's end", () => {
    // Two steps a day apart at the same rank: the second's label lands on the first's.
    const close = [point('2025-01-01', 5, 0), point('2025-01-02', 5, 1)];
    expect(layout(close).labels.map((l) => l.label.key)).toEqual(['release', 'now']);
    const narrow = layout([point('2025-01-01', 5, 0)], 20);
    expect(narrow.labels[0].label.end).toBe(true);
    expect(narrow.labels[0].l).toBeLessThan(narrow.points[0].x);
  });

  it('places tier bands inside the plot and stacks chips that would overlap', () => {
    const { bands, chips, plot } = layout(history);
    expect(bands.map((b) => b.tier)).toEqual([0, 1, 2]);
    expect(bands[0].top).toBe(plot.t);
    expect(bands[2].bottom).toBe(plot.b);
    expect(bands[2].rule).toBeNull();
    for (let i = 1; i < chips.length; i++) expect(chips[i].top).toBeGreaterThanOrEqual(chips[i - 1].top + 22);
  });

  it('hides today for a card still to come, and clips scenarios to the plot', () => {
    const upcoming = layout([point('2025-09-01', 3, 0, true)]);
    expect(upcoming.showToday).toBe(false);
    expect(upcoming.labels.map((l) => l.label.key)).toEqual(['release']);
    const scenario: ScenarioSegment = {
      key: 'a',
      name: 'A',
      start: Date.parse('2024-01-01'),
      end: null,
      tag: 'out',
      color: null,
      current: true,
      ink: null,
    };
    const { scenarios, plot } = layout(history, 600, [scenario]);
    expect(scenarios.map((s) => [s.left, s.right])).toEqual([[plot.l, plot.r]]);
  });
});
