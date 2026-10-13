// The button that folds or unfolds a list: `moreLabel` with a down chevron while folded, `lessLabel` with an up
// chevron once expanded (the card page's "N more" / "Show less").
//
// <FoldToggle expanded={unfolded} onToggle={() => setUnfolded(!unfolded)} moreLabel="2 more" lessLabel="Show less" />

import { ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import styles from './FoldToggle.module.css';

export type FoldToggleProps = {
  expanded: boolean;
  onToggle: () => void;
  moreLabel: string;
  lessLabel: string;
  className?: string;
};

export default function FoldToggle({ expanded, onToggle, moreLabel, lessLabel, className }: FoldToggleProps) {
  return (
    <button type="button" className={clsx(styles.foldToggle, className)} onClick={onToggle}>
      {expanded ? lessLabel : moreLabel}
      {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
    </button>
  );
}
