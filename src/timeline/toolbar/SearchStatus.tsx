import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { useTimelineFilters } from '../useTimelineFilters.ts';
import styles from './SearchStatus.module.css';

type Search = NonNullable<ReturnType<typeof useTimelineFilters>['search']>;

export default function SearchStatus({
  search,
  cursor,
  onGoTo,
}: {
  search: Search;
  cursor: number;
  onGoTo: (index: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <p className={styles.searchNote} role="status">
      {search.matched.length === 1 && (
        <span className={styles.matchNav}>
          {t('timeline.search.count', { count: 1 })}
          <button type="button" className={clsx(styles.navButton, styles.goButton)} onClick={() => onGoTo(0)}>
            {t('timeline.search.goTo')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </span>
      )}
      {search.matched.length > 1 && (
        <span className={styles.matchNav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onGoTo(cursor - 1)}
            disabled={cursor <= 0}
            aria-label={t('timeline.search.previous')}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          {t('timeline.search.position', {
            position: Math.min(cursor, search.matched.length - 1) + 1,
            count: search.matched.length,
          })}
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onGoTo(cursor + 1)}
            disabled={cursor >= search.matched.length - 1}
            aria-label={t('timeline.search.next')}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </span>
      )}
      {!search.matched.length && t('timeline.search.noMatches')}
      {search.hiddenMatches > 0 && ` · ${t('timeline.search.hiddenMatches', { count: search.hiddenMatches })}`}
    </p>
  );
}
