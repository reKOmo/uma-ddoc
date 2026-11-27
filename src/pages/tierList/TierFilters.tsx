import { useTranslation } from 'react-i18next';
import { LIMIT_BREAKS } from '../../lib/tiers.ts';
import {
  RARITIES,
  SIZES,
  patchFilters,
  showRarity,
  toggleLimitBreak,
  useFiltersStore,
} from '../../state/tierListFilters.ts';
import { lbName } from '../../i18n/index.ts';
import { FilterGroup, FilterSection, FilterSheet, ResetButton } from '../../ui/FilterSheet.tsx';
import { Segmented } from '../../ui/Segmented.tsx';
import styles from './TierFilters.module.css';

type TierFiltersProps = {
  open: boolean;
  onClose: () => void;
  atDefaults: boolean;
  onReset: () => void;
};

export default function TierFilters({ open, onClose, atDefaults, onReset }: TierFiltersProps) {
  const { t } = useTranslation();
  const { shown, size } = useFiltersStore((state) => state.filters);
  return (
    <FilterSheet
      open={open}
      onClose={onClose}
      title={t('tierList.filterTitle')}
      action={
        <ResetButton onClick={onReset} disabled={atDefaults}>
          {t('tierList.reset')}
        </ResetButton>
      }
      note={t('tierList.filterNote')}
    >
      {RARITIES.map((rarity) => (
        <FilterSection
          key={rarity}
          heading={t(`rarity.${rarity}`)}
          note={undefined}
          off={false}
          chips={LIMIT_BREAKS.map((lb) => ({
            key: lb,
            label: lbName(lb),
            shown: shown[rarity].includes(lb),
            tone: `filter-rarity-${rarity}`,
          }))}
          onToggle={(lb: number) => toggleLimitBreak(rarity, lb)}
          onAll={(all: boolean) => showRarity(rarity, all)}
        />
      ))}
      <FilterGroup heading={t('tierList.size.heading')} headingId="card-size">
        <Segmented
          className={styles.sizePicker}
          labelledBy="card-size"
          options={SIZES.map((n) => ({ value: n, label: t(`tierList.size.${n}`) }))}
          value={size}
          onChange={(size: number) => patchFilters({ size })}
        />
      </FilterGroup>
    </FilterSheet>
  );
}
