import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { COMBINED, STATS, rankByUsefulness, scenarioOptions, scenariosOf } from '../../tierlist/index.js';
import { loadCards, metadata } from '../../tierlist/cards.js';
import { NAME_FIELD } from '../../tierlist/join-cards.js';
import { getScenario, getServerConfig } from '../../tierlist/scenarios.js';
import { TIER_NAMES, cardRanks } from '../tiers.js';
import { rankHistory } from '../rankHistory.js';
import RankChart, { formatDay } from './RankChart.jsx';
import { Trans, useTranslation } from 'react-i18next';
import { lbName, scenarioName, serverName, statName } from '../i18n/index.js';
import './card.css';

const LIMIT_BREAKS = [0, 1, 2, 3, 4];
const TITLE_FIELD = { gl: 'title_en', jp: 'title_jp' };
const RELEASE_FIELD = { gl: 'release_gl', jp: 'release_jp' };
const iconUrl = (id) => `https://gametora.com/images/umamusume/supports/support_card_s_${id}.png`;
const artUrl = (id) => `https://gametora.com/images/umamusume/supports/tex_support_card_${id}.png`;

// Only downloaded when a card page opens.
const loadGametora = () => import('../../generated/gametora_cards.json').then((m) => m.default);

// The tier list tab a card type ranks under (the type ids are the same in every scenario).
function statOf(server, type) {
  const scenario = getScenario(server, getServerConfig(server).defaultScenario);
  return STATS.find((stat) => scenario[stat].type === type);
}

// Rankings for every scenario, then the averaged ones (cheap once the real ones
// are cached), filled in one at a time so rows appear as they finish.
function useScenarioRankings(server, stat, enabled) {
  const [rankings, setRankings] = useState({});
  useEffect(() => {
    let cancelled = false;
    setRankings({});
    if (!enabled) return;
    (async () => {
      for (const scenario of scenarioOptions(server)) {
        // Each ranking blocks for ~100-300 ms; yield first so the page paints.
        await new Promise((resolve) => setTimeout(resolve));
        if (cancelled) return;
        const ranking = await rankByUsefulness(server, scenario, stat);
        if (cancelled) return;
        setRankings((prev) => ({ ...prev, [scenario]: ranking }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [server, stat, enabled]);
  return rankings;
}

export default function CardPage({ cardId, server, scenario }) {
  const { t } = useTranslation();
  const meta = metadata[cardId];
  const [gametora, setGametora] = useState(null);
  // null while loading, then whether the selected server has this card.
  const [released, setReleased] = useState(null);

  useEffect(() => {
    loadGametora().then(setGametora);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReleased(null);
    loadCards(server).then((cards) => {
      if (!cancelled) setReleased(cards.some((c) => c.id === cardId));
    });
    return () => {
      cancelled = true;
    };
  }, [server, cardId]);

  const stat = meta && statOf(server, meta.type);
  const rankings = useScenarioRankings(server, stat, !!stat && released === true);

  if (!meta) {
    return (
      <div className="page card-page">
        <p className="status">{t('card.notFound', { id: cardId })}</p>
      </div>
    );
  }

  const name = meta[NAME_FIELD[server]] ?? meta.name_en ?? meta.name_jp;
  const info = gametora?.[cardId];
  const title = info && (info[TITLE_FIELD[server]] ?? info.title_en ?? info.title_jp);
  const scenarios = getServerConfig(server).availableScenarios;
  const combined = Object.keys(COMBINED);

  return (
    <div className="page card-page">
      <div className="card-hero">
        <img className="card-art" src={artUrl(cardId)} alt={name} />
        <div className="card-facts">
          <h1>{name}</h1>
          {title && <p className="card-title">{title}</p>}
          <p className="card-tags">
            <span className="tag">{t(`rarity.${meta.rarity}`)}</span>
            {stat && <span className="tag">{statName(stat)}</span>}
            {meta.group && <span className="tag">{t('card.group')}</span>}
          </p>
          {info && (
            <a className="gametora-link" href={info.url} target="_blank" rel="noreferrer">
              {t('card.viewOnGameTora')}
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <h2 className="card-section">{t('card.tierByScenario')}</h2>
      {released === null ? (
        <p className="status">{t('common.loading')}</p>
      ) : !released ? (
        <p className="status">{t('card.notReleased', { server: serverName(server) })}</p>
      ) : (
        <>
          <table className="scenario-tiers">
            <thead>
              <tr>
                <th scope="col">{t('common.scenario')}</th>
                {LIMIT_BREAKS.map((lb) => (
                  <th key={lb} scope="col">
                    {lbName(lb)}
                  </th>
                ))}
                <th scope="col" className="position">
                  {t('card.mlbRank')}
                </th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((key) => (
                <ScenarioRow
                  key={key}
                  scenario={key}
                  ranking={rankings[key]}
                  cardId={cardId}
                  current={key === scenario}
                />
              ))}
            </tbody>
            <tbody className="averaged">
              {combined.map((key) => (
                <ScenarioRow
                  key={key}
                  scenario={key}
                  ranking={rankings[key]}
                  cardId={cardId}
                  current={key === scenario}
                />
              ))}
            </tbody>
          </table>
          <p className="rank-note">
            {t('card.tableNote', { stat: statName(stat), server: serverName(server) })}{' '}
            {combined
              .map((key) => t('card.averages', { name: scenarioName(key), scenarios: scenariosOf(server, key) }))
              .join(' ')}
          </p>

          <RankOverTime
            cardId={cardId}
            server={server}
            scenarios={scenarios}
            combined={combined}
            defaultScenario={scenario}
            rankings={rankings}
            gametora={gametora}
            stat={stat}
          />
        </>
      )}
    </div>
  );
}

function ScenarioRow({ scenario, ranking, cardId, current }) {
  const { t } = useTranslation();
  const ranks = ranking && cardRanks(ranking);
  const mlb = ranks?.get(`${cardId}/4`);
  return (
    <tr className={current ? 'current' : undefined}>
      <th scope="row">{scenarioName(scenario)}</th>
      {LIMIT_BREAKS.map((lb) => {
        const rank = ranks?.get(`${cardId}/${lb}`);
        return (
          <td key={lb}>
            {!ranks ? (
              <span className="tier-chip pending">…</span>
            ) : rank ? (
              <span className={`tier-chip tier-${rank.tier}`} title={t('common.rankOf', rank)}>
                {TIER_NAMES[rank.tier]}
              </span>
            ) : (
              <span className="tier-chip pending">–</span>
            )}
          </td>
        );
      })}
      <td className="position">{mlb ? t('card.rankSlash', mlb) : ranks ? '–' : ''}</td>
    </tr>
  );
}

// How the card's position in its tier list changed as newer cards came out.
function RankOverTime({ cardId, server, scenarios, combined, defaultScenario, rankings, gametora, stat }) {
  const { t } = useTranslation();
  const [scenario, setScenario] = useState(defaultScenario);
  const [lb, setLb] = useState(4);
  // The server's scenario list can change under us; fall back to the page's.
  const shown = scenarios.includes(scenario) || combined.includes(scenario) ? scenario : defaultScenario;
  const ranking = rankings[shown];

  const releaseOf = (id) => gametora?.[id]?.[RELEASE_FIELD[server]] ?? null;
  const history = ranking && gametora && rankHistory(ranking, cardId, lb, releaseOf);
  const nameOf = (id) => ranking.find((c) => c.id === id)?.char_name ?? `#${id}`;
  const titleOf = (id) => gametora?.[id]?.[TITLE_FIELD[server]] ?? '';
  const passes = history ? history.filter((p) => p.overtakenBy.length > 0).reverse() : [];

  return (
    <section>
      <h2 className="card-section">{t('card.rankOverTime')}</h2>
      <div className="history-controls">
        <label>
          {t('common.scenario')}
          <select value={shown} onChange={(e) => setScenario(e.target.value)}>
            {scenarios.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
            <optgroup label={t('common.averaged')}>
              {combined.map((key) => (
                <option key={key} value={key}>
                  {scenarioName(key)}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <fieldset className="segmented" aria-label={t('card.limitBreak')}>
          {LIMIT_BREAKS.map((n) => (
            <button type="button" key={n} aria-pressed={n === lb} onClick={() => setLb(n)}>
              {lbName(n)}
            </button>
          ))}
        </fieldset>
      </div>

      {!ranking || !gametora ? (
        <p className="status">{t('common.ranking')}</p>
      ) : !history ? (
        <p className="status">{t('card.noReleaseDate', { server: serverName(server) })}</p>
      ) : (
        <>
          <p className="history-summary">
            <Trans
              i18nKey="card.historySummary"
              values={{
                date: formatDay(history[0].date),
                start: history[0].position,
                startTotal: history[0].total,
                now: history.at(-1).position,
                nowTotal: history.at(-1).total,
              }}
              components={{ strong: <strong /> }}
            />
          </p>
          <RankChart history={history} nameOf={nameOf} />
          <p className="rank-note">
            {t('card.historyNote', {
              lb: lbName(lb),
              stat: statName(stat),
              server: serverName(server),
              scenario: scenarioName(shown),
            })}
          </p>

          <h3 className="passed-heading">{t('card.passedBy')}</h3>
          {passes.length === 0 ? (
            <p className="status">{t('card.noneAbove')}</p>
          ) : (
            <ul className="passed-list">
              {passes.map((point) => (
                <li key={point.date}>
                  <span className="passed-date">
                    {formatDay(point.date)}
                    <span>{t('card.passedTo', { rank: t('common.rank', point) })}</span>
                  </span>
                  <span className="passed-cards">
                    {point.overtakenBy.map((c) => (
                      <a key={c.id} href={`#/card/${c.id}`} title={titleOf(c.id)}>
                        <img src={iconUrl(c.id)} alt="" loading="lazy" />
                        {nameOf(c.id)}
                      </a>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
