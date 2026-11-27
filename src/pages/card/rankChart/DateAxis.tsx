import clsx from 'clsx';
import { formatDate } from '../../../i18n/index.ts';
import type { MonthTick, Plot } from './layout.ts';
import styles from '../RankChart.module.css';

const formatMonth = (time: number): string => formatDate(time, { month: 'short', timeZone: 'UTC' });

export default function DateAxis({ months, plot, width }: { months: MonthTick[]; plot: Plot; width: number }) {
  return (
    <>
      <line className={styles.baseline} x1={0} x2={width} y1={plot.b} y2={plot.b} />
      {months.map((m) => (
        <g key={m.time}>
          {m.january && <line className={styles.yearTick} x1={m.x} x2={m.x} y1={plot.b} y2={plot.b + 5} />}
          <text
            className={clsx(styles.axisLabel, m.january && styles.yearLabel)}
            x={m.x}
            y={plot.b + 16}
            textAnchor="middle"
          >
            {m.january ? new Date(m.time).getUTCFullYear() : formatMonth(m.time)}
          </text>
        </g>
      ))}
    </>
  );
}
