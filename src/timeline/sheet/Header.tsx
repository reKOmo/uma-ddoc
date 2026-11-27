import { useTranslation } from 'react-i18next';
import { SheetTitle } from '../../ui/Sheet.tsx';
import Pill from '../../ui/Pill.tsx';
import StatusBadge from '../../ui/StatusBadge.tsx';
import InfoTip from '../../ui/InfoTip.tsx';
import { FanTl } from '../../ui/FanTl.tsx';
import { formatTimeLeft } from '../../i18n/index.ts';
import { type DateFormats, dateRange } from '../../lib/dates.ts';
import { daysOf, entryTitle, kindName, labelIsFan } from '../format.ts';
import type { Entry } from '../entries.ts';
import styles from './Header.module.css';

export function Header({ entry, format }: { entry: Entry; format: DateFormats }) {
  const { t } = useTranslation();
  const days = daysOf(entry);
  return (
    <>
      <div className={styles.pills}>
        <Pill variant="tinted" tone={entry.tone}>
          {kindName(entry)}
        </Pill>
        <StatusPill entry={entry} />
        {/* (the card page's paid banners' tone) */}
        {entry.paid && (
          <Pill variant="status" tone="kind-champions_meeting" size="lg">
            {t('timeline.paidBadge')}
          </Pill>
        )}
      </div>
      <SheetTitle className={styles.title}>
        <FanTl fan={labelIsFan(entry, { title: true })}>{entryTitle(entry)}</FanTl>
      </SheetTitle>
      {/* A div: the info's popup sits inside it. One span, so the (i) wraps with the text's end. */}
      <div className={styles.dates}>
        <span>
          {format.sheet(entry)}
          {days != null && ` · ${t('timeline.days', { count: days })}`}
          {entry.endPredicted && ` · ${t('timeline.endPredicted')}`} <Provenance entry={entry} format={format} />
        </span>
      </div>
    </>
  );
}

// The status, and how long until it changes: a live entry's time left, an upcoming one's time to its start.
function StatusPill({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  const now = Date.now();
  const start = Date.parse(entry.start);
  const end = entry.end ? Date.parse(entry.end) : null;
  const left =
    entry.status === 'live'
      ? end != null && end > now && t('timeline.timeLeft', { duration: formatTimeLeft(end - now, { narrow: true }) })
      : entry.status !== 'ended' &&
        start > now &&
        t('timeline.startsIn', { duration: formatTimeLeft(start - now, { narrow: true }) });
  // The status alone on the pill; how long is left beside it, as plain text.
  // (the two kept together: they wrap as one)
  return (
    <span className={styles.statusGroup}>
      <StatusBadge status={entry.status} size="lg" />
      {left && <span className={styles.timeLeft}>{left}</span>}
    </span>
  );
}

// Where a prediction's dates come from, what a paid banner is: behind an (i) after the dates.
function Provenance({ entry, format }: { entry: Entry; format: DateFormats }) {
  const { t } = useTranslation();
  const { prediction } = entry;
  const jpStart = prediction?.from.start;
  const jpDates =
    prediction && jpStart && dateRange({ start: jpStart, end: prediction.from.end, openEnded: false }, format.long);
  if (!prediction && !entry.paid) return null;
  return (
    <InfoTip label={t('timeline.aboutDates')}>
      {prediction && (
        <p>
          {prediction.confirmed
            ? t('timeline.confirmedFrom', { dates: jpDates })
            : t('timeline.predictedFrom', { dates: jpDates, count: prediction.margin })}{' '}
          {t('timeline.fromJp')}
        </p>
      )}
      {entry.paid && <p>{t('timeline.paid')}</p>}
    </InfoTip>
  );
}
