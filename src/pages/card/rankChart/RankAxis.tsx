import { useTranslation } from 'react-i18next';
import { AXIS_WIDTH, type RankChartLayout } from './layout.ts';
import styles from '../RankChart.module.css';

export default function RankAxis({ ticks, height }: { ticks: RankChartLayout['rankTicks']; height: number }) {
  const { t } = useTranslation();
  return (
    <svg className={styles.rankAxis} width={AXIS_WIDTH} height={height} aria-hidden="true">
      {ticks.map(({ rank, y }) => (
        <text
          key={rank}
          className={styles.axisLabel}
          x={AXIS_WIDTH - 6}
          y={y}
          textAnchor="end"
          dominantBaseline="middle"
        >
          {t('common.rank', { position: rank })}
        </text>
      ))}
    </svg>
  );
}
