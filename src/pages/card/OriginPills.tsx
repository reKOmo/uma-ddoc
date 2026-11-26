import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { originKinds } from '../../lib/cardOrigins.ts';
import type { OriginKind } from '../../lib/cardOrigins.ts';
import { kindName } from '../../timeline/format.ts';
import Pill from '../../ui/Pill.tsx';
import type { EntryOrigin } from './hooks.ts';
import styles from './OriginPills.module.css';

// One colour per origin kind, by the Timeline's event tones (not its banner one: a banner there takes its main card's
// type); 'other' has no tone of its own, so it's the default grey.
const KIND_TONE: Record<OriginKind, string> = {
  banner: 'kind-special',
  paid_banner: 'kind-champions_meeting',
  story: 'kind-story',
  gift: 'kind-gift',
  shop: 'kind-campaign',
  other: 'kind-other',
};

// An origin kind as its pill says it ('other': the event's own kind).
export const originLabel = (origin: EntryOrigin, t: TFunction): string =>
  origin.kind === 'other' ? kindName(origin.entry) : t(`card.origins.kind.${origin.kind}`);

export function KindPill({ origin, className }: { origin: EntryOrigin; className?: string }) {
  const { t } = useTranslation();
  return (
    <Pill variant="kind" tone={KIND_TONE[origin.kind]} className={className}>
      {originLabel(origin, t)}
    </Pill>
  );
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
    <Pill variant="kind" tone={KIND_TONE[first.kind]} className={styles.pill} title={labels.join(', ')}>
      {labels[0]}
      {kinds.length > 1 && ` ${t('card.origins.moreKinds', { count: kinds.length - 1 })}`}
    </Pill>
  );
}
