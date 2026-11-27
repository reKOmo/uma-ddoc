import clsx from 'clsx';
import type { RankChartLayout } from './layout.ts';
import { tierStyle } from './tierStyle.ts';
import styles from '../RankChart.module.css';

type RankLineProps = Pick<
  RankChartLayout,
  'segments' | 'drops' | 'dots' | 'current' | 'showToday' | 'todayX' | 'labels'
>;

// The step line, its dots and its few labels.
export default function RankLine({ segments, drops, dots, current, showToday, todayX, labels }: RankLineProps) {
  return (
    <>
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
      {labels.map(({ label, l }) => (
        <text key={label.key} className={clsx(styles.label, label.predicted && styles.predicted)} x={l} y={label.y - 8}>
          {label.text}
        </text>
      ))}
    </>
  );
}
