import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import ShouldPullChip from './ShouldPullChip.tsx';
import styles from './ShouldPullLine.module.css';

// "Should pull? [If Whale+]" as a line of a list (a banner's cards, a card's banners).
export default function ShouldPullLine({ pill, className }: { pill: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={clsx(styles.line, className)}>
      {t('pullGuide.shouldPull')}
      <ShouldPullChip pill={pill} className={styles.chip} />
    </span>
  );
}
