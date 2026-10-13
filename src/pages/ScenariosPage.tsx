// @ts-nocheck
// The Scenarios tab (#/scenarios): every Career scenario in launch order, with its status and date on
// each server (JP, then Global) and "Newest on …" for each server it's the latest on. Only the newest on
// the server picked in the top bar gets the coloured background. Each opens its scenario page.

import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate, scenarioName, serverName } from '../i18n/index.ts';
import { DATE_FIELD, SCENARIOS, isCurrent } from '../scenarioRelease.ts';
import { ink } from '../timeline/scenarioStrip.ts';
import { timeZoneOptions, useSettings } from '../settings.tsx';
import './scenarios.css';
import { scenarioUrl } from '../routes.ts';

const SERVER_ORDER = ['jp', 'gl'];

export default function ScenariosPage({ server }) {
  const { t } = useTranslation();
  const { timeZone } = useSettings().settings;
  const date = (iso) =>
    formatDate(iso, { ...timeZoneOptions(timeZone), year: 'numeric', month: 'short', day: 'numeric' });

  // "Launched Jul 22, 2026" / "Predicted Nov 25, 2026" / "No date yet" (after the server's name).
  const when = (start) =>
    start
      ? t('scenarioList.when', { status: t(`scenarioPage.status.${start.tag}`), date: date(start.date) })
      : t('scenarioList.noDate');

  return (
    <div className="page scenarios-page">
      <ol className="scenario-list">
        {SCENARIOS.map((s) => {
          const newestOn = SERVER_ORDER.filter((server) => isCurrent(s.key, server));
          const current = isCurrent(s.key, server); // highlighted: newest on the selected server
          return (
            <li key={s.key} style={s.color ? { '--scenario-color': s.color } : undefined}>
              <a href={scenarioUrl(s.key)} className={current ? 'scenario-item current' : 'scenario-item'}>
                {s.links.cover ? (
                  <img className="scenario-thumb" src={s.links.cover} alt="" loading="lazy" />
                ) : (
                  <span className="scenario-thumb" />
                )}
                <span className="scenario-item-text">
                  <span className="scenario-item-name">
                    <span className={`tag scenario-key ink-${ink(s.color) ?? 'none'}`}>{scenarioName(s.key)}</span>{' '}
                    {s.full_en ?? s.full_jp}
                  </span>
                  {newestOn.map((server) => (
                    <span key={server} className="scenario-item-newest">
                      {t('scenarioPage.current', { server: serverName(server) })}
                    </span>
                  ))}
                  {SERVER_ORDER.map((server) => {
                    const start = s[DATE_FIELD[server]];
                    return (
                      <span key={server} className={`scenario-item-when ${start?.tag ?? 'none'}`}>
                        {serverName(server)}: {when(start)}
                      </span>
                    );
                  })}
                </span>
                <ChevronRight className="scenario-item-arrow" size={18} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
