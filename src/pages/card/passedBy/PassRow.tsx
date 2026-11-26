import { ArrowDown, ArrowUp } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { cards } from '../../../../tierlist/cards.ts';
import { formatDay, formatDuration } from '../../../i18n/index.ts';
import { cardIcon } from '../../../lib/gametora.ts';
import type { HistoryPoint } from '../../../lib/rankHistory.ts';
import { cardUrl } from '../../../routes.ts';
import { CardRow } from '../../../ui/CardRow.tsx';
import StatusBadge from '../../../ui/StatusBadge.tsx';
import SeeMore from '../../../ui/SeeMore.tsx';
import { dayStart, daysUntil } from '../../../lib/dates.ts';
import { nameOf, titleOf } from '../shared.ts';
import type { Language, TranslationsFile } from '../../../lib/translations.ts';
import { FanTl } from '../../../ui/FanTl.tsx';
import styles from '../PassedBy.module.css';

function cardTitle(id: number, language: Language, tl: TranslationsFile | null) {
  const title = titleOf(id, language, tl);
  return title && <FanTl fan={title.fan}>{title.text}</FanTl>;
}

function RankChange({ point, history }: { point: HistoryPoint; history: HistoryPoint[] }) {
  const { t } = useTranslation();
  const before = history[history.indexOf(point) - 1];
  const change = before ? Math.sign(before.position - point.position) : 0;
  const Arrow = change > 0 ? ArrowUp : change < 0 ? ArrowDown : null;
  return (
    <span className={clsx(styles.rank, change > 0 && styles.up, change < 0 && styles.down)}>
      {Arrow && <Arrow size={15} aria-label={t(change > 0 ? 'card.rankUp' : 'card.rankDown')} />}
      {t('common.rank', point)}
    </span>
  );
}

type PassRowProps = {
  point: HistoryPoint;
  next: HistoryPoint | undefined;
  history: HistoryPoint[];
  language: Language;
  tl: TranslationsFile | null;
};

// A date other cards pass it: its new rank and the cards that came out above it.
export default function PassRow({ point, next, history, language, tl }: PassRowProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className={clsx(styles.entry, point.predicted && styles.predicted)} data-date={point.date}>
        <div className={styles.head}>
          <span className={styles.date}>{formatDay(point.date)}</span>
          {point.predicted && <StatusBadge status="predicted" />}
          {point.predicted && (
            <span className={styles.until}>
              {t('common.inDays', { count: Math.max(1, daysUntil(dayStart(point.date))) })}
            </span>
          )}
        </div>
        <div className={styles.body}>
          <RankChange point={point} history={history} />
          <ul className={styles.cards}>
            {point.overtakenBy.map((c) => (
              <li key={c.id}>
                <CardRow
                  href={cardUrl(c.id)}
                  icon={cardIcon(c.id, cards)}
                  name={nameOf(c.id, language) ?? ''}
                  title={cardTitle(c.id, language, tl)}
                  className={styles.cardRow}
                />
                <SeeMore href={cardUrl(c.id)}>{t('card.seeCard')}</SeeMore>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {next && (
        <span className={styles.gap}>{t('card.passedLater', { duration: formatDuration(point.date, next.date) })}</span>
      )}
    </>
  );
}
