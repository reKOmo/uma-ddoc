import { type Ref, useRef } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { formatDay } from '../../i18n/index.ts';
import { useDragScroll } from '../../hooks/useDragScroll.ts';
import { useWidth } from '../../hooks/useWidth.ts';
import type { HistoryPoint } from '../../lib/rankHistory.ts';
import { TIER_NAMES } from '../../lib/tiers.ts';
import type { ScenarioSegment } from '../../lib/scenarioStrip.ts';
import { rankChartLayout } from './rankChart/layout.ts';
import { useZoomCenter } from './rankChart/useZoomCenter.ts';
import RankAxis from './rankChart/RankAxis.tsx';
import ChartGrid from './rankChart/ChartGrid.tsx';
import DateAxis from './rankChart/DateAxis.tsx';
import ScenarioRule from './rankChart/ScenarioRule.tsx';
import TodayMarker from './rankChart/TodayMarker.tsx';
import RankLine from './rankChart/RankLine.tsx';
import TierChips from './rankChart/TierChips.tsx';
import styles from './RankChart.module.css';

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

// The card's whole life, at the panel's width or `zoom` times it (then scrolling sideways).
export default function RankChart({
  history,
  className,
  ref,
  onSelect,
  scenarios = [],
  height = 300,
  zoom = 1,
}: RankChartProps) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const viewWidth = useWidth(scroller);
  const width = viewWidth * zoom;
  useDragScroll(scroller, zoom > 1);

  const layout = rankChartLayout(history, {
    width,
    height,
    now: Date.now(),
    scenarios,
    rankText: (p) => t('common.rank', p),
    tierChangeText: (p) => t('chart.tierChange', { tier: TIER_NAMES[p.tier], rank: t('common.rank', p) }),
  });
  const { plot, points, current, last, todayX, showToday, hasFuture } = layout;
  const onScroll = useZoomCenter(scroller, zoom, showToday ? todayX / width : null);

  return (
    <div className={clsx(styles.rankChart, className)} ref={ref}>
      <RankAxis ticks={layout.rankTicks} height={height} />
      <div className={clsx(styles.scroller, zoom > 1 && styles.zoomed)} ref={scroller} onScroll={onScroll}>
        {viewWidth > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={[
              current && t('chart.label', { start: t('common.rank', history[0]), now: t('common.rank', current) }),
              last.predicted && t('chart.labelPredicted', { end: t('common.rank', last), date: formatDay(last.date) }),
            ]
              .filter((label): label is string => Boolean(label))
              .join('. ')}
          >
            <ChartGrid ticks={layout.rankTicks} bands={layout.bands} plot={plot} width={width} />
            <DateAxis months={layout.months} plot={plot} width={width} />
            {layout.scenarios.map((s) => (
              <ScenarioRule key={s.key} scenario={s} plot={plot} />
            ))}
            {showToday && <TodayMarker x={todayX} plot={plot} width={width} hasFuture={hasFuture} />}
            <RankLine
              segments={layout.segments}
              drops={layout.drops}
              dots={layout.dots}
              current={current}
              showToday={showToday}
              todayX={todayX}
              labels={layout.labels}
            />
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
      <TierChips chips={layout.chips} height={height} />
    </div>
  );
}
