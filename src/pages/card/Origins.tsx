import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { originKinds } from '../../lib/cardOrigins.ts';
import type { OriginKind } from '../../lib/cardOrigins.ts';
import { kindName } from '../../timeline/format.ts';
import type { EntryOrigin } from './hooks.ts';
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
export const originLabel = (origin: EntryOrigin, t: TFunction): string =>
  origin.kind === 'other' ? kindName(origin.entry) : t(`card.origins.kind.${origin.kind}`);

export function KindPill({ origin, className }: { origin: EntryOrigin; className?: string }) {
  const { t } = useTranslation();
  return <span className={clsx(styles.kind, KIND_CLASS[origin.kind], className)}>{originLabel(origin, t)}</span>;
}

// The first origin's kind, "+N" for the other kinds the card has come by since (all in the tooltip).
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
