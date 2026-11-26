import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { formatDayRange, formatDuration, serverName } from '../../i18n/index.ts';
import { launchTag } from '../../../shared/scenarioRelease.ts';
import type { StartDate } from '../../../shared/schemas/scenario.ts';
import type { Server } from '../../lib/servers.ts';
import Pill from '../../ui/Pill.tsx';
import { dayOf, useDateFormats } from '../../lib/dates.ts';
import styles from './LaunchSide.module.css';

type LaunchSideProps = {
  server: Server;
  start: StartDate | null;
  now: number;
};

export default function LaunchSide({ server, start, now }: LaunchSideProps) {
  const { t } = useTranslation();
  const { time } = useDateFormats();
  const relative = (iso: string) => {
    const at = Date.parse(iso);
    if (dayOf(at) === dayOf(now)) return t('scenarioPage.today');
    return at < now
      ? t('scenarioPage.ago', { duration: formatDuration(dayOf(at), dayOf(now)) })
      : t('scenarioPage.in', { duration: formatDuration(dayOf(now), dayOf(at)) });
  };

  return (
    <div className={clsx(styles.side, styles[server])}>
      <span className={styles.serverName}>{serverName(server)}</span>
      {start ? (
        <>
          <LaunchStatus start={start} />
          <strong>{time(start.date)}</strong>
          <span className={styles.relative}>{relative(start.date)}</span>
          {start.status === 'predicted' && start.lo && (
            <span className={styles.range}>
              {t('scenarioPage.range', {
                dates: formatDayRange(start.lo, start.hi ?? start.lo),
              })}
            </span>
          )}
        </>
      ) : (
        <span className={styles.relative}>{t('scenarioPage.noDate', { server: serverName(server) })}</span>
      )}
    </div>
  );
}

// Launched: the Timeline's live look.
function LaunchStatus({ start }: { start: StartDate }) {
  const { t } = useTranslation();
  const tag = launchTag(start);
  return (
    <Pill variant="status" status={tag === 'out' ? 'live' : tag}>
      {t(`scenarioPage.status.${tag}`)}
    </Pill>
  );
}
