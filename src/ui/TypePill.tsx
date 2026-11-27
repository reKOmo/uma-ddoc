import clsx from 'clsx';
import { STATS, type Stat } from '../../tierlist/index.ts';
import { statName } from '../i18n/index.ts';
import Pill from './Pill.tsx';
import StatIcon from './StatIcon.tsx';
import styles from './TypePill.module.css';

export const isStat = (value: string): value is Stat => (STATS as readonly string[]).includes(value);

// A card type, everywhere one is shown: its icon and name, on a pill tinted in the type's colour, or `plain` (inline
// in a row, a chip or a dropdown).
export default function TypePill({ stat, plain = false }: { stat: Stat; plain?: boolean }) {
  const content = (
    <>
      <StatIcon stat={stat} />
      {statName(stat)}
    </>
  );
  return plain ? (
    <span className={clsx(styles.pill, styles.plain)} data-tone={`type-${stat}`}>
      {content}
    </span>
  ) : (
    <Pill variant="tinted" tone={`type-${stat}`} className={clsx(styles.pill, styles.tinted)}>
      {content}
    </Pill>
  );
}
