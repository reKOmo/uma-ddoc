import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronUp, ExternalLink } from 'lucide-react';
import { COMBINED, STATS, rankByUsefulness, scenarioOptions, scenariosOf } from '../../tierlist/index.js';
import { loadCards, metadata } from '../../tierlist/cards.js';
import { NAME_FIELD } from '../../tierlist/join-cards.js';
import { getScenario, getServerConfig } from '../../tierlist/scenarios.js';
import { TIER_NAMES, cardRanks } from '../tiers.js';
import { rankHistory } from '../rankHistory.js';
import { loadPredictions } from '../predictions.js';
import { loadCardInfo } from '../cardInfo.js';
import RankChart, { formatDay } from './RankChart.jsx';
import { Trans, useTranslation } from 'react-i18next';
import { formatDuration, lbName, scenarioName, serverName, statName } from '../i18n/index.js';
import './card.css';

const LIMIT_BREAKS = [0, 1, 2, 3, 4];
const TITLE_FIELD = { gl: 'title_en', jp: 'title_jp' };
const RELEASE_FIELD = { gl: 'release_gl', jp: 'release_jp' };
const iconUrl = (id) => `https://gametora.com/images/umamusume/supports/support_card_s_${id}.png`;
const artUrl = (id) => `https://gametora.com/images/umamusume/supports/tex_support_card_${id}.png`;

// A name for cards our metadata only has in Japanese, from GameTora's URL ("…/30126-yamanin-zephyr").
const slugName = (url) =>
  url
    .split('/')
    .pop()
    .split('-')
    .slice(1)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');

function displayName(id, server, cardInfo) {
  const meta = metadata[id];
  const url = cardInfo?.[id]?.url;
  return meta?.[NAME_FIELD[server]] ?? (server === 'gl' && url ? slugName(url) : (meta?.name_en ?? meta?.name_jp));
}

// The server's predicted release dates (only Global has them), or null without any.
function usePredictions(server) {
  const [predictions, setPredictions] = useState(undefined);
  useEffect(() => {
    if (server !== 'gl') {
      setPredictions(null);
      return;
    }
    let cancelled = false;
    loadPredictions().then((p) => !cancelled && setPredictions(p));
    return () => {
      cancelled = true;
    };
  }, [server]);
  return predictions;
}

// The ranking with the server's upcoming cards in it, computed after the page has painted.
function useUpcomingRanking(server, scenario, stat, enabled) {
  const [ranking, setRanking] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setRanking(null);
    if (!enabled) return;
    const timer = setTimeout(async () => {
      const result = await rankByUsefulness(server, scenario, stat, { upcoming: true });
      if (!cancelled) setRanking(result);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [server, scenario, stat, enabled]);
  return ranking;
}

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
  const [cardInfo, setCardInfo] = useState(null);
  // null while loading, then whether the selected server has this card.
  const [released, setReleased] = useState(null);

  useEffect(() => {
    loadCardInfo().then(setCardInfo);
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
  const predictions = usePredictions(server);
  const predicted = predictions?.cards[cardId];

  if (!meta) {
    return (
      <div className="page card-page">
        <p className="status">{t('card.notFound', { id: cardId })}</p>
      </div>
    );
  }

  const name = displayName(cardId, server, cardInfo);
  const scenarios = getServerConfig(server).availableScenarios;
  const combined = Object.keys(COMBINED);
  const rankOverTime = (
    <RankOverTime
      cardId={cardId}
      server={server}
      scenarios={scenarios}
      combined={combined}
      defaultScenario={scenario}
      rankings={rankings}
      cardInfo={cardInfo}
      predictions={predictions}
      stat={stat}
    />
  );
  const info = cardInfo?.[cardId];
  const title = info && (info[TITLE_FIELD[server]] ?? info.title_en ?? info.title_jp);

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
          {info?.url && (
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
      ) : !released && predicted ? (
        <>
          <p className="status">
            {t(predicted.confirmed ? 'card.notReleasedConfirmed' : 'card.notReleasedPredicted', {
              server: serverName(server),
              date: formatDay(predicted.predicted_gl),
            })}
          </p>
          {rankOverTime}
        </>
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

          {rankOverTime}
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

// Upcoming (predicted) passes listed before the rest are folded behind "See more".
const UPCOMING_SHOWN = 2;

// How the card's position in its tier list changed as newer cards came out and, where the
// server has predicted release dates (Global), how it will change as JP's cards arrive.
function RankOverTime({ cardId, server, scenarios, combined, defaultScenario, rankings, cardInfo, predictions, stat }) {
  const { t } = useTranslation();
  const [scenario, setScenario] = useState(defaultScenario);
  const [lb, setLb] = useState(4);
  // Which card's passes are unfolded, so following a "See card" link folds them again.
  const [unfolded, setUnfolded] = useState(null);
  const allPasses = unfolded === cardId;
  // The server's scenario list can change under us; fall back to the page's.
  const shown = scenarios.includes(scenario) || combined.includes(scenario) ? scenario : defaultScenario;
  const upcoming = useUpcomingRanking(server, shown, stat, !!predictions);
  // undefined predictions = still loading them.
  const ranking = predictions === undefined ? null : predictions ? upcoming : rankings[shown];

  const released = (id) => cardInfo?.[id]?.[RELEASE_FIELD[server]] ?? null;
  const releaseOf = (id) => released(id) ?? predictions?.cards[id]?.predicted_gl ?? null;
  const isPredicted = (id) => !released(id) && !!predictions?.cards[id];
  const history = ranking && cardInfo && rankHistory(ranking, cardId, lb, releaseOf, isPredicted);
  const nameOf = (id) => displayName(id, server, cardInfo);
  const info = (id) => cardInfo?.[id];
  const titleOf = (id) => info(id)?.[TITLE_FIELD[server]] ?? info(id)?.title_jp ?? '';
  const passes = history ? history.filter((p) => p.overtakenBy.length > 0) : [];
  // Past passes, then only the next UPCOMING_SHOWN predicted ones until "See more"; one more is drawn fading out.
  const firstUpcoming = passes.findIndex((p) => p.predicted);
  const foldedCount = firstUpcoming < 0 ? passes.length : firstUpcoming + UPCOMING_SHOWN;
  const foldable = passes.length > foldedCount;
  const shownCount = allPasses ? passes.length : foldedCount;
  const hiddenCount = Math.max(0, passes.length - shownCount);
  const actual = history?.filter((p) => !p.predicted) ?? [];
  const now = actual.at(-1);
  const end = history?.at(-1);
  // The first predicted date it sits in a lower tier than it does today.
  const drop = now && history.find((p) => p.predicted && p.tier > now.tier);

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

      {!ranking || !cardInfo ? (
        <p className="status">{t('common.ranking')}</p>
      ) : !history ? (
        <p className="status">{t('card.noReleaseDate', { server: serverName(server) })}</p>
      ) : (
        <>
          <p className="history-summary">
            {now ? (
              <Trans
                i18nKey="card.historySummary"
                values={{
                  date: formatDay(history[0].date),
                  start: history[0].position,
                  startTotal: history[0].total,
                  now: now.position,
                  nowTotal: now.total,
                }}
                components={{ strong: <strong /> }}
              />
            ) : (
              <Trans
                i18nKey="card.arrivalSummary"
                values={{ date: formatDay(history[0].date), start: history[0].position, startTotal: history[0].total }}
                components={{ strong: <strong /> }}
              />
            )}
            {end.predicted && (
              <>
                {' '}
                <Trans
                  i18nKey="card.predictedSummary"
                  values={{ date: formatDay(end.date), end: end.position, endTotal: end.total }}
                  components={{ strong: <strong /> }}
                />
              </>
            )}
            {now && end.predicted && (
              <>
                {' '}
                {drop
                  ? t('card.tierDrop', {
                      from: TIER_NAMES[now.tier],
                      to: TIER_NAMES[drop.tier],
                      date: formatDay(drop.date),
                    })
                  : t('card.tierHolds', { tier: TIER_NAMES[now.tier], date: formatDay(end.date) })}
              </>
            )}
          </p>
          <RankChart history={history} nameOf={nameOf} />
          <p className="rank-note">
            {t('card.historyNote', {
              lb: lbName(lb),
              stat: statName(stat),
              server: serverName(server),
              scenario: scenarioName(shown),
            })}
            {predictions && ` ${t('card.predictedNote')}`}
          </p>

          <h3 className="passed-heading">{t('card.passedBy')}</h3>
          {passes.length === 0 ? (
            <p className="status">{t('card.noneAbove')}</p>
          ) : (
            <div className="passed-box">
              <ol className="passed-list">
                <li className={timelineClass(!now, passes[0])}>
                  <div className="passed-entry">
                    <span className="passed-dot" />
                    <div className="passed-head">
                      <span className="passed-date">
                        {t(now ? 'card.releasedOn' : 'card.arrivesOn', { date: formatDay(history[0].date) })}
                      </span>
                      <strong>{t('common.rankOf', history[0])}</strong>
                    </div>
                  </div>
                  {passes[0] && (
                    <span className="passed-gap">
                      {t('card.passedAfter', { duration: formatDuration(history[0].date, passes[0].date) })}
                    </span>
                  )}
                </li>
                {passes.slice(0, shownCount + 1).map((point, i) => {
                  const next = passes[i + 1];
                  const fading = i === shownCount;
                  return (
                    <li
                      key={point.date}
                      className={timelineClass(point.predicted, next, fading && 'passed-fade')}
                      inert={fading || undefined}
                    >
                      <div className="passed-entry">
                        <span className="passed-dot" />
                        <div className="passed-head">
                          <span className="passed-date">{formatDay(point.date)}</span>
                          {point.predicted && <span className="badge-predicted">{t('card.predicted')}</span>}
                        </div>
                        <div className="passed-body">
                          <RankChange point={point} history={history} />
                          <ul className="passed-cards">
                            {point.overtakenBy.map((c) => (
                              <li key={c.id}>
                                <a className="passed-card" href={`#/card/${c.id}`}>
                                  <img src={iconUrl(c.id)} alt="" loading="lazy" />
                                  <span>
                                    <strong>{nameOf(c.id)}</strong>
                                    {titleOf(c.id) && <small>{titleOf(c.id)}</small>}
                                  </span>
                                </a>
                                <a className="see-more" href={`#/card/${c.id}`}>
                                  {t('card.seeCard')}
                                  <ChevronRight size={15} aria-hidden="true" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {next && (
                        <span className="passed-gap">
                          {t('card.passedLater', { duration: formatDuration(point.date, next.date) })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              {hiddenCount > 0 && (
                <button type="button" className="see-more passed-more" onClick={() => setUnfolded(cardId)}>
                  {t('card.morePasses', { count: hiddenCount })}
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
              )}
              {allPasses && foldable && (
                <button type="button" className="see-more passed-less" onClick={() => setUnfolded(null)}>
                  {t('card.showLess')}
                  <ChevronUp size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// A timeline row's classes: whether its own date is predicted, and whether a line runs on to
// the next date (dashed when that one is predicted).
function timelineClass(predicted, next, ...more) {
  return [predicted && 'predicted', next && 'has-next', next?.predicted && 'next-predicted', ...more]
    .filter(Boolean)
    .join(' ');
}

// The card's new position on a date, with an arrow for whether it rose or fell since the date before.
function RankChange({ point, history }) {
  const { t } = useTranslation();
  const before = history[history.indexOf(point) - 1];
  const change = before ? Math.sign(before.position - point.position) : 0;
  const Arrow = change > 0 ? ArrowUp : change < 0 ? ArrowDown : null;
  return (
    <span className={`passed-rank${change > 0 ? ' up' : change < 0 ? ' down' : ''}`}>
      {Arrow && <Arrow size={15} aria-label={t(change > 0 ? 'card.rankUp' : 'card.rankDown')} />}
      {t('common.rank', point)}
    </span>
  );
}
