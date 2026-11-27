import { ChevronRight, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Ranked } from '../../../tierlist/index.ts';
import { TIER_NAMES } from '../../lib/tiers.ts';
import CardTile from './CardTile.tsx';
import styles from './TierSection.module.css';

type TierSectionProps = {
  // The tier's place in TIER_NAMES (its colour too: .tier-0…).
  index: number;
  cards: Ranked[];
  collapsed: boolean;
  onToggle: (name: string) => void;
};

export default function TierSection({ index, cards, collapsed, onToggle }: TierSectionProps) {
  const { t } = useTranslation();
  const name = TIER_NAMES[index];
  return (
    <section className={styles.tier}>
      <button
        type="button"
        className={clsx(styles.tierLabel, `tier-${index}`)}
        onClick={() => onToggle(name)}
        aria-expanded={!collapsed}
        aria-label={t('tierList.toggleTier', { tier: name })}
        title={t('tierList.toggleTier', { tier: name })}
      >
        {!collapsed && <ChevronUp className={styles.tierFoldCue} size={16} aria-hidden="true" />}
        {name}
      </button>
      {collapsed ? (
        <button type="button" className={styles.tierFolded} onClick={() => onToggle(name)}>
          <ChevronRight size={16} aria-hidden="true" />
          {t('tierList.foldedCount', { count: cards.length })}
        </button>
      ) : (
        <div className={styles.tierCards}>
          {cards.map((card) => (
            <CardTile key={`${card.id}/${card.lb}`} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}
