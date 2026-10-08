import { useEffect, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { COMBINED, STATS, rankByUsefulness } from '../../tierlist/index.js';
import { metadata } from '../../tierlist/cards.js';
import { getServerConfig } from '../../tierlist/scenarios.js';
import source from '../../generated/SOURCE.json';
import { TIER_NAMES, toTiers } from '../tiers.js';
import { useTranslation } from 'react-i18next';
import { lbName, statName } from '../i18n/index.js';
import Dropdown from '../Dropdown.jsx';
import ScenarioPicker from '../ScenarioPicker.jsx';

// Images from the same upstream commit as the card data.
const imageUrl = (id) =>
  `https://raw.githubusercontent.com/${source.repo}/${source.ref}/public/cardImages/support_card_s_${id}.png`;

const RARITIES = [3, 2, 1]; // SSR, SR, R
const LIMIT_BREAKS = [0, 1, 2, 3, 4];
// Which limit breaks of each rarity are shown: MLB for all, plus LB0 and LB3 for SSR and SR.
const DEFAULT_SHOWN = { 3: [0, 3, 4], 2: [0, 3, 4], 1: [4] };

// server and scenario are shared with the other pages via App.
export default function TierListPage({ server, scenario, onScenarioChange }) {
  const { t } = useTranslation();
  const [stat, setStat] = useState('speed');
  const [ranking, setRanking] = useState(null);
  const [shown, setShown] = useState(DEFAULT_SHOWN);

  const toggle = (rarity, lb) =>
    setShown((s) => ({
      ...s,
      [rarity]: s[rarity].includes(lb) ? s[rarity].filter((n) => n !== lb) : [...s[rarity], lb],
    }));
  const isShown = (card) => shown[metadata[card.id]?.rarity]?.includes(card.lb);
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
    <div className="page">
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
      </details>

      {tiers === null ? (
        <p className="status">{t('common.calculating')}</p>
      ) : tiers.every((tier) => tier.length === 0) ? (
        <p className="status">{t('tierList.noneShown')}</p>
      ) : (
        tiers.map(
          (tier, i) =>
            tier.length > 0 && (
              <section className="tier" key={TIER_NAMES[i]}>
                <div className={`tier-label tier-${i}`}>{TIER_NAMES[i]}</div>
                <div className="tier-cards">
                  {tier.map((card) => (
                    <a className="card" key={`${card.id}/${card.lb}`} href={`#/card/${card.id}`} title={card.char_name}>
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
  );
}
