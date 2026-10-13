import clsx from 'clsx';
import { TIER_NAMES } from '../tiers.ts';
import styles from './TierChip.module.css';

export type TierChipProps = {
  tier?: number;
  pending?: boolean;
  title?: string;
  className?: string;
};

export default function TierChip({ tier, pending = false, title, className }: TierChipProps) {
  if (tier === undefined || pending) {
    return (
      <span className={clsx(styles.tierChip, styles.pending, className)} title={title}>
        {pending ? '…' : '–'}
      </span>
    );
  }
  return (
    <span className={clsx(styles.tierChip, `tier-${tier}`, className)} title={title}>
      {TIER_NAMES[tier]}
    </span>
  );
}
