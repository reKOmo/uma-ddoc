import { useMemo, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';
import { COMBINED, STATS, rankByUsefulness } from '../../tierlist/index.ts';
import type { Ranked, Stat } from '../../tierlist/index.ts';
import { cards } from '../../tierlist/cards.ts';
import type { Server } from '../../tierlist/cards.ts';
import { getCurrentScenario, getServerConfig } from '../../tierlist/scenarios.ts';
import { matchesSearch, searchWords } from '../lib/cardSearch.ts';
import { TIER_NAMES, toTiers } from '../lib/tiers.ts';
import { changedCount, isDefault, patchFilters, resetFilters, useFiltersStore } from '../state/tierListFilters.ts';
import { useTranslation } from 'react-i18next';
import { statName } from '../i18n/index.ts';
import Dropdown from '../ui/Dropdown.tsx';
import ScenarioPicker from '../ui/ScenarioPicker.tsx';
import BackToTop from '../ui/BackToTop.tsx';
import { FilterButton, ResetButton } from '../ui/FilterSheet.tsx';
import TypePill from '../ui/TypePill.tsx';
import { useRanking } from '../hooks/useRanking.ts';
import { SearchInput } from '../ui/SearchInput.tsx';
import Status from '../ui/Status.tsx';
import TierFilters from './tierList/TierFilters.tsx';
import TierSection from './tierList/TierSection.tsx';
import styles from './TierListPage.module.css';

type TierListPageProps = {
  server: Server;
  scenario: string;
  onScenarioChange: (scenario: string) => void;
};

export default function TierListPage({ server, scenario, onScenarioChange }: TierListPageProps) {
  const { t } = useTranslation();
  const { stat, shown, query, size } = useFiltersStore((state) => state.filters);
  const ranking = useRanking(() => rankByUsefulness(server, scenario, stat), [server, scenario, stat]);
  // Tiers folded away by their label, to compare the others (for this visit only).
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const toggleTier = (name: string) =>
    setCollapsed((c) => (c.includes(name) ? c.filter((n) => n !== name) : [...c, name]));

  const defaultScenario = getCurrentScenario(server);
  const atDefaults = scenario === defaultScenario && isDefault({ stat, shown, query });
  const reset = () => {
    resetFilters();
    onScenarioChange(defaultScenario);
  };

  const changed = changedCount(shown);
  const [filterOpen, setFilterOpen] = useState(false);
  const words = useMemo(() => searchWords(query), [query]);
  // Tiers come from the whole ranking, so a card's tier doesn't change with the filter.
  const allTiers = useMemo(() => ranking && toTiers(ranking), [ranking]);
  const tiers = useMemo(() => {
    const isShown = (card: Ranked): boolean =>
      shown[cards[card.id].rarity]?.includes(card.lb) && matchesSearch(card, words, cards);
    return allTiers ? allTiers.map((tier) => tier.filter(isShown)) : null;
  }, [allTiers, shown, words]);

  const scenarios = getServerConfig(server).availableScenarios;

  return (
    <div className={styles.root}>
      <aside className={styles.tierSidebar}>
        <div className={styles.searchRow}>
          <div className={styles.searchGrow}>
            <SearchInput
              value={query}
              onChange={(query: string) => patchFilters({ query })}
              placeholder={t('tierList.searchPlaceholder')}
              label={t('tierList.search')}
              clearLabel={t('tierList.clearSearch')}
            />
          </div>
          <FilterButton
            disabled={false}
            count={changed}
            countTitle={t('tierList.changedCount', { count: changed })}
            onClick={() => setFilterOpen(true)}
          />
        </div>
        <div className={styles.controls}>
          <ScenarioPicker
            label={t('common.scenario')}
            value={scenario}
            scenarios={scenarios}
            combined={Object.keys(COMBINED)}
            server={server}
            onChange={onScenarioChange}
          />
          <Dropdown
            label={t('common.stat')}
            value={stat}
            options={STATS.map((key) => ({ value: key, label: statName(key), content: <TypePill stat={key} plain /> }))}
            onChange={(value) => patchFilters({ stat: value as Stat })}
          />
        </div>

        <TierFilters open={filterOpen} onClose={() => setFilterOpen(false)} atDefaults={atDefaults} onReset={reset} />
      </aside>

      <div className={clsx(styles.tierList, styles[`size${size}`])}>
        {collapsed.length > 0 && (
          <ResetButton icon={ChevronsUpDown} className={styles.showTiers} onClick={() => setCollapsed([])}>
            {t('tierList.showAllTiers', { count: collapsed.length })}
          </ResetButton>
        )}
        {tiers === null ? (
          <Status>{t('common.calculating')}</Status>
        ) : tiers.every((tier) => tier.length === 0) ? (
          <Status>{words.length > 0 ? t('tierList.noMatches', { query }) : t('tierList.noneShown')}</Status>
        ) : (
          tiers.map(
            (tier, i) =>
              tier.length > 0 && (
                <TierSection
                  key={TIER_NAMES[i]}
                  index={i}
                  cards={tier}
                  collapsed={collapsed.includes(TIER_NAMES[i])}
                  onToggle={toggleTier}
                />
              )
          )
        )}
      </div>
      <BackToTop />
    </div>
  );
}
