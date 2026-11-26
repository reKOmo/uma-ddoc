import { useRef, useState } from 'react';
import { ArrowDownUp, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Card } from '../../../shared/schemas/card.ts';
import type { Server } from '../../../tierlist/cards.ts';
import { useRowsHeight } from '../../hooks/useRowsHeight.ts';
import { timelineUrl } from '../../routes.ts';
import { dateRange, useDateFormats } from '../../lib/dates.ts';
import { entryTitle, labelIsFan } from '../../timeline/format.ts';
import type { EntryStatus } from '../../timeline/entries.ts';
import StatusBadge from '../../ui/StatusBadge.tsx';
import { FanTl } from '../../ui/FanTl.tsx';
import Pill from '../../ui/Pill.tsx';
import RailList, { type RailDot } from '../../ui/RailList.tsx';
import { Section } from '../../ui/Section.tsx';
import ShouldPullChip from '../../ui/ShouldPullChip.tsx';
import Status from '../../ui/Status.tsx';
import type { UpcomingAdvice } from './advice.ts';
import type { EntryOrigin, Origins } from './hooks.ts';
import { KindPill } from './OriginPills.tsx';
import styles from './Banners.module.css';

// Folded on a phone: this many rows (Passed by shows as many), the next fading out.
const SHOWN = 3;
const DOT: Record<EntryStatus, RailDot> = { ended: 'filled', live: 'filled', confirmed: 'ring', predicted: 'dashed' };

type BannersProps = {
  card: Card;
  server: Server;
  origins: Origins | null | undefined;
  advice: UpcomingAdvice | null | undefined;
};

// Every banner and event the card comes from (a card on none: cards.json's source); its next one is NextBanner's.
export default function Banners({ card, server, origins, advice }: BannersProps) {
  const { t } = useTranslation();
  const format = useDateFormats().long;
  const [newestFirst, setNewestFirst] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  // Unfolded on a phone: its first six rows.
  const rowsHeight = useRowsHeight(listRef, unfolded);
  const list = origins ? (newestFirst ? origins.toReversed() : origins) : undefined;
  // No advice off Global: the guide is for Global's banners (JP's share their ids, so it would match there too).
  const shouldPull = (origin: EntryOrigin) =>
    origin.entry.group === 'cards' ? advice?.guide?.banners[origin.entry.id]?.[card.id]?.shouldPull : null;

  const order = list && list.length > 1 && (
    <button
      type="button"
      className={styles.order}
      aria-pressed={newestFirst}
      onClick={() => setNewestFirst(!newestFirst)}
    >
      <ArrowDownUp size={15} aria-hidden="true" />
      {t(newestFirst ? 'card.origins.newestFirst' : 'card.origins.oldestFirst')}
    </button>
  );

  return (
    <Section
      title={
        <>
          {t('card.origins.heading')}
          {/* How many, as the Timeline sheet's lists. */}
          {list && list.length > 0 && (
            <Pill variant="count" className={styles.count}>
              {list.length}
            </Pill>
          )}
        </>
      }
      action={order}
    >
      <div className={styles.panel}>
        {!list ? (
          <Status className={styles.rest}>{t('common.loading')}</Status>
        ) : list.length === 0 ? (
          card.release[server] && (
            // On no banner or event we know of: where it comes from instead, centred like the tier table's no-stats note.
            <div className={styles.source}>
              <p>
                {card.source.map((source) => (
                  <span key={source}>{t(`card.origins.source.${source}`)}</span>
                ))}
              </p>
            </div>
          )
        ) : (
          <RailList
            ref={listRef}
            className={styles.list}
            items={list}
            itemKey={({ server: on, entry }) => `${on}:${entry.key}`}
            dot={({ entry }) => DOT[entry.status]}
            shown={SHOWN}
            unfolded={unfolded}
            onToggle={() => setUnfolded(!unfolded)}
            rowsHeight={rowsHeight}
            moreLabel={t('card.origins.more', { count: list.length - SHOWN })}
            lessLabel={t('card.showLess')}
          >
            {(origin) => {
              const { entry, server: on, rerun } = origin;
              const pill = shouldPull(origin);
              return (
                <a className={styles.row} href={timelineUrl(on, entry.id)}>
                  <span className={styles.line}>
                    <KindPill origin={origin} />
                    {rerun && <Pill variant="tag">{t('card.origins.rerun')}</Pill>}
                    <span className={styles.name}>
                      <FanTl fan={labelIsFan(entry, { title: true })}>{entryTitle(entry)}</FanTl>
                    </span>
                  </span>
                  <span className={clsx(styles.line, styles.meta)}>
                    <StatusBadge status={entry.status} />
                    {dateRange(entry, format)}
                    {pill && <ShouldPullChip pill={pill} asked className={styles.rowVerdict} />}
                  </span>
                  <ChevronRight className={styles.open} size={18} aria-hidden="true" />
                </a>
              );
            }}
          </RailList>
        )}
      </div>
    </Section>
  );
}
