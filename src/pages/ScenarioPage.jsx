// One Career scenario (#/scenario/<key>): its key art, names, launch on each server (status, how
// long ago / until, predicted range), Global's lag behind JP (under the arrow between them), links to GameTora and its tier list,
// and the scenarios before / after it. Opened from the scenario strip on the banner calendar.

import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getServerConfig } from '../../tierlist/scenarios.js';
import { formatDate, formatDateTime, formatDuration, scenarioName, serverName } from '../i18n/index.js';
import { DATE_FIELD, SCENARIOS, isCurrent, scenarioByKey } from '../scenarioRelease.js';
import { ink } from '../timeline/scenarioStrip.js';
import { timeZoneOptions, useSettings } from '../settings.jsx';
import './card.css'; // shared: .card-tags, .tag, .card-section
import './scenario.css';

const day = (ms) => new Date(ms).toISOString().slice(0, 10);
// scenario.links that are pages to visit (the rest, like `cover`, are images), in this order, each with a
// scenarioPage.link.<key> name: GameTora's page, and the launch post on umapyoi.net (JP's in Japanese, Global's).
const LINKS = {
  gametora: (url) => url,
  umapyoi_jp: (id) => `https://umapyoi.net/news/${id}?lang=jp`,
  umapyoi_gl: (id) => `https://umapyoi.net/en/news/${id}`,
};

// Server-agnostic: both servers' launches side by side, "Newest on …" for each server it's the latest on.
const SERVER_ORDER = ['jp', 'gl'];

export default function ScenarioPage({ scenarioKey, onScenarioChange }) {
  const { t } = useTranslation();
  const { timeZone } = useSettings().settings;
  const scenario = scenarioByKey(scenarioKey);

  if (!scenario) {
    return (
      <div className="page scenario-page">
        <p className="status">{t('scenarioPage.notFound', { key: scenarioKey })}</p>
      </div>
    );
  }

  const zone = timeZoneOptions(timeZone);
  const longTime = (iso) =>
    formatDateTime(iso, {
      ...zone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  const shortDate = (date) =>
    formatDate(`${date}T00:00:00Z`, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

  const now = Date.now();
  const relative = (iso) => {
    const at = Date.parse(iso);
    if (day(at) === day(now)) return t('scenarioPage.today');
    return at < now
      ? t('scenarioPage.ago', { duration: formatDuration(day(at), day(now)) })
      : t('scenarioPage.in', { duration: formatDuration(day(now), day(at)) });
  };

  const name = scenario.full_en ?? scenario.full_jp ?? scenario.key;
  const { jp: shortJp, en: shortEn } = scenario.short ?? { jp: scenarioName(scenario.key), en: null };
  const shortNames = [
    { server: 'jp', name: shortJp },
    ...(shortEn && shortEn !== shortJp ? [{ server: 'gl', name: shortEn }] : []),
  ];
  const index = SCENARIOS.indexOf(scenario);
  const [previous, next] = [SCENARIOS[index - 1], SCENARIOS[index + 1]];
  const rankable = SERVER_ORDER.some((s) => getServerConfig(s).availableScenarios.includes(scenario.key));
  const [jp, en] = [scenario.jp_start_date, scenario.en_start_date];
  // External pages about the scenario (links other than images), in this order.
  const links = Object.entries(LINKS)
    .filter(([key]) => scenario.links[key])
    .map(([key, url]) => [key, url(scenario.links[key])]);

  function openTierList() {
    onScenarioChange(scenario.key);
    window.location.hash = '#/';
  }

  return (
    <div className="page scenario-page" style={scenario.color ? { '--scenario-color': scenario.color } : undefined}>
      {/* Key art, then everything else: stacked on phones, side by side on desktop. */}
      <div className="scenario-hero">
        {scenario.links.cover && <img className="scenario-art" src={scenario.links.cover} alt={name} />}
        <div className="scenario-body">
          <div className="scenario-facts">
            <h1>{name}</h1>
            {scenario.full_en && scenario.full_jp && (
              <p className="scenario-jp" lang="ja">
                {scenario.full_jp}
              </p>
            )}
            <p className="card-tags">
              {/* Both short names, labelled by server: JP's, and Global's when it has a different one. */}
              {shortNames.map(({ server: on, name: short }) => (
                <span key={on} className={`tag scenario-key ink-${ink(scenario.color) ?? 'none'}`}>
                  {shortNames.length > 1 && <span className="scenario-key-server">{serverName(on)}</span>}
                  {short}
                </span>
              ))}
              {SERVER_ORDER.filter((s) => isCurrent(scenario.key, s, now)).map((s) => (
                <span key={s} className="tag current">
                  {t('scenarioPage.current', { server: serverName(s) })}
                </span>
              ))}
            </p>
            {rankable && (
              <div className="scenario-actions">
                <button type="button" className="link-button" onClick={openTierList}>
                  <Trophy size={16} aria-hidden="true" />
                  {t('scenarioPage.openTierList')}
                </button>
              </div>
            )}
          </div>

          <h2 className="card-section">{t('scenarioPage.launch')}</h2>
          {/* One card: JP's launch on the left, Global's on the right, the gap between them in the middle ("Launched after …"). */}
          <div className="scenario-launch">
            {SERVER_ORDER.map((key, i) => {
              const start = scenario[DATE_FIELD[key]];
              const side = (
                <div key={key} className={`scenario-launch-side ${key}`}>
                  <span className="scenario-launch-server">{serverName(key)}</span>
                  {start ? (
                    <>
                      <span className={`scenario-status ${start.tag}`}>{t(`scenarioPage.status.${start.tag}`)}</span>
                      <strong>{longTime(start.date)}</strong>
                      <span className="scenario-relative">{relative(start.date)}</span>
                      {start.tag === 'predicted' && start.lo && (
                        <span className="scenario-range">
                          {t('scenarioPage.range', {
                            dates: t('common.dateRange', { start: shortDate(start.lo), end: shortDate(start.hi) }),
                          })}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="scenario-relative">{t('scenarioPage.noDate', { server: serverName(key) })}</span>
                  )}
                </div>
              );
              if (i === 0) return side;
              return [
                <div key="gap" className="scenario-launch-gap">
                  <ArrowRight size={20} aria-hidden="true" />
                  {jp && en && (
                    <small>
                      {t(en.tag === 'out' ? 'scenarioPage.lag' : 'scenarioPage.lagExpected', {
                        duration: formatDuration(day(Date.parse(jp.date)), day(Date.parse(en.date))),
                      })}
                    </small>
                  )}
                </div>,
                side,
              ];
            })}
          </div>

          {links.length > 0 && (
            <>
              <h2 className="card-section">{t('scenarioPage.links')}</h2>
              <ul className="scenario-links">
                {links.map(([key, url]) => (
                  <li key={key}>
                    <a href={url} target="_blank" rel="noreferrer">
                      <span>
                        <strong>{t(`scenarioPage.link.${key}`)}</strong>
                        <small>{new URL(url).hostname}</small>
                      </span>
                      <ExternalLink size={16} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <nav className="scenario-nav" aria-label={t('scenarioPage.others')}>
        {previous ? (
          <a href={`#/scenario/${previous.key}`}>
            <ChevronLeft size={18} aria-hidden="true" />
            <span>
              <small>{t('scenarioPage.previous')}</small>
              {previous.full_en ?? previous.full_jp}
            </span>
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a href={`#/scenario/${next.key}`} className="next">
            <span>
              <small>{t('scenarioPage.next')}</small>
              {next.full_en ?? next.full_jp}
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </a>
        )}
      </nav>
    </div>
  );
}
