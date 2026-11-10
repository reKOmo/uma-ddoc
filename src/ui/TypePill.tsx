import clsx from 'clsx';
import { STATS, type Stat } from '../../tierlist/index.ts';
import { statName } from '../i18n/index.ts';
import StatIcon from './StatIcon.tsx';
import styles from './TypePill.module.css';

export const isStat = (value: string): value is Stat => (STATS as readonly string[]).includes(value);

// A card type, everywhere one is shown: its icon and name, on a pill tinted in the type's colour, or `plain` (inline
// in a row, a chip or a dropdown).
export default function TypePill({ stat, plain = false }: { stat: Stat; plain?: boolean }) {
  return (
    <span className={clsx(styles.pill, plain ? styles.plain : styles.tinted)} data-tone={`type-${stat}`}>
      <StatIcon stat={stat} />
      {statName(stat)}
    </span>
  );
}
