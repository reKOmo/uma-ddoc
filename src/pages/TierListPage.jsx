import { useEffect, useState } from 'react';
import { ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { COMBINED, STATS, rankByUsefulness } from '../../tierlist/index.js';
import { metadata } from '../../tierlist/cards.js';
import { getServerConfig } from '../../tierlist/scenarios.js';
import source from '../../generated/SOURCE.json';
import { TIER_NAMES, toTiers } from '../tiers.js';
import { loadCardInfo } from '../cardInfo.js';
import { DEFAULTS, getFilters, isDefault, saveFilters } from '../tierListFilters.js';
import { useTranslation } from 'react-i18next';
import { lbName, statName } from '../i18n/index.js';
import Dropdown from '../Dropdown.jsx';
import ScenarioPicker from '../ScenarioPicker.jsx';
import BackToTop from '../BackToTop.jsx';

// Images from the same upstream commit as the card data.
const imageUrl = (id) =>
  `https://raw.githubusercontent.com/${source.repo}/${source.ref}/public/cardImages/support_card_s_${id}.png`;

const RARITIES = [3, 2, 1]; // SSR, SR, R
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
const searchText = (card, info) => {
  const meta = metadata[card.id] ?? {};
  const titles = info?.[card.id] ?? {};
  return normalize([card.char_name, meta.name_en, meta.name_jp, titles.title_en, titles.title_jp].join(' '));
};

// server and scenario are shared with the other pages via App; the other filters are remembered in
// src/tierListFilters.js.
export default function TierListPage({ server, scenario, onScenarioChange }) {
  const { t } = useTranslation();
  const [stat, setStat] = useState(() => getFilters().stat);
  const [ranking, setRanking] = useState(null);
  const [shown, setShown] = useState(() => getFilters().shown);
  const [query, setQuery] = useState(() => getFilters().query);
  // Card titles; until they load, a search matches character names only.
  const [cardInfo, setCardInfo] = useState(null);

  useEffect(() => {
    loadCardInfo().then(setCardInfo);
  }, []);

  useEffect(() => {
    saveFilters({ stat, shown, query });
  }, [stat, shown, query]);

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
  // Every word of the query must appear somewhere in the card's names.
  const words = normalize(query).split(' ').filter(Boolean);
  const matches = (card) => {
    if (words.length === 0) return true;
    const text = searchText(card, cardInfo);
    return words.every((word) => text.includes(word));
  };
  const isShown = (card) => shown[metadata[card.id]?.rarity]?.includes(card.lb) && matches(card);
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
            options={STATS.map((key) => ({ value: key, label: statName(key) }))}
            onChange={setStat}
          />
        </div>

        <details className="lb-filter">
          <summary>
            <SlidersHorizontal size={16} aria-hidden="true" />
            {t('tierList.filter')}
            <ChevronDown className="chevron" size={16} aria-hidden="true" />
          </summary>
          <div className="lb-rows">
            {RARITIES.map((rarity) => (
              <fieldset className="segmented" key={rarity} aria-label={t(`rarity.${rarity}`)}>
                <span className="rarity-label" aria-hidden="true">
                  {t(`rarity.${rarity}`)}
                </span>
                {LIMIT_BREAKS.map((lb) => (
                  <button
                    type="button"
                    key={lb}
                    aria-pressed={shown[rarity].includes(lb)}
                    onClick={() => toggle(rarity, lb)}
                  >
                    {lbName(lb)}
                  </button>
                ))}
              </fieldset>
            ))}
          </div>
          <button type="button" className="reset-filters" onClick={reset} disabled={atDefaults}>
            <RotateCcw size={14} aria-hidden="true" />
            {t('tierList.reset')}
          </button>
        </details>
      </aside>

      <div className="tier-list">
        {tiers === null ? (
          <p className="status">{t('common.calculating')}</p>
        ) : tiers.every((tier) => tier.length === 0) ? (
          <p className="status">{words.length > 0 ? t('tierList.noMatches', { query }) : t('tierList.noneShown')}</p>
        ) : (
          tiers.map(
            (tier, i) =>
              tier.length > 0 && (
                <section className="tier" key={TIER_NAMES[i]}>
                  <div className={`tier-label tier-${i}`}>{TIER_NAMES[i]}</div>
                  <div className="tier-cards">
                    {tier.map((card) => (
                      <a
                        className="card"
                        key={`${card.id}/${card.lb}`}
                        href={`#/card/${card.id}`}
                        title={card.char_name}
                      >
                        <figure>
                          <img src={imageUrl(card.id)} alt={card.char_name} loading="lazy" />
                          <span className="lb">{lbName(card.lb)}</span>
                          <figcaption>
                            <span className="name">{card.char_name}</span>
                            <span className="score">{card.score.toFixed(0)}</span>
                          </figcaption>
                        </figure>
                      </a>
                    ))}
                  </div>
                </section>
              )
          )
        )}
      </div>
      <BackToTop />
    </div>
  );
}
