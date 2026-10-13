import { useState } from 'react';
import { ArrowDownUp, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Card } from '../../../shared/schemas/card.ts';
import type { Server } from '../../../tierlist/cards.ts';
import { originKinds } from '../../cardOrigins.ts';
import type { OriginKind } from '../../cardOrigins.ts';
import { serverName } from '../../i18n/index.ts';
import { useSettings } from '../../settings.tsx';
import { dateFormats, dateRange, entryTitle, kindName } from '../../timeline/format.ts';
import StatusBadge from '../../timeline/StatusBadge.tsx';
import FoldToggle from '../../ui/FoldToggle.tsx';
import Pill from '../../ui/Pill.tsx';
import { Section } from '../../ui/Section.tsx';
import Status from '../../ui/Status.tsx';
import { timelineUrl } from '../../routes.ts';
import type { EntryOrigin, Origins as OriginsData } from './hooks.ts';
import styles from './Origins.module.css';

// One colour per origin kind (not the Timeline's: a banner there takes its main card's type).
const KIND_CLASS: Record<OriginKind, string | undefined> = {
  banner: styles.banner,
  paid_banner: styles.paidBanner,
  story: styles.story,
  gift: styles.gift,
  shop: styles.shop,
  other: undefined,
};

// An origin kind as its pill says it ('other': the event's own kind).
const originLabel = (origin: EntryOrigin, t: TFunction): string =>
  origin.kind === 'other' ? kindName(origin.entry) : t(`card.origins.kind.${origin.kind}`);

export function OriginPill({ origins }: { origins: EntryOrigin[] }) {
  const { t } = useTranslation();
  const kinds = originKinds(origins);
  const labels = kinds.map((kind) => {
    const origin = origins.find((o) => o.kind === kind);
    return origin ? originLabel(origin, t) : '';
  });
  const first = origins[0];
  if (!first) return null;
  return (
    <span className={clsx(styles.kind, styles.pill, KIND_CLASS[first.kind])} title={labels.join(', ')}>
      {labels[0]}
      {kinds.length > 1 && ` ${t('card.origins.moreKinds', { count: kinds.length - 1 })}`}
    </span>
  );
}

type OriginsProps = { card: Card; server: Server; origins: OriginsData | null | undefined };

// A card on no banner or event shows cards.json's source instead.
export default function Origins({ card, server, origins }: OriginsProps) {
  const { t } = useTranslation();
  const { timeZone } = useSettings().settings;
  const [newestFirst, setNewestFirst] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const list = origins ? (newestFirst ? origins.list.toReversed() : origins.list) : undefined;
  const shown = list && (unfolded ? list : list.slice(0, 1));
  const format = dateFormats(timeZone).long;

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
    <Section title={t('card.origins.heading')} action={order}>
      {!list || !origins ? (
        <Status>{t('common.loading')}</Status>
      ) : list.length === 0 ? (
        origins.servers.some((s) => card.release[s]) && (
          <p className={styles.tags}>
            {card.source.map((source) => (
              <Pill key={source} variant="tag">
                {t(`card.origins.source.${source}`)}
              </Pill>
            ))}
          </p>
        )
      ) : (
        <>
          <ol className={styles.list}>
            {shown?.map((origin) => {
              const { entry, server: on, rerun } = origin;
              return (
                <li key={`${on}:${entry.key}`}>
                  <a className={styles.origin} href={timelineUrl(on, entry.id)}>
                    <span className={styles.head}>
                      <span className={clsx(styles.kind, KIND_CLASS[origin.kind])}>{originLabel(origin, t)}</span>
                      {on !== server && <Pill variant="tag">{serverName(on)}</Pill>}
                      {rerun && <Pill variant="tag">{t('card.origins.rerun')}</Pill>}
                    </span>
                    <span className={styles.name}>{entryTitle(entry)}</span>
                    <span className={styles.when}>
                      <StatusBadge status={entry.status} />
                      {dateRange(entry, format)}
                    </span>
                    <ChevronRight className={styles.open} size={18} aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ol>
          {list.length > 1 && (
            <FoldToggle
              className={styles.fold}
              expanded={unfolded}
              onToggle={() => setUnfolded(!unfolded)}
              moreLabel={t('card.origins.more', { count: list.length - 1 })}
              lessLabel={t('card.showLess')}
            />
          )}
        </>
      )}
    </Section>
  );
}
