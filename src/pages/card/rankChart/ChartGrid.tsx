import type { Band, Plot, RankChartLayout } from './layout.ts';
import { tierStyle } from './tierStyle.ts';
import styles from '../RankChart.module.css';

type ChartGridProps = { ticks: RankChartLayout['rankTicks']; bands: Band[]; plot: Plot; width: number };

// A gridline per rank tick, and a rule where one tier gives way to the next.
export default function ChartGrid({ ticks, bands, plot, width }: ChartGridProps) {
  return (
    <>
      {ticks.map(({ rank, y }) => (
        <line key={rank} className={styles.grid} x1={0} x2={width} y1={y} y2={y} />
      ))}
      {bands.map((b) => (
        <g key={b.tier} style={tierStyle(b.tier + (b.rule === null ? 0 : 1))}>
          {b.rule !== null && b.rule > plot.t && b.rule < plot.b && (
            <line className={styles.tierRule} x1={0} x2={width} y1={b.rule} y2={b.rule} />
          )}
        </g>
      ))}
    </>
  );
}
