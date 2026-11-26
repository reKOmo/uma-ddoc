import { Trans, useTranslation } from 'react-i18next';
import { formatDay, formatDuration } from '../../../i18n/index.ts';
import type { HistoryPoint } from '../../../lib/rankHistory.ts';
import styles from '../PassedBy.module.css';

type ReleaseRowProps = {
  first: HistoryPoint;
  next: HistoryPoint | undefined;
  // Out already (released), or still to come (arrives).
  released: boolean;
};

export default function ReleaseRow({ first, next, released }: ReleaseRowProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.entry} data-date={first.date}>
        <div className={styles.head}>
          <span className={styles.date}>
            <Trans
              i18nKey={released ? 'card.releasedOn' : 'card.arrivesOn'}
              values={{ date: formatDay(first.date) }}
              components={{ date: <em /> }}
            />
          </span>
          <strong>{t('common.rankOf', first)}</strong>
        </div>
      </div>
      {next && (
        <span className={styles.gap}>{t('card.passedAfter', { duration: formatDuration(first.date, next.date) })}</span>
      )}
    </>
  );
}
