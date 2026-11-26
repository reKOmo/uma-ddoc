import { useTranslation } from 'react-i18next';
import type { Plot } from './layout.ts';
import styles from '../RankChart.module.css';

type TodayMarkerProps = { x: number; plot: Plot; width: number; hasFuture: boolean };

export default function TodayMarker({ x, plot, width, hasFuture }: TodayMarkerProps) {
  const { t } = useTranslation();
  return (
    <g className={styles.today}>
      <line x1={x} x2={x} y1={plot.t - 12} y2={plot.b} />
      <text x={Math.min(Math.max(x, 20), width - 20)} y={plot.t - 16} textAnchor="middle">
        {t('timeline.today')}
      </text>
      {hasFuture && x + 90 < plot.r && (
        <text className={styles.future} x={x + 8} y={plot.b - 8}>
          {t('chart.predicted')}
        </text>
      )}
    </g>
  );
}
