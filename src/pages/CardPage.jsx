import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronUp, ExternalLink } from 'lucide-react';
import { COMBINED, rankByUsefulness, scenarioOptions, scenariosOf } from '../../tierlist/index.js';
import { cards, loadCards } from '../../tierlist/cards.js';
import { getServerConfig } from '../../tierlist/scenarios.js';
import { TIER_NAMES, cardRanks } from '../tiers.js';
import { rankHistory } from '../rankHistory.js';
import { loadPredictions } from '../predictions.js';
import { currentAdvice, latestAdvice, loadPullGuide, sheetLink, upcomingBanner } from '../pullGuide.js';
import { loadBanners } from '../bannerData.js';
import { cardArt, cardIcon, cardPage } from '../gametora.js';
import StatusBadge from '../StatusBadge.jsx';
import ScenarioPicker from '../ScenarioPicker.jsx';
import RankChart, { formatDay } from './RankChart.jsx';
import { Trans, useTranslation } from 'react-i18next';
import { formatDate, formatDuration, lbName, scenarioName, serverName, statName } from '../i18n/index.js';
import { timeZoneOptions, useSettings } from '../settings.jsx';
import './card.css';

const LIMIT_BREAKS = [0, 1, 2, 3, 4];
// The language of a server's names and titles in cards.json.
const LANGUAGE = { gl: 'en', jp: 'jp' };
const nameOf = (id, server) => cards[id]?.name[LANGUAGE[server]] ?? cards[id]?.name.jp;
const titleOf = (id, server) => cards[id]?.title[LANGUAGE[server]] ?? cards[id]?.title.jp ?? null;

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

// The tier list tab a card type ranks under (cards.json's types are its stat keys, plus group).
const statOf = (type) => (type === 'group' ? 'friend' : type);

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
  const card = cards[cardId];
  // null while loading, then whether the selected server has this card.
  const [released, setReleased] = useState(null);

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

  const stat = card && statOf(card.type);
  const rankings = useScenarioRankings(server, stat, !!stat && released === true);
  const predictions = usePredictions(server);
  const predicted = predictions?.cards[cardId];

  if (!card) {
    return (
      <div className="page card-page">
        <p className="status">{t('card.notFound', { id: cardId })}</p>
      </div>
    );
  }

  const name = nameOf(cardId, server);
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
      predictions={predictions}
      stat={stat}
    />
  );
  const title = titleOf(cardId, server) ?? card.title.en;

  return (
    <div className="page card-page">
      <div className="card-hero">
        <img className="card-art" src={cardArt(cardId)} alt={name} />
        <div className="card-facts">
          <h1>{name}</h1>
          {title && <p className="card-title">{title}</p>}
          <p className="card-tags">
            <span className="tag">{t(`rarity.${card.rarity}`)}</span>
            {stat && <span className="tag">{statName(stat)}</span>}
            {card.type === 'group' && <span className="tag">{t('card.group')}</span>}
          </p>
          {card.links.gametora && (
            <a className="gametora-link" href={cardPage(card.links.gametora)} target="_blank" rel="noreferrer">
              {t('card.viewOnGameTora')}
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <PullAdvice cardId={cardId} />

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
      ) : !released && card.release[server] ? (
        <p className="status">{t('card.notRanked', { server: serverName(server) })}</p>
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
              .map((key) =>
                t('card.averages', { name: scenarioName(key), scenarios: scenariosOf(server, key).map(scenarioName) })
              )
              .join(' ')}
          </p>

          {rankOverTime}
        </>
      )}
    </div>
  );
}

// The pull guide's advice for the card's next Global banner (or the one running now; real or predicted),
// with links to that banner on the Timeline and to the card's row in the guide; for event / story / shop
// cards, their release as the guide gives it; "no upcoming banners" when none is to come. Nothing while
// it loads, without the guide, or for cards it doesn't cover.
function PullAdvice({ cardId }) {
  const { t } = useTranslation();
  const { timeZone } = useSettings().settings;
  const [guide, setGuide] = useState(null);
  const [banners, setBanners] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadPullGuide().then((g) => !cancelled && setGuide(g));
    loadBanners('global').then((b) => !cancelled && setBanners(b.cards));
    return () => {
      cancelled = true;
    };
  }, []);
  const latest = guide && latestAdvice(guide, cardId);
  if (!latest || !banners) return null;
  const now = Date.now();
  const banner = upcomingBanner(banners, cardId, now);
  const entry = currentAdvice(guide, cardId, banner, new Date(now).toISOString().slice(0, 10));
  // A card on no banner: what it is ("Event", "Story"…) and when, from the guide.
  const release = !banner && entry?.release;
  const label = banner
    ? !banner.featured.find((item) => item.id === cardId).new && t('pullGuide.rerun')
    : release?.label;

  return (
    <section className="pull-guide">
      <div className="pull-entry">
        {/* The banner's art behind it, as on the Timeline's bars. */}
        <div
          className={banner ? `pull-banner has-art${banner.announced ? ' official-art' : ''}` : 'pull-banner'}
          style={banner ? { backgroundImage: `url(${banner.image})` } : undefined}
        >
          <h2 className="pull-heading">{t('pullGuide.upcomingBanner')}</h2>
          {banner || release ? (
            <>
              <p className="pull-when">
                {banner ? <BannerDates banner={banner} timeZone={timeZone} /> : releaseDate(release, t)}
              </p>
              {(label || banner) && (
                <div className="pull-head">
                  {label && <span className="pull-label">{label}</span>}
                  {banner && (
                    <a className="gametora-link pull-banner-link" href={`#/timeline/gl/${banner.id}`}>
                      {t('pullGuide.seeBanner')}
                      <ChevronRight size={16} aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="status">{t('pullGuide.noUpcoming')}</p>
          )}
        </div>

        {entry && (entry.shouldPull || entry.comment || entry.advice) && (
          <div className="pull-should">
            <h2 className="pull-heading">
              {t('pullGuide.shouldPull')}
              {entry.shouldPull && <ShouldPullChip pill={entry.shouldPull} />}
            </h2>
            {entry.comment && <p className="pull-advice">{entry.comment}</p>}
            {entry.freePulls && <p className="pull-free">{t('pullGuide.freePulls', { count: entry.freePulls })}</p>}
            {entry.advice && <p className="pull-note">{entry.advice}</p>}
          </div>
        )}
        <div className="pull-actions">
          <a className="gametora-link" href={sheetLink(entry ?? latest)} target="_blank" rel="noreferrer">
            {t('pullGuide.seeMore')}
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

// The "Should pull?" pill: "whale++" → "If Whale++".
function ShouldPullChip({ pill }) {
  const { t } = useTranslation();
  const [, kind, plus] = pill.match(/^(\w+)(\+*)$/);
  return <span className={`verdict-chip verdict-${kind}`}>{t(`pullGuide.verdict.${kind}`) + plus}</span>;
}

// The banner's status badge and dates, in the Settings timezone, as in the Timeline's banner sheet.
function BannerDates({ banner, timeZone }) {
  const { t } = useTranslation();
  const format = (iso) =>
    formatDate(iso, { ...timeZoneOptions(timeZone), year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <>
      <StatusBadge banner={banner} />
      <span className="pull-dates">
        {t('common.dateRange', { start: format(banner.start), end: format(banner.end) })}
      </span>
    </>
  );
}

// A release's date as the guide gives it: a day, or early / late in a month for estimates.
function releaseDate(release, t) {
  if (release.date) return formatDay(release.date);
  if (!release.month) return release.dateText ?? '';
  const month = formatDay(`${release.month}-01`, { year: 'numeric', month: 'short' });
  return t(`pullGuide.${release.part ?? 'month'}`, { month });
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
function RankOverTime({ cardId, server, scenarios, combined, defaultScenario, rankings, predictions, stat }) {
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

  const released = (id) => cards[id]?.release[server] ?? null;
  const releaseOf = (id) => released(id) ?? predictions?.cards[id]?.predicted_gl ?? null;
  const isPredicted = (id) => !released(id) && !!predictions?.cards[id];
  const history = ranking && rankHistory(ranking, cardId, lb, releaseOf, isPredicted);
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
        <ScenarioPicker
          label={t('common.scenario')}
          value={shown}
          scenarios={scenarios}
          combined={combined}
          server={server}
          onChange={setScenario}
        />
        <fieldset className="segmented" aria-label={t('card.limitBreak')}>
          {LIMIT_BREAKS.map((n) => (
            <button type="button" key={n} aria-pressed={n === lb} onClick={() => setLb(n)}>
              {lbName(n)}
            </button>
          ))}
        </fieldset>
      </div>

      {!ranking ? (
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
          <RankChart history={history} nameOf={(id) => nameOf(id, server)} />
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
                                  <img src={cardIcon(c.id, cards)} alt="" loading="lazy" />
                                  <span>
                                    <strong>{nameOf(c.id, server)}</strong>
                                    {titleOf(c.id, server) && <small>{titleOf(c.id, server)}</small>}
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
