import { type RefObject, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import clsx from 'clsx';
import { Trans, useTranslation } from 'react-i18next';
import { cards } from '../../../tierlist/cards.ts';
import type { Server } from '../../../tierlist/cards.ts';
import { formatDay, formatDuration } from '../../i18n/index.ts';
import { FADE, useRowsHeight } from '../../hooks/useRowsHeight.ts';
import { cardIcon } from '../../lib/gametora.ts';
import type { HistoryPoint } from '../../lib/rankHistory.ts';
import { cardUrl } from '../../routes.ts';
import { CardRow } from '../../ui/CardRow.tsx';
import StatusBadge from '../../ui/StatusBadge.tsx';
import RailList from '../../ui/RailList.tsx';
import SeeMore from '../../ui/SeeMore.tsx';
import Status from '../../ui/Status.tsx';
import { dayStart, daysUntil } from '../../lib/dates.ts';
import { nameOf, titleOf } from './shared.ts';
import { type Language, type TranslationsFile, useLanguage, useTranslations } from '../../lib/translations.ts';
import { FanTl } from '../../ui/FanTl.tsx';
import styles from './PassedBy.module.css';

// Folded on a phone: this many rows (the release and two passes, as Available on's), the next fading out.
const SHOWN = 3;

function cardTitle(id: number, language: Language, tl: TranslationsFile | null) {
  const title = titleOf(id, language, tl);
  return title && <FanTl fan={title.fan}>{title.text}</FanTl>;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

// The nearest ancestor that scrolls vertically.
function scrollParent(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
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
  // The pick already scrolled to, so folding the list again afterwards doesn't unfold it for the same pick.
  const handled = useRef(0);

  useEffect(() => {
    if (!picked || handled.current === picked.n) return;
    if (passes.findIndex((p) => p.date === picked.date) >= shownCount) {
      setUnfolded(cardId); // runs again once the row is there
      return;
    }
    // Unfolded, not until its height is measured: the page is only as tall as it'll be then, to scroll that far.
    if (expanded && !rowsHeight) return;
    handled.current = picked.n;
    const row = list.current?.querySelector(`[data-date="${picked.date}"]`);
    if (!row) return;
    // The list's own scroll area (desktop's around it beside the chart, a phone's unfolded list): the row to its top.
    let rowTop = row.getBoundingClientRect().top;
    const inner = showAll ? scrollParent(row) : expanded ? list.current : null;
    if (inner) {
      const target = clamp(
        inner.scrollTop + rowTop - inner.getBoundingClientRect().top - FADE,
        0,
        inner.scrollHeight - inner.clientHeight
      );
      rowTop -= target - inner.scrollTop;
      inner.scrollTo({ top: target, behavior: 'smooth' });
    }
    // A phone's page too: the row up to the top, but no further than keeps the chart in view.
    const page = !showAll && list.current ? scrollParent(list.current) : null;
    if (page) {
      const pageTop = page.getBoundingClientRect().top;
      const keep = keepInView?.current?.getBoundingClientRect().top;
      const by = Math.min(rowTop - pageTop - FADE, keep === undefined ? Number.POSITIVE_INFINITY : keep - pageTop - 8);
      page.scrollBy({ top: by, behavior: 'smooth' });
    }
    row.animate(
      [{ backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)' }, { backgroundColor: 'transparent' }],
      { duration: 1800, easing: 'ease-in' }
    );
  }, [picked, shownCount, passes, cardId, showAll, expanded, rowsHeight, keepInView]);

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
        {(point, i) => {
          const next = rows[i + 1];
          return i === 0 ? (
            <>
              <div className={styles.entry} data-date={first.date}>
                <div className={styles.head}>
                  <span className={styles.date}>
                    <Trans
                      i18nKey={now ? 'card.releasedOn' : 'card.arrivesOn'}
                      values={{ date: formatDay(first.date) }}
                      components={{ date: <em /> }}
                    />
                  </span>
                  <strong>{t('common.rankOf', first)}</strong>
                </div>
              </div>
              {next && (
                <span className={styles.gap}>
                  {t('card.passedAfter', { duration: formatDuration(first.date, next.date) })}
                </span>
              )}
            </>
          ) : (
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
                <span className={styles.gap}>
                  {t('card.passedLater', { duration: formatDuration(point.date, next.date) })}
                </span>
              )}
            </>
          );
        }}
      </RailList>
    </div>
  );
}
