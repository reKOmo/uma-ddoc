import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Pill from '../../ui/Pill.tsx';
import TierChip from '../../ui/TierChip.tsx';
import { CardRow } from '../../ui/CardRow.tsx';
import ShouldPullChip from '../../ui/ShouldPullChip.tsx';
import TypePill from '../../ui/TypePill.tsx';
import { FanTl } from '../../ui/FanTl.tsx';
import { scenarioName, serverName } from '../../i18n/index.ts';
import { type CardRank as CardRankValue, type RankResult, cardStat } from '../useRankings.ts';
import type { Entry, EntryGroup } from '../entries.ts';
import type { PullGuide } from '../../../shared/schemas/pullGuide.ts';
import { cardUrl } from '../../routes.ts';
import type { ServerKey } from './types.ts';
import shared from './shared.module.css';
import styles from './Featured.module.css';

// Trainee icons don't show rarity (card icons do), so it's spelled out.
const STARS = ['', '★1', '★2', '★3'];
const FEATURED_HEADING: Record<EntryGroup, string> = {
  characters: 'timeline.featuredTrainees',
  cards: 'timeline.featuredCards',
  event: 'timeline.supportCards',
};

type BannerAdvice = PullGuide['banners'][string] | undefined;

export function Featured({
  entry,
  rankings,
  advice,
}: {
  entry: Entry;
  rankings: RankResult | null;
  advice: BannerAdvice;
}) {
  const { t } = useTranslation();
  if (!entry.featured.length) return null;
  return (
    <>
      {/* The count beside the heading, not in it: the list says how many to a screen reader. */}
      <div className={shared.headingRow}>
        <h3 className={shared.heading}>{t(FEATURED_HEADING[entry.group])}</h3>
        <Pill variant="count">{entry.featured.length}</Pill>
      </div>
      <ul className={styles.featured}>
        {entry.featured.map((item) => (
          <FeaturedItem key={item.key} item={item} rankings={rankings} advice={advice} fan={entry.fan} />
        ))}
      </ul>
    </>
  );
}

type FeaturedEntry = Entry['featured'][number];

function FeaturedItem({
  item,
  rankings,
  advice,
  fan,
}: {
  item: FeaturedEntry;
  rankings: RankResult | null;
  advice: BannerAdvice;
  fan: Set<string>;
}) {
  const { t } = useTranslation();
  const shouldPull = item.id != null ? advice?.[item.id]?.shouldPull : undefined;
  // A card's whole tile opens its page; a trainee has no page.
  const href = item.card && item.id != null ? cardUrl(item.id) : undefined;
  return (
    <li>
      <CardRow
        href={href}
        icon={item.icon ?? undefined}
        name={<FanTl fan={fan.has(item.name)}>{item.name}</FanTl>}
        title={item.title && <FanTl fan={fan.has(item.title)}>{item.title}</FanTl>}
        badge={
          item.isNew && (
            <Pill variant="status" status="live">
              {t('timeline.new')}
            </Pill>
          )
        }
        meta={
          <>
            <span className={styles.itemMeta}>
              {item.card ? <CardRank id={item.id} rankings={rankings} /> : item.stars != null && STARS[item.stars]}
              {item.copies && <span>{t('timeline.copies', { count: item.copies })}</span>}
            </span>
            {shouldPull && <ShouldPullChip pill={shouldPull} asked className={styles.pull} />}
          </>
        }
        large
        className={clsx(styles.tile, href && styles.tileLink)}
      >
        {href && <ChevronRight className={styles.chevron} size={20} aria-hidden="true" />}
      </CardRow>
    </li>
  );
}

function CardRank({ id, rankings }: { id: number | null; rankings: RankResult | null }) {
  const { t } = useTranslation();
  // The card's stat shows while it's being ranked too.
  const stat = id == null ? undefined : cardStat(id);
  if (!rankings)
    return (
      <span className={styles.rank}>
        {t('common.ranking')}
        {stat && <TypePill stat={stat} plain />}
      </span>
    );
  const rank: CardRankValue | null | undefined = id == null ? undefined : rankings.ranks.get(id);
  if (!rank) return <span className={clsx(styles.rank, styles.missing)}>{t('timeline.notRanked')}</span>;
  return (
    <span className={styles.rank}>
      <TierChip tier={rank.tier} />
      {t('common.rank', { position: rank.position })}
      <TypePill stat={rank.stat} plain />
    </span>
  );
}

export function RankNote({ scenario, server, upcoming }: { scenario: string; server: ServerKey; upcoming?: boolean }) {
  const { t } = useTranslation();
  return (
    <p className={shared.rankNote}>
      {t('timeline.rankNote', { scenario: scenarioName(scenario) })}
      {upcoming && ` ${t('timeline.upcomingRankNote', { server: serverName(server) })}`}
    </p>
  );
}
