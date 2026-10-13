// The Scenarios tab (#/scenarios): every Career scenario in launch order, with its status and date on
// each server (JP, then Global) and "Newest on …" for each server it's the latest on. Only the newest on
// the server picked in the top bar gets the coloured background. Each opens its scenario page.

import clsx from 'clsx';
import type { CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate, scenarioName, serverName } from '../i18n/index.ts';
import { DATE_FIELD, SCENARIOS, isCurrent } from '../scenarioRelease.ts';
import type { StartDate } from '../../shared/schemas/scenario.ts';
import type { Server } from '../servers.ts';
import { ink } from '../timeline/scenarioStrip.ts';
import { timeZoneOptions, useSettings } from '../settings.tsx';
import { scenarioUrl } from '../routes.ts';
import styles from './ScenariosPage.module.css';

const SERVER_ORDER: Server[] = ['jp', 'gl'];

// The key pill's ink class: the text dark or light by the cover colour.
function inkClass(color: string): string | undefined {
  const tone = ink(color);
  return tone === 'dark' ? styles.inkDark : tone === 'light' ? styles.inkLight : undefined;
}

export default function ScenariosPage({ server }: { server: Server }) {
  const { t } = useTranslation();
  const { timeZone } = useSettings().settings;
  const date = (iso: string) =>
    formatDate(iso, { ...timeZoneOptions(timeZone), year: 'numeric', month: 'short', day: 'numeric' });

  // "Launched Jul 22, 2026" / "Predicted Nov 25, 2026" / "No date yet" (after the server's name).
  const when = (start: StartDate | null) =>
    start
      ? t('scenarioList.when', { status: t(`scenarioPage.status.${start.tag}`), date: date(start.date) })
      : t('scenarioList.noDate');

  return (
    <div className="page">
      <ol className={styles.list}>
        {SCENARIOS.map((s) => {
          const newestOn = SERVER_ORDER.filter((on) => isCurrent(s.key, on));
          const current = isCurrent(s.key, server); // highlighted: newest on the selected server
          return (
            <li key={s.key} style={s.color ? ({ '--scenario-color': s.color } as CSSProperties) : undefined}>
              <a href={scenarioUrl(s.key)} className={clsx(styles.item, current && styles.current)}>
                {s.links.cover ? (
                  <img className={styles.thumb} src={s.links.cover} alt="" loading="lazy" />
                ) : (
                  <span className={styles.thumb} />
                )}
                <span className={styles.text}>
                  <span className={styles.name}>
                    <span className={clsx(styles.tag, styles.scenarioKey, inkClass(s.color))}>
                      {scenarioName(s.key)}
                    </span>{' '}
                    {s.full_en ?? s.full_jp}
                  </span>
                  {newestOn.map((on) => (
                    <span key={on} className={styles.newest}>
                      {t('scenarioPage.current', { server: serverName(on) })}
                    </span>
                  ))}
                  {SERVER_ORDER.map((on) => {
                    const start = s[DATE_FIELD[on]];
                    return (
                      <span key={on} className={clsx(styles.when, styles[start?.tag ?? 'none'])}>
                        {serverName(on)}: {when(start)}
                      </span>
                    );
                  })}
                </span>
                <ChevronRight className={styles.arrow} size={18} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
