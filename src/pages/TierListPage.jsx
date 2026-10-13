import { useEffect, useState } from 'react';
import { ChevronRight, ChevronUp, ChevronsUpDown, RotateCcw, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { COMBINED, STATS, rankByUsefulness } from '../../tierlist/index.js';
import { cards } from '../../tierlist/cards.js';
import { getServerConfig } from '../../tierlist/scenarios.js';
import { TIER_NAMES, toTiers } from '../tiers.js';
import { cardIcon } from '../gametora.js';
import { DEFAULTS, SIZES, getFilters, isDefault, saveFilters } from '../tierListFilters.js';
import { useTranslation } from 'react-i18next';
import { lbName, statName } from '../i18n/index.js';
import Dropdown from '../Dropdown.jsx';
import ScenarioPicker from '../ScenarioPicker.jsx';
import BackToTop from '../BackToTop.jsx';
import { FilterButton, FilterSection, FilterSheet } from '../FilterSheet.jsx';
import { STAT_ICONS } from '../statIcons.js';

const RARITIES = ['SSR', 'SR', 'R'];
const LIMIT_BREAKS = [0, 1, 2, 3, 4];

// Lower case without accents or punctuation, so "tracen" finds "[Tracen Academy]".
const normalize = (text) =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC') // puts Japanese voiced marks back on their kana
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();

// Everything a search can match: the character's name and the card's title, in English and Japanese.
const searchText = (card) => {
  const { name, title } = cards[card.id];
  return normalize([card.char_name, name.en, name.jp, title.en, title.jp].join(' '));
};

// server and scenario are shared with the other pages via App; the other filters are remembered in
// src/tierListFilters.js.
export default function TierListPage({ server, scenario, onScenarioChange }) {
  const { t } = useTranslation();
  const [stat, setStat] = useState(() => getFilters().stat);
  const [ranking, setRanking] = useState(null);
  const [shown, setShown] = useState(() => getFilters().shown);
  const [query, setQuery] = useState(() => getFilters().query);
  // The cards' display size (a preference: "Reset filters" keeps it).
  const [size, setSize] = useState(() => getFilters().size);
  useEffect(() => {
    saveFilters({ stat, shown, query, size });
  }, [stat, shown, query, size]);
  // Tiers folded away by their label, to compare the others (for this visit only).
  const [collapsed, setCollapsed] = useState([]);
  const toggleTier = (name) => setCollapsed((c) => (c.includes(name) ? c.filter((n) => n !== name) : [...c, name]));

  const defaultScenario = getServerConfig(server).defaultScenario;
  const atDefaults = scenario === defaultScenario && isDefault({ stat, shown, query });
  const reset = () => {
    setStat(DEFAULTS.stat);
    setShown(DEFAULTS.shown);
    setQuery(DEFAULTS.query);
    onScenarioChange(defaultScenario);
  };

  const toggle = (rarity, lb) =>
    setShown((s) => ({
      ...s,
      [rarity]: s[rarity].includes(lb) ? s[rarity].filter((n) => n !== lb) : [...s[rarity], lb],
    }));
  const setRarity = (rarity, all) => setShown((s) => ({ ...s, [rarity]: all ? LIMIT_BREAKS : [] }));
  // The filter button's count: limit breaks shown or hidden unlike the defaults.
  const changed = RARITIES.reduce(
    (n, rarity) =>
      n + LIMIT_BREAKS.filter((lb) => shown[rarity].includes(lb) !== DEFAULTS.shown[rarity].includes(lb)).length,
    0
  );
  const [filterOpen, setFilterOpen] = useState(false);
  // Every word of the query must appear somewhere in the card's names.
  const words = normalize(query).split(' ').filter(Boolean);
  const matches = (card) => {
    if (words.length === 0) return true;
    const text = searchText(card);
    return words.every((word) => text.includes(word));
  };
  const isShown = (card) => shown[cards[card.id].rarity]?.includes(card.lb) && matches(card);
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
    <div className="page tier-list-page">
      {/* On desktop a sticky column on the left; on phones it stays above the tiers. */}
      <aside className="tier-sidebar">
        <div className="search-row">
          <div className="search">
            <Search className="search-icon" size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('tierList.searchPlaceholder')}
              aria-label={t('tierList.search')}
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label={t('tierList.clearSearch')}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <FilterButton
            count={changed}
            countTitle={t('tierList.changedCount', { count: changed })}
            onClick={() => setFilterOpen(true)}
          />
        </div>
        <div className="controls">
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
            onChange={setStat}
          />
        </div>

        <FilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          title={t('tierList.filterTitle')}
          action={
            <button type="button" className="reset-filters" onClick={reset} disabled={atDefaults}>
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
              chips={LIMIT_BREAKS.map((lb) => ({
                key: lb,
                label: lbName(lb),
                shown: shown[rarity].includes(lb),
                tone: `filter-rarity-${rarity}`,
              }))}
              onToggle={(lb) => toggle(rarity, lb)}
              onAll={(all) => setRarity(rarity, all)}
            />
          ))}
          <section className="filter-section">
            <div className="filter-section-head">
              <h3 id="card-size">{t('tierList.size.heading')}</h3>
            </div>
            <fieldset className="segmented size-picker" aria-labelledby="card-size">
              {SIZES.map((n) => (
                <button type="button" key={n} aria-pressed={size === n} onClick={() => setSize(n)}>
                  {t(`tierList.size.${n}`)}
                </button>
              ))}
            </fieldset>
          </section>
        </FilterSheet>
      </aside>

      <div className={`tier-list size-${size}`}>
        {collapsed.length > 0 && (
          <button type="button" className="reset-filters show-tiers" onClick={() => setCollapsed([])}>
            <ChevronsUpDown size={14} aria-hidden="true" />
            {t('tierList.showAllTiers', { count: collapsed.length })}
          </button>
        )}
        {tiers === null ? (
          <p className="status">{t('common.calculating')}</p>
        ) : tiers.every((tier) => tier.length === 0) ? (
          <p className="status">{words.length > 0 ? t('tierList.noMatches', { query }) : t('tierList.noneShown')}</p>
        ) : (
          tiers.map(
            (tier, i) =>
              tier.length > 0 && (
                <section className={clsx('tier', collapsed.includes(TIER_NAMES[i]) && 'collapsed')} key={TIER_NAMES[i]}>
                  <button
                    type="button"
                    className={`tier-label tier-${i}`}
                    onClick={() => toggleTier(TIER_NAMES[i])}
                    aria-expanded={!collapsed.includes(TIER_NAMES[i])}
                    aria-label={t('tierList.toggleTier', { tier: TIER_NAMES[i] })}
                    title={t('tierList.toggleTier', { tier: TIER_NAMES[i] })}
                  >
                    {/* The cue that it folds, pinned to the top of the strip (a folded tier's row has its own ›). */}
                    {!collapsed.includes(TIER_NAMES[i]) && (
                      <ChevronUp className="tier-fold-cue" size={16} aria-hidden="true" />
                    )}
                    {TIER_NAMES[i]}
                  </button>
                  {collapsed.includes(TIER_NAMES[i]) ? (
                    <button type="button" className="tier-folded" onClick={() => toggleTier(TIER_NAMES[i])}>
                      <ChevronRight size={16} aria-hidden="true" />
                      {t('tierList.foldedCount', { count: tier.length })}
                    </button>
                  ) : (
                    <div className="tier-cards">
                      {tier.map((card) => (
                        <a
                          className="card"
                          key={`${card.id}/${card.lb}`}
                          href={`#/card/${card.id}`}
                          title={card.char_name}
                        >
                          <figure>
                            <img src={cardIcon(card.id, cards)} alt={card.char_name} loading="lazy" />
                            <span className="lb">{lbName(card.lb)}</span>
                            <figcaption>
                              <span className="name">{card.char_name}</span>
                              <span className="score">{card.score.toFixed(0)}</span>
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
