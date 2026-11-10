import clsx from 'clsx';
import type { Stat } from '../../tierlist/index.ts';
import { STAT_ICONS } from '../statIcons.ts';
import styles from './StatIcon.module.css';

// A card type's game icon, sized to the text around it. Decorative beside the type's name; `label` when it stands alone.
export default function StatIcon({ stat, label, className }: { stat: Stat; label?: string; className?: string }) {
  return <img className={clsx(styles.icon, className)} src={STAT_ICONS[stat]} alt={label ?? ''} />;
}
