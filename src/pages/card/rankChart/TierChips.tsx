import TierChip from '../../../ui/TierChip.tsx';
import { CHIPS_WIDTH, type RankChartLayout } from './layout.ts';
import styles from '../RankChart.module.css';

export default function TierChips({ chips, height }: { chips: RankChartLayout['chips']; height: number }) {
  return (
    <div className={styles.chips} style={{ width: CHIPS_WIDTH, height }} aria-hidden="true">
      {chips.map((c) => (
        <span key={c.tier} className={styles.chip} style={{ top: c.top }}>
          <TierChip tier={c.tier} />
        </span>
      ))}
    </div>
  );
}
