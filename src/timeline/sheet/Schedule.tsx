import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { formatTimeLeft } from '../../i18n/index.ts';
import type { DateFormats } from '../../lib/dates.ts';
import type { Entry } from '../entries.ts';
import { currentPhase } from './schedule.ts';
import shared from './shared.module.css';
import styles from './Schedule.module.css';

const NOT_LIVE: ReturnType<typeof currentPhase> = { current: -1, end: null, ended: [] };

export function Schedule({ entry, format }: { entry: Entry; format: DateFormats }) {
  const { t } = useTranslation();
  const { phases } = entry;
  if (!phases.length) return null;
  const now = Date.now();
  // Only while the event is live: an ended event's phases all ended, nothing to tell apart.
  const { current, end: currentEnd, ended } = entry.status === 'live' ? currentPhase(phases, entry.end, now) : NOT_LIVE;
  return (
    <>
      <h3 className={shared.heading}>{t('timeline.schedule')}</h3>
      <ul className={clsx(shared.list, styles.schedule)}>
        {phases.map((phase, i) => {
          // (a "coming soon" post's schedule: what it doesn't give yet is the prediction's)
          const predicted = [phase.start, phase.end].some((d) => d?.status === 'predicted');
          const dates = format.sheet({ start: phase.start.date, end: phase.end?.date ?? null });
          return (
            // The phase running now isn't greyed out for its predicted dates: it is happening; only its countdown,
            // to a predicted end, is.
            <li
              key={phase.key}
              className={clsx(predicted && i !== current && styles.predicted, ended[i] && styles.ended)}
            >
              <span className={styles.phaseName}>
                {/* Every row keeps the dot's room, so the names line up. */}
                {current >= 0 && (
                  <span className={styles.phaseDot}>
                    {i === current && (
                      <span className={styles.ping} role="img" aria-label={t('timeline.status.live')} />
                    )}
                  </span>
                )}
                <span>
                  {t(`events.phase.${phase.key}`)}
                  {i === current && currentEnd && (
                    <span className={clsx(styles.endsIn, predicted && styles.endsInPredicted)}>
                      {t('timeline.endsIn', { duration: formatTimeLeft(Date.parse(currentEnd) - now) })}
                    </span>
                  )}
                </span>
              </span>
              <small>{predicted ? `${dates} · ${t('timeline.status.predicted')}` : dates}</small>
            </li>
          );
        })}
      </ul>
    </>
  );
}
