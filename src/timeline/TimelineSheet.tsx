// The Timeline's sheet (TimelineSheet.module.css): one layout for every banner and event, only the content changes.
import { ArrowLeftRight, ChevronRight, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Sheet, { SheetTitle } from '../Sheet.tsx';
import Pill from '../ui/Pill.tsx';
import SeeMore from '../ui/SeeMore.tsx';
import StatusBadge from './StatusBadge.tsx';
import { TIER_NAMES } from '../tiers.ts';
import { formatNumber, scenarioName, serverName, statName } from '../i18n/index.ts';
import { umapyoiUrl } from '../umapyoi.ts';
import { useSettings } from '../settings.tsx';
import { itemList } from './events.ts';
import { type DateFormats, barLabel, dateRange, daysOf, entryTitle, kindName } from './format.ts';
import { type CardRank as CardRankValue, type RankResult, useRankings } from './useRankings.ts';
import type { Entry, EntryGroup } from './entries.ts';
import type { EventItem, Phase } from '../../shared/schemas/event.ts';
import { cardUrl, timelineUrl } from '../routes.ts';
import type { SERVERS } from '../servers.ts';
import styles from './TimelineSheet.module.css';

type ServerKey = keyof typeof SERVERS;
type Lookup = (key: string) => Entry | undefined;

// Trainee icons don't show rarity (card icons do), so it's spelled out.
const STARS = ['', '★1', '★2', '★3'];
const FEATURED_HEADING: Record<EntryGroup, string> = {
  characters: 'timeline.featuredTrainees',
  cards: 'timeline.featuredCards',
  event: 'timeline.supportCards',
};

export type TimelineSheetProps = {
  entry: Entry;
  lookup: Lookup;
  server: ServerKey;
  scenario: string;
  format: DateFormats;
  open: boolean;
  // Opens another entry's sheet (a part, a relation).
  onSelect: (entry: Entry) => void;
  onClose: () => void;
  // Once the sheet has slid away.
  onClosed?: () => void;
};

// One banner or event (an entry, ./entries.ts), the same sheet for all of them on either server: art, kind and name,
// status and dates, where its dates come from, how it relates to others, what it features or gives, its schedule,
// its parts, its post. Sections without content aren't shown. `lookup(key)`: another entry on the calendar;
// `onSelect(entry)` opens it. `open` false: sliding away, then `onClosed()`.
export default function TimelineSheet({
  entry,
  lookup,
  server,
  scenario,
  format,
  open,
  onSelect,
  onClose,
  onClosed,
}: TimelineSheetProps) {
  const { t } = useTranslation();
  const cardIds = entry.featured.flatMap((item) => (item.card && item.id != null ? [item.id] : []));
  const rankings = useRankings(server, scenario, cardIds);
  const nothing = !entry.featured.length && !entry.items.length && !entry.titles.length && !entry.phases.length;
  return (
    <Sheet open={open} onClose={onClose} onClosed={onClosed}>
      {entry.art && (
        <img className={clsx(styles.art, entry.art.official && styles.official)} src={entry.art.src} alt="" />
      )}
      <Header entry={entry} format={format} />
      <Provenance entry={entry} format={format} />
      <Relations entry={entry} lookup={lookup} format={format} onSelect={onSelect} />
      <Featured entry={entry} rankings={rankings} />
      <Rewards items={entry.items} />
      <Schedule phases={entry.phases} format={format} />
      <Titles titles={entry.titles} />
      {nothing && <p className={styles.empty}>{entry.note ?? t('timeline.nothingListed')}</p>}
      <Parts entry={entry} lookup={lookup} format={format} onSelect={onSelect} />
      {cardIds.length > 0 && <RankNote scenario={scenario} server={server} upcoming={rankings?.upcoming} />}
      <Links news={entry.news} counterpart={entry.counterpart} />
    </Sheet>
  );
}

// Kind pill, name, status and dates.
function Header({ entry, format }: { entry: Entry; format: DateFormats }) {
  const { t } = useTranslation();
  const days = daysOf(entry);
  return (
    <>
      <Pill variant="kind" tone={entry.tone}>
        {kindName(entry)}
      </Pill>
      <SheetTitle className={styles.title}>{entryTitle(entry)}</SheetTitle>
      <p className={styles.dates}>
        <StatusBadge status={entry.status} />
        {entry.paid && <span className={clsx(styles.badge, styles.paid)}>{t('timeline.paidBadge')}</span>}
        {dateRange(entry, format.time)}
        {days != null && ` · ${t('timeline.days', { count: days })}`}
      </p>
    </>
  );
}

// Where its dates and content come from when it isn't the server's own record: predicted (or confirmed) from JP's,
// a paid scout.
function Provenance({ entry, format }: { entry: Entry; format: DateFormats }) {
  const { t } = useTranslation();
  const { prediction } = entry;
  const jpStart = prediction?.from.start;
  const jpDates =
    prediction && jpStart && dateRange({ start: jpStart, end: prediction.from.end, openEnded: false }, format.long);
  return (
    <>
      {prediction && (
        <p className={styles.note}>
          {prediction.confirmed
            ? t('timeline.confirmedFrom', { dates: jpDates })
            : t('timeline.predictedFrom', { dates: jpDates, count: prediction.margin })}{' '}
          {t('timeline.fromJp')}
        </p>
      )}
      {entry.paid && <p className={styles.note}>{t('timeline.paid')}</p>}
    </>
  );
}

// Re-run of / re-held (banners), part of (events): opens the other one; greyed when it isn't on the calendar.
function Relations({
  entry,
  lookup,
  format,
  onSelect,
}: {
  entry: Entry;
  lookup: Lookup;
  format: DateFormats;
  onSelect: (entry: Entry) => void;
}) {
  const { t } = useTranslation();
  return entry.relations.map((relation) => {
    const target = relation.target ? lookup(relation.target) : undefined;
    return (
      <button
        type="button"
        key={relation.type}
        className={styles.relation}
        disabled={!target}
        onClick={target ? () => onSelect(target) : undefined}
      >
        {t(`timeline.relation.${relation.type}`, {
          dates: dateRange(relation, format.long),
          name: target && entryTitle(target),
        })}
        {target && <ChevronRight size={15} aria-hidden="true" />}
      </button>
    );
  });
}

// A banner's featured trainees or cards, an event's support cards: each card with its tier-list rank.
function Featured({ entry, rankings }: { entry: Entry; rankings: RankResult | null }) {
  const { t } = useTranslation();
  if (!entry.featured.length) return null;
  return (
    <>
      <h3 className={styles.heading}>{t(FEATURED_HEADING[entry.group])}</h3>
      <ul className={styles.featured}>
        {entry.featured.map((item) => (
          <FeaturedItem key={item.key} item={item} rankings={rankings} />
        ))}
      </ul>
    </>
  );
}

type FeaturedEntry = Entry['featured'][number];

function FeaturedItem({ item, rankings }: { item: FeaturedEntry; rankings: RankResult | null }) {
  const { t } = useTranslation();
  return (
    <li>
      {/* NEW sits on the icon, leaving the rank row room for "See more". */}
      <div className={styles.itemIcon}>
        {item.icon && <img src={item.icon} alt="" loading="lazy" />}
        {item.isNew && <span className={clsx(styles.badge, styles.new)}>{t('timeline.new')}</span>}
      </div>
      <div className={styles.itemInfo}>
        <span className={styles.itemName}>
          <strong>{item.name}</strong>
          {item.title && (
            <span className={styles.itemTitle} title={item.title}>
              {item.title}
            </span>
          )}
        </span>
        <span className={styles.itemMeta}>
          {item.card ? <CardRank id={item.id} rankings={rankings} /> : item.stars != null && STARS[item.stars]}
          {item.copies && <span>{t('timeline.copies', { count: item.copies })}</span>}
          {item.card && item.id != null && (
            <SeeMore href={cardUrl(item.id)} className={styles.cardLink}>
              {t('timeline.seeMore')}
            </SeeMore>
          )}
        </span>
      </div>
    </li>
  );
}

// A card's MLB tier and position in its stat's tier list.
function CardRank({ id, rankings }: { id: number | null; rankings: RankResult | null }) {
  const { t } = useTranslation();
  if (!rankings) return <span className={clsx(styles.rank, styles.pending)}>{t('common.ranking')}</span>;
  const rank: CardRankValue | null | undefined = id == null ? undefined : rankings.ranks.get(id);
  if (!rank) return <span className={clsx(styles.rank, styles.missing)}>{t('timeline.notRanked')}</span>;
  return (
    <span className={styles.rank}>
      <span className={clsx(styles.rankTier, `tier-${rank.tier}`)}>{TIER_NAMES[rank.tier]}</span>
      {t('common.rank', { position: rank.position })} {statName(rank.stat)}
    </span>
  );
}

function RankNote({ scenario, server, upcoming }: { scenario: string; server: ServerKey; upcoming?: boolean }) {
  const { t } = useTranslation();
  return (
    <p className={styles.rankNote}>
      {t('timeline.rankNote', { scenario: scenarioName(scenario) })}
      {upcoming && ` ${t('timeline.upcomingRankNote', { server: serverName(server) })}`}
    </p>
  );
}

// An event's other rewards (JP's items go by Global's names where Global has them, to sort alike; shown as JP calls
// them).
function Rewards({ items }: { items: EventItem[] }) {
  const { t } = useTranslation();
  if (!items.length) return null;
  const count = (value: NonNullable<EventItem['count']>) =>
    typeof value === 'number'
      ? formatNumber(value)
      : t('timeline.range', { min: formatNumber(value.min), max: formatNumber(value.max) });
  return (
    <>
      <h3 className={styles.heading}>{t('timeline.items')}</h3>
      <ul className={styles.rewards}>
        {itemList(items).map((item) => (
          <li key={item.name}>
            {item.count == null
              ? (item.local ?? item.name)
              : t('timeline.itemCount', { name: item.local ?? item.name, count: count(item.count) })}
          </li>
        ))}
      </ul>
    </>
  );
}

// A cup's schedule (Champions Meetings, League of Heroes).
function Schedule({ phases, format }: { phases: Phase[]; format: DateFormats }) {
  const { t } = useTranslation();
  if (!phases.length) return null;
  return (
    <>
      <h3 className={styles.heading}>{t('timeline.schedule')}</h3>
      <ul className={clsx(styles.list, styles.schedule)}>
        {phases.map((phase) => (
          <li key={phase.key}>
            <span>{t(`events.phase.${phase.key}`)}</span>
            <small>{dateRange(phase, format.time)}</small>
          </li>
        ))}
      </ul>
    </>
  );
}

function Titles({ titles }: { titles: string[] }) {
  const { t } = useTranslation();
  return titles.length > 0 && <p className={styles.titles}>{t('timeline.titles', { titles })}</p>;
}

// Its parts (a celebration's sub-events, an event's mission sets): each opens its own sheet.
function Parts({
  entry,
  lookup,
  format,
  onSelect,
}: {
  entry: Entry;
  lookup: Lookup;
  format: DateFormats;
  onSelect: (entry: Entry) => void;
}) {
  const { t } = useTranslation();
  const parts = entry.parts.map((key) => lookup(key)).filter((part): part is Entry => part !== undefined);
  if (!parts.length) return null;
  return (
    <>
      <h3 className={styles.heading}>{t('timeline.includes')}</h3>
      <ul className={styles.list}>
        {parts.map((part) => (
          <li key={part.key}>
            <button type="button" className={styles.part} onClick={() => onSelect(part)}>
              <span className={styles.dot} data-tone={part.tone} aria-hidden="true" />
              {barLabel(part)}
              {part.featured.length > 0 && <small className={styles.hasCards}>{t('timeline.supportCards')}</small>}
            </button>
            <small>{dateRange(part, format.short)}</small>
          </li>
        ))}
      </ul>
    </>
  );
}

// The same banner or event on the other server (opens it there, in the Timeline), its post, and umapyoi.net's copy.
// Its own link markup, not LinkButton: the sheet's icons are 15 px (LinkButton's are 16).
function Links({ news, counterpart }: { news: Entry['news']; counterpart: Entry['counterpart'] }) {
  const { t } = useTranslation();
  const { jpNewsLanguage } = useSettings().settings;
  if (!news && !counterpart) return null;
  const umapyoi = news && umapyoiUrl(news.url, jpNewsLanguage);
  return (
    <p className={styles.links}>
      {counterpart && (
        <a className={styles.link} href={timelineUrl(counterpart.server, counterpart.id)}>
          <ArrowLeftRight size={15} aria-hidden="true" />
          {t('timeline.counterpart', { server: serverName(counterpart.server) })}
        </a>
      )}
      {news && (
        <a className={styles.link} href={news.url} target="_blank" rel="noreferrer">
          {t('timeline.news', { site: news.site })}
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      )}
      {umapyoi && (
        <a className={styles.link} href={umapyoi} target="_blank" rel="noreferrer">
          {t('timeline.umapyoi')}
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      )}
    </p>
  );
}
