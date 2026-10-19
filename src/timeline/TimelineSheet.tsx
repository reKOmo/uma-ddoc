import { ArrowLeftRight, ChevronRight, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import Sheet, { SheetTitle } from '../Sheet.tsx';
import Pill from '../ui/Pill.tsx';
import SeeMore from '../ui/SeeMore.tsx';
import ShouldPullLine from '../ui/ShouldPullLine.tsx';
import InfoTip from '../ui/InfoTip.tsx';
import StatusBadge from './StatusBadge.tsx';
import RaceTrack from './RaceTrack.tsx';
import { DistanceBars, GroundDrops, SeasonIcon, TimeIcon, TurnArrow, WeatherIcon } from './RaceIcons.tsx';
import { TIER_NAMES } from '../tiers.ts';
import { STAT_ICONS } from '../statIcons.ts';
import { formatNumber, scenarioName, serverName, statName } from '../i18n/index.ts';
import { umapyoiUrl } from '../umapyoi.ts';
import { useSettings } from '../settings.tsx';
import { loadPullGuide } from '../pullGuide.ts';
import { useAsync } from '../useAsync.ts';
import { itemList } from './events.ts';
import { type DateFormats, barLabel, dateRange, daysOf, entryTitle, kindName } from './format.ts';
import { type CardRank as CardRankValue, type RankResult, cardStat, useRankings } from './useRankings.ts';
import type { Entry, EntryGroup } from './entries.ts';
import type { EventItem, Phase, Race } from '../../shared/schemas/event.ts';
import type { PullGuide } from '../../shared/schemas/pullGuide.ts';
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
  onSelect: (entry: Entry) => void;
  onClose: () => void;
  onClosed?: () => void;
};

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
  // The guide is advice for Global's banners (JP's share their ids, so it would match there too).
  const guide = useAsync(loadPullGuide, []).data;
  const advice = server === 'gl' ? guide?.banners[entry.id] : undefined;
  const nothing =
    !entry.featured.length &&
    !entry.items.length &&
    !entry.titles.length &&
    !entry.phases.length &&
    !entry.races.length;
  return (
    <Sheet open={open} onClose={onClose} onClosed={onClosed}>
      {entry.art && (
        <img className={clsx(styles.art, entry.art.official && styles.official)} src={entry.art.src} alt="" />
      )}
      <Header entry={entry} format={format} />
      <Relations entry={entry} lookup={lookup} format={format} onSelect={onSelect} />
      <Featured entry={entry} rankings={rankings} advice={advice} />
      <Races races={entry.races} predicted={!!entry.prediction} />
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

function Header({ entry, format }: { entry: Entry; format: DateFormats }) {
  const { t } = useTranslation();
  const days = daysOf(entry);
  return (
    <>
      <Pill variant="kind" tone={entry.tone}>
        {kindName(entry)}
      </Pill>
      <SheetTitle className={styles.title}>{entryTitle(entry)}</SheetTitle>
      {/* A div: the info's popup sits inside it. */}
      <div className={styles.dates}>
        <StatusBadge status={entry.status} />
        {entry.paid && <span className={clsx(styles.badge, styles.paid)}>{t('timeline.paidBadge')}</span>}
        {/* One item, so the (i) wraps with the text's end, not onto a line of its own. */}
        <span>
          {dateRange(entry, format.time)}
          {days != null && ` · ${t('timeline.days', { count: days })}`} <Provenance entry={entry} format={format} />
        </span>
      </div>
    </>
  );
}

// Where a prediction's dates come from, what a paid banner is: behind an (i) after the dates.
function Provenance({ entry, format }: { entry: Entry; format: DateFormats }) {
  const { t } = useTranslation();
  const { prediction } = entry;
  const jpStart = prediction?.from.start;
  const jpDates =
    prediction && jpStart && dateRange({ start: jpStart, end: prediction.from.end, openEnded: false }, format.long);
  if (!prediction && !entry.paid) return null;
  return (
    <InfoTip label={t('timeline.aboutDates')}>
      {prediction && (
        <p>
          {prediction.confirmed
            ? t('timeline.confirmedFrom', { dates: jpDates })
            : t('timeline.predictedFrom', { dates: jpDates, count: prediction.margin })}{' '}
          {t('timeline.fromJp')}
        </p>
      )}
      {entry.paid && <p>{t('timeline.paid')}</p>}
    </InfoTip>
  );
}

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

type BannerAdvice = PullGuide['banners'][string] | undefined;

function Featured({ entry, rankings, advice }: { entry: Entry; rankings: RankResult | null; advice: BannerAdvice }) {
  const { t } = useTranslation();
  if (!entry.featured.length) return null;
  return (
    <>
      <h3 className={styles.heading}>{t(FEATURED_HEADING[entry.group])}</h3>
      <ul className={styles.featured}>
        {entry.featured.map((item) => (
          <FeaturedItem key={item.key} item={item} rankings={rankings} advice={advice} />
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
}: {
  item: FeaturedEntry;
  rankings: RankResult | null;
  advice: BannerAdvice;
}) {
  const { t } = useTranslation();
  const shouldPull = item.id != null ? advice?.[item.id]?.shouldPull : undefined;
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
        {/* Its own row: next to the rank it pushed "See more" to a second line on a phone. */}
        {shouldPull && <ShouldPullLine pill={shouldPull} className={styles.pull} />}
      </div>
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
        {stat && <img className={styles.rankStat} src={STAT_ICONS[stat]} alt="" />}
        {stat && statName(stat)}
      </span>
    );
  const rank: CardRankValue | null | undefined = id == null ? undefined : rankings.ranks.get(id);
  if (!rank) return <span className={clsx(styles.rank, styles.missing)}>{t('timeline.notRanked')}</span>;
  return (
    <span className={styles.rank}>
      <span className={clsx(styles.rankTier, `tier-${rank.tier}`)}>{TIER_NAMES[rank.tier]}</span>
      {t('common.rank', { position: rank.position })}
      <img className={styles.rankStat} src={STAT_ICONS[rank.stat]} alt="" />
      {statName(rank.stat)}
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

// Each race a card: its course as a headline ("Nakayama Turf 2500m"), the rest as labelled facts. A predicted
// event's are JP's.
function Races({ races, predicted }: { races: Race[]; predicted: boolean }) {
  const { t } = useTranslation();
  if (!races.length) return null;
  const word = (field: string, value: string | null) => value && t(`events.race.${field}.${value}`);
  return (
    <>
      <h3 className={styles.heading}>{t('events.race.heading', { count: races.length })}</h3>
      <ul className={styles.races}>
        {races.map((race, i) => {
          const direction = word('direction', race.direction);
          const course = word('course', race.course);
          const varies = race.variable && t('events.race.varies');
          const facts: [string, string | null | false, (() => ReactNode)?][] = [
            ['category', word('category', race.category), () => <DistanceBars category={race.category} />],
            [
              'turns',
              direction && course ? t('events.race.turns', { direction, course }) : direction,
              () => <TurnArrow direction={race.direction} />,
            ],
            ['season', word('season', race.season), () => <SeasonIcon season={race.season} />],
            ['weather', word('weather', race.weather) || varies, () => <WeatherIcon weather={race.weather} />],
            ['ground', word('ground', race.ground) || varies, () => <GroundDrops ground={race.ground} />],
            ['time', word('time', race.time), () => <TimeIcon time={race.time} />],
          ];
          const name = [race.name, race.opponent && t('events.race.vs', { name: race.opponent })]
            .filter(Boolean)
            .join(' · ');
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a post's races in its order, never reordered
            <li key={i} className={styles.race}>
              {name && <span className={styles.raceName}>{name}</span>}
              <div className={styles.raceHead}>
                <RaceTrack distance={race.distance} direction={race.direction} />
                <strong className={styles.raceCourse}>
                  {[
                    t(`events.race.track.${race.track}`, { defaultValue: race.track }),
                    word('surface', race.surface),
                    race.distance != null && `${race.distance}m`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </strong>
              </div>
              <dl className={styles.raceFacts}>
                {facts.map(
                  ([key, value, icon]) =>
                    value && (
                      <div key={key} className={key === 'turns' ? styles.wide : undefined}>
                        <dt>{t(`events.race.label.${key}`)}</dt>
                        <dd>
                          {icon?.()}
                          {value}
                        </dd>
                      </div>
                    )
                )}
              </dl>
            </li>
          );
        })}
      </ul>
      {predicted && <p className={styles.rankNote}>{t('events.race.fromJp')}</p>}
    </>
  );
}

// JP's items use Global's names where Global has them (the ones it doesn't stay Japanese).
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
            {item.count == null ? item.name : t('timeline.itemCount', { name: item.name, count: count(item.count) })}
          </li>
        ))}
      </ul>
    </>
  );
}

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

// Not LinkButton: the sheet's icons are 15 px (LinkButton's are 16).
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
