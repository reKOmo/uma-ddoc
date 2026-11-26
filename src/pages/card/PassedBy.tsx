import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Server } from '../../../tierlist/cards.ts';
import { useRowsHeight } from '../../hooks/useRowsHeight.ts';
import type { HistoryPoint } from '../../lib/rankHistory.ts';
import RailList from '../../ui/RailList.tsx';
import Status from '../../ui/Status.tsx';
import { useLanguage, useTranslations } from '../../lib/translations.ts';
import { useScrollToPicked } from './passedBy/useScrollToPicked.ts';
import ReleaseRow from './passedBy/ReleaseRow.tsx';
import PassRow from './passedBy/PassRow.tsx';
import styles from './PassedBy.module.css';

// Folded on a phone: this many rows (the release and two passes, as Available on's), the next fading out.
const SHOWN = 3;

type PassedByProps = {
  cardId: number;
  server: Server;
  history: HistoryPoint[];
  passes: HistoryPoint[];
  first: HistoryPoint;
  // The latest point that isn't predicted; undefined for a card not out yet.
  now: HistoryPoint | undefined;
  // Every pass, no folding (desktop, where the list around it scrolls beside the chart instead).
  showAll?: boolean;
  // A date picked on the chart: its row is scrolled to and flashed (unfolding the list for it).
  picked?: { date: string; n: number } | null;
  // What scrolling to a picked row keeps in view on a phone (the chart).
  keepInView?: RefObject<HTMLElement | null>;
};

export default function PassedBy({
  cardId,
  server,
  history,
  passes,
  first,
  now,
  showAll = false,
  picked,
  keepInView,
}: PassedByProps) {
  const { t } = useTranslation();
  const language = useLanguage(server);
  const tl = useTranslations();
  // Which card's passes are unfolded, so following a "See card" link folds them again.
  const [unfolded, setUnfolded] = useState<number | null>(null);
  const expanded = !showAll && unfolded === cardId;
  const folded = !showAll && !expanded;
  // Folded, the release's row is one of the shown.
  const shownCount = folded ? Math.min(SHOWN - 1, passes.length) : passes.length;
  const list = useRef<HTMLOListElement>(null);
  // Unfolded on a phone: six rows, the rest scrolling.
  const rowsHeight = useRowsHeight(list, expanded);
  useScrollToPicked({
    list,
    picked,
    passes,
    shownCount,
    cardId,
    setUnfolded,
    showAll,
    expanded,
    rowsHeight,
    keepInView,
  });

  if (passes.length === 0) return <Status>{t('card.noneAbove')}</Status>;
  // The release, then each pass.
  const rows = [first, ...passes];
  return (
    <div className={styles.box}>
      <RailList
        ref={list}
        className={styles.list}
        items={rows}
        itemKey={(point, i) => (i === 0 ? 'release' : point.date)}
        dot={(point, i) => (i === 0 ? (now ? 'ring' : 'dashed') : point.predicted ? 'dashed' : 'filled')}
        shown={SHOWN}
        unfolded={expanded}
        onToggle={() => setUnfolded(expanded ? null : cardId)}
        rowsHeight={rowsHeight}
        moreLabel={t('card.morePasses', { count: passes.length - (SHOWN - 1) })}
        lessLabel={t('card.showLess')}
      >
        {(point, i) =>
          i === 0 ? (
            <ReleaseRow first={first} next={rows[i + 1]} released={Boolean(now)} />
          ) : (
            <PassRow point={point} next={rows[i + 1]} history={history} language={language} tl={tl} />
          )
        }
      </RailList>
    </div>
  );
}
