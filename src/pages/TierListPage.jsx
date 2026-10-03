import { useEffect, useState } from 'react';
import { COMBINED, STATS, rankByUsefulness } from '../../tierlist/index.js';
import { getServerConfig } from '../../tierlist/scenarios.js';
import source from '../../generated/SOURCE.json';
import { SERVERS } from '../servers.js';
import { TIER_NAMES, toTiers } from '../tiers.js';
import { useTranslation } from 'react-i18next';
import { lbName, scenarioName, serverName, statName } from '../i18n/index.js';

// Images from the same upstream commit as the card data.
const imageUrl = (id) =>
  `https://raw.githubusercontent.com/${source.repo}/${source.ref}/public/cardImages/support_card_s_${id}.png`;

// server and scenario are shared with the other pages via App.
export default function TierListPage({ server, scenario, onServerChange, onScenarioChange }) {
  const { t } = useTranslation();
  const [stat, setStat] = useState('speed');
  const [ranking, setRanking] = useState(null);

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
      <h1>{t('tierList.title')}</h1>
      <div className="controls">
        <label>
          {t('common.server')}
          <select value={server} onChange={(e) => onServerChange(e.target.value)}>
            {Object.keys(SERVERS).map((key) => (
              <option key={key} value={key}>
                {serverName(key)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('common.scenario')}
          <select value={scenario} onChange={(e) => onScenarioChange(e.target.value)}>
            {scenarios.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
            <optgroup label={t('common.averaged')}>
              {Object.keys(COMBINED).map((key) => (
                <option key={key} value={key}>
                  {scenarioName(key)}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label>
          {t('common.stat')}
          <select value={stat} onChange={(e) => setStat(e.target.value)}>
            {STATS.map((key) => (
              <option key={key} value={key}>
                {statName(key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ranking === null ? (
        <p className="status">{t('common.calculating')}</p>
      ) : (
        toTiers(ranking).map((tier, i) => (
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
        ))
      )}
    </div>
  );
}
