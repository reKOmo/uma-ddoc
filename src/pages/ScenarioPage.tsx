import clsx from 'clsx';
import type { CSSProperties } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getServerConfig } from '../../tierlist/scenarios.ts';
import { formatDate, formatDateTime, formatDuration, scenarioName, serverName } from '../i18n/index.ts';
import { DATE_FIELD, SCENARIOS, isCurrent, scenarioByKey } from '../scenarioRelease.ts';
import type { Scenario, StartDate } from '../../shared/schemas/scenario.ts';
import type { Server } from '../servers.ts';
import { Section } from '../ui/Section.tsx';
import Status from '../ui/Status.tsx';
import { ink } from '../timeline/scenarioStrip.ts';
import { timeZoneOptions, useSettings } from '../settings.tsx';
import { umapyoiGl, umapyoiJp } from '../umapyoi.ts';
import { TAB_URLS, scenarioUrl } from '../routes.ts';
import styles from './ScenarioPage.module.css';

type Settings = ReturnType<typeof useSettings>['settings'];

const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// scenario.links minus the image (cover): the pages to visit, in this order.
// Labels: scenarioPage.link.<key>.
function linkList(scenario: Scenario, settings: Settings): [string, string][] {
  const { links } = scenario;
  const out: [string, string][] = [];
  if (links.gametora) out.push(['gametora', links.gametora]);
  if (links.umapyoi_jp) out.push(['umapyoi_jp', umapyoiJp(links.umapyoi_jp, settings.jpNewsLanguage)]);
  if (links.umapyoi_gl) out.push(['umapyoi_gl', umapyoiGl(links.umapyoi_gl)]);
  return out;
}

function inkClass(color: string): string | undefined {
  const tone = ink(color);
  return tone === 'dark' ? styles.inkDark : tone === 'light' ? styles.inkLight : undefined;
}

// Server-agnostic: both servers' launches side by side, "Newest on …" for each server it's the latest on.
const SERVER_ORDER: Server[] = ['jp', 'gl'];

export type ScenarioPageProps = {
  scenarioKey: string | undefined;
  onScenarioChange: (key: string) => void;
};

export default function ScenarioPage({ scenarioKey, onScenarioChange }: ScenarioPageProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { timeZone } = settings;
  const scenario = scenarioKey === undefined ? null : scenarioByKey(scenarioKey);

  if (!scenario) {
    return (
      <div className={clsx('page', styles.scenarioPage)}>
        <Status>{t('scenarioPage.notFound', { key: scenarioKey })}</Status>
      </div>
    );
  }

  const zone = timeZoneOptions(timeZone);
  const longTime = (iso: string) =>
    formatDateTime(iso, {
      ...zone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  const shortDate = (date: string) =>
    formatDate(`${date}T00:00:00Z`, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

  const now = Date.now();
  const relative = (iso: string) => {
    const at = Date.parse(iso);
    if (day(at) === day(now)) return t('scenarioPage.today');
    return at < now
      ? t('scenarioPage.ago', { duration: formatDuration(day(at), day(now)) })
      : t('scenarioPage.in', { duration: formatDuration(day(now), day(at)) });
  };

  const name = scenario.full_en ?? scenario.full_jp ?? scenario.key;
  const { jp: shortJp, en: shortEn } = scenario.short ?? { jp: scenarioName(scenario.key), en: null };
  const shortNames: { server: Server; name: string }[] = [
    { server: 'jp', name: shortJp },
    ...(shortEn && shortEn !== shortJp ? [{ server: 'gl' as const, name: shortEn }] : []),
  ];
  const index = SCENARIOS.indexOf(scenario);
  const [previous, next] = [SCENARIOS[index - 1], SCENARIOS[index + 1]];
  const rankable = SERVER_ORDER.some((s) => getServerConfig(s).availableScenarios.includes(scenario.key));
  const [jp, en] = [scenario.jp_start_date, scenario.en_start_date];
  const links = linkList(scenario, settings);
  const style = scenario.color ? ({ '--scenario-color': scenario.color } as CSSProperties) : undefined;

  const openTierList = () => {
    onScenarioChange(scenario.key);
    window.location.hash = TAB_URLS.cards;
  };

  const side = (server: Server, start: StartDate | null) => (
    <div key={server} className={clsx(styles.side, styles[server])}>
      <span className={styles.serverName}>{serverName(server)}</span>
      {start ? (
        <>
          <span className={clsx(styles.launchStatus, styles[start.tag])}>{t(`scenarioPage.status.${start.tag}`)}</span>
          <strong>{longTime(start.date)}</strong>
          <span className={styles.relative}>{relative(start.date)}</span>
          {start.tag === 'predicted' && start.lo && (
            <span className={styles.range}>
              {t('scenarioPage.range', {
                dates: t('common.dateRange', { start: shortDate(start.lo), end: shortDate(start.hi ?? start.lo) }),
              })}
            </span>
          )}
        </>
      ) : (
        <span className={styles.relative}>{t('scenarioPage.noDate', { server: serverName(server) })}</span>
      )}
    </div>
  );

  return (
    <div className={clsx('page', styles.scenarioPage)} style={style}>
      <div className={styles.hero}>
        {scenario.links.cover && <img className={styles.art} src={scenario.links.cover} alt={name} />}
        <div className={styles.body}>
          <div className={styles.facts}>
            <h1>{name}</h1>
            {scenario.full_en && scenario.full_jp && (
              <p className={styles.jpName} lang="ja">
                {scenario.full_jp}
              </p>
            )}
            <p className={styles.tags}>
              {shortNames.map(({ server: on, name: short }) => (
                <span key={on} className={clsx(styles.tag, styles.scenarioKey, inkClass(scenario.color))}>
                  {shortNames.length > 1 && <span className={styles.serverLabel}>{serverName(on)}</span>}
                  {short}
                </span>
              ))}
              {SERVER_ORDER.filter((s) => isCurrent(scenario.key, s, now)).map((s) => (
                <span key={s} className={clsx(styles.tag, styles.current)}>
                  {t('scenarioPage.current', { server: serverName(s) })}
                </span>
              ))}
            </p>
            {rankable && (
              <div className={styles.actions}>
                <button type="button" className={styles.linkButton} onClick={openTierList}>
                  <Trophy size={16} aria-hidden="true" />
                  {t('scenarioPage.openTierList')}
                </button>
              </div>
            )}
          </div>

          <Section title={t('scenarioPage.launch')}>
            <div className={styles.launch}>
              {SERVER_ORDER.map((server, i) => {
                const launch = scenario[DATE_FIELD[server]];
                if (i === 0) return side(server, launch);
                return [
                  <div key="gap" className={styles.gap}>
                    <ArrowRight size={20} aria-hidden="true" />
                    {jp && en && (
                      <small>
                        {t(en.tag === 'out' ? 'scenarioPage.lag' : 'scenarioPage.lagExpected', {
                          duration: formatDuration(day(Date.parse(jp.date)), day(Date.parse(en.date))),
                        })}
                      </small>
                    )}
                  </div>,
                  side(server, launch),
                ];
              })}
            </div>
          </Section>

          {links.length > 0 && (
            <Section title={t('scenarioPage.links')}>
              <ul className={styles.links}>
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
            </Section>
          )}
        </div>
      </div>

      <nav className={styles.nav} aria-label={t('scenarioPage.others')}>
        {previous ? (
          <a href={scenarioUrl(previous.key)}>
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
          <a href={scenarioUrl(next.key)} className={styles.next}>
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
