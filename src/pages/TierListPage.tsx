import { useEffect, useState } from 'react';
import { ChevronRight, ChevronUp, ChevronsUpDown, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { COMBINED, STATS, rankByUsefulness } from '../../tierlist/index.ts';
import type { Ranked, Stat } from '../../tierlist/index.ts';
import { cards } from '../../tierlist/cards.ts';
import type { Server } from '../../tierlist/cards.ts';
import { getServerConfig } from '../../tierlist/scenarios.ts';
import { TIER_NAMES, toTiers } from '../tiers.ts';
import { cardIcon } from '../gametora.ts';
import { DEFAULTS, SIZES, getFilters, isDefault, saveFilters, useFiltersStore } from '../tierListFilters.ts';
import type { Rarity, Shown } from '../tierListFilters.ts';
import { useTranslation } from 'react-i18next';
import { lbName, statName } from '../i18n/index.ts';
import Dropdown from '../Dropdown.tsx';
import ScenarioPicker from '../ScenarioPicker.tsx';
import BackToTop from '../BackToTop.tsx';
import { FilterButton, FilterSection, FilterSheet } from '../FilterSheet.tsx';
import { STAT_ICONS } from '../statIcons.ts';
import { cardUrl } from '../routes.ts';
import { SearchInput } from '../ui/SearchInput.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import Status from '../ui/Status.tsx';
import styles from './TierListPage.module.css';

const RARITIES: Rarity[] = ['SSR', 'SR', 'R'];
const LIMIT_BREAKS = [0, 1, 2, 3, 4];

// Lower case without accents or punctuation, so "tracen" finds "[Tracen Academy]".
const normalize = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC') // puts Japanese voiced marks back on their kana
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();

// Everything a search can match: the character's name and the card's title, in English and Japanese.
const searchText = (card: Ranked): string => {
  const { name, title } = cards[card.id];
  return normalize([card.char_name, name.en, name.jp, title.en, title.jp].join(' '));
};

export type TierListPageProps = {
  server: Server;
  scenario: string;
  onScenarioChange: (scenario: string) => void;
};

// server and scenario are shared with the other pages via App; the other filters are remembered in
// src/tierListFilters.ts.
export default function TierListPage({ server, scenario, onScenarioChange }: TierListPageProps) {
  const { t } = useTranslation();
  const { stat, shown, query, size } = useFiltersStore((state) => state.filters);
  const [ranking, setRanking] = useState<Ranked[] | null>(null);
  // (The store remembers them across pages and reloads; the cards' size is a preference: "Reset filters" keeps it.)
  const setStat = (stat: Stat) => saveFilters({ ...getFilters(), stat });
  const setShown = (update: (shown: Shown) => Shown) =>
    saveFilters({ ...getFilters(), shown: update(getFilters().shown) });
  const setQuery = (query: string) => saveFilters({ ...getFilters(), query });
  const setSize = (size: number) => saveFilters({ ...getFilters(), size });
  // Tiers folded away by their label, to compare the others (for this visit only).
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const toggleTier = (name: string) =>
    setCollapsed((c) => (c.includes(name) ? c.filter((n) => n !== name) : [...c, name]));

  const defaultScenario = getServerConfig(server).defaultScenario;
  const atDefaults = scenario === defaultScenario && isDefault({ stat, shown, query });
  const reset = () => {
    saveFilters({ ...getFilters(), stat: DEFAULTS.stat, shown: DEFAULTS.shown, query: DEFAULTS.query });
    onScenarioChange(defaultScenario);
  };

  const toggle = (rarity: Rarity, lb: number) =>
    setShown((s) => ({
      ...s,
      [rarity]: s[rarity].includes(lb) ? s[rarity].filter((n) => n !== lb) : [...s[rarity], lb],
    }));
  const setRarity = (rarity: Rarity, all: boolean) => setShown((s) => ({ ...s, [rarity]: all ? LIMIT_BREAKS : [] }));
  // The filter button's count: limit breaks shown or hidden unlike the defaults.
  const changed = RARITIES.reduce(
    (n, rarity) =>
      n + LIMIT_BREAKS.filter((lb) => shown[rarity].includes(lb) !== DEFAULTS.shown[rarity].includes(lb)).length,
    0
  );
  const [filterOpen, setFilterOpen] = useState(false);
  // Every word of the query must appear somewhere in the card's names.
  const words = normalize(query).split(' ').filter(Boolean);
  const matches = (card: Ranked): boolean => {
    if (words.length === 0) return true;
    const text = searchText(card);
    return words.every((word) => text.includes(word));
  };
  const isShown = (card: Ranked): boolean => shown[cards[card.id].rarity]?.includes(card.lb) && matches(card);
  // Tiers come from the whole ranking, so a card's tier doesn't change with the filter.
  const tiers = ranking && toTiers(ranking).map((tier) => tier.filter(isShown));

  const scenarios = getServerConfig(server).availableScenarios;

  useEffect(() => {
    let cancelled = false;
    setRanking(null);
    // Ranking blocks for ~100-300 ms; yield first so "Calculating…" paints.
    setTimeout(() => {
      if (cancelled) return;
      rankByUsefulness(server, scenario, stat).then((r) => {
        if (!cancelled) setRanking(r);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [server, scenario, stat]);

  return (
    <div className={styles.root}>
      {/* On desktop a sticky column on the left; on phones it stays above the tiers. */}
      <aside className={styles.tierSidebar}>
        <div className={styles.searchRow}>
          <div className={styles.searchGrow}>
            <SearchInput
              value={query}
              onChange={setQuery}
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
            options={STATS.map((key) => ({ value: key, label: statName(key), icon: STAT_ICONS[key] }))}
            onChange={(value) => setStat(value as Stat)}
          />
        </div>

        <FilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          title={t('tierList.filterTitle')}
          action={
            <button
              type="button"
              className={clsx('reset-filters', styles.resetFilters)}
              onClick={reset}
              disabled={atDefaults}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('tierList.reset')}
            </button>
          }
        >
          <p className="filter-note">{t('tierList.filterNote')}</p>
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
              onToggle={(lb: number) => toggle(rarity, lb)}
              onAll={(all: boolean) => setRarity(rarity, all)}
            />
          ))}
          <section className="filter-section">
            <div className="filter-section-head">
              <h3 id="card-size">{t('tierList.size.heading')}</h3>
            </div>
            <Segmented
              className={styles.sizePicker}
              labelledBy="card-size"
              options={SIZES.map((n) => ({ value: n, label: t(`tierList.size.${n}`) }))}
              value={size}
              onChange={setSize}
            />
          </section>
        </FilterSheet>
      </aside>

      <div className={clsx(styles.tierList, styles[`size${size}`])}>
        {collapsed.length > 0 && (
          <button
            type="button"
            className={clsx(styles.resetFilters, styles.showTiers)}
            onClick={() => setCollapsed([])}
          >
            <ChevronsUpDown size={14} aria-hidden="true" />
            {t('tierList.showAllTiers', { count: collapsed.length })}
          </button>
        )}
        {tiers === null ? (
          <Status>{t('common.calculating')}</Status>
        ) : tiers.every((tier) => tier.length === 0) ? (
          <Status>{words.length > 0 ? t('tierList.noMatches', { query }) : t('tierList.noneShown')}</Status>
        ) : (
          tiers.map(
            (tier, i) =>
              tier.length > 0 && (
                <section className={styles.tier} key={TIER_NAMES[i]}>
                  <button
                    type="button"
                    className={clsx(styles.tierLabel, `tier-${i}`)}
                    onClick={() => toggleTier(TIER_NAMES[i])}
                    aria-expanded={!collapsed.includes(TIER_NAMES[i])}
                    aria-label={t('tierList.toggleTier', { tier: TIER_NAMES[i] })}
                    title={t('tierList.toggleTier', { tier: TIER_NAMES[i] })}
                  >
                    {/* The cue that it folds, pinned to the top of the strip (a folded tier's row has its own ›). */}
                    {!collapsed.includes(TIER_NAMES[i]) && (
                      <ChevronUp className={styles.tierFoldCue} size={16} aria-hidden="true" />
                    )}
                    {TIER_NAMES[i]}
                  </button>
                  {collapsed.includes(TIER_NAMES[i]) ? (
                    <button type="button" className={styles.tierFolded} onClick={() => toggleTier(TIER_NAMES[i])}>
                      <ChevronRight size={16} aria-hidden="true" />
                      {t('tierList.foldedCount', { count: tier.length })}
                    </button>
                  ) : (
                    <div className={styles.tierCards}>
                      {tier.map((card) => (
                        <a
                          className={styles.card}
                          key={`${card.id}/${card.lb}`}
                          href={cardUrl(card.id)}
                          title={card.char_name}
                        >
                          <figure>
                            <img src={cardIcon(card.id, cards)} alt={card.char_name} loading="lazy" />
                            <span className={styles.lb}>{lbName(card.lb)}</span>
                            <figcaption>
                              <span className={styles.name}>{card.char_name}</span>
                              <span className={styles.score}>{card.score.toFixed(0)}</span>
                            </figcaption>
                          </figure>
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              )
          )
        )}
      </div>
      <BackToTop />
    </div>
  );
}
