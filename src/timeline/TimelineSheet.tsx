import { ArrowLeftRight, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import Sheet, { SheetTitle } from '../ui/Sheet.tsx';
import Pill from '../ui/Pill.tsx';
import StatusBadge from '../ui/StatusBadge.tsx';
import TierChip from '../ui/TierChip.tsx';
import LinkButton from '../ui/LinkButton.tsx';
import { CardRow } from '../ui/CardRow.tsx';
import ShouldPullChip from '../ui/ShouldPullChip.tsx';
import InfoTip from '../ui/InfoTip.tsx';
import RaceTrack from './RaceTrack.tsx';
import { DistanceBars, GroundDrops, SeasonIcon, TimeIcon, TurnArrow, WeatherIcon } from './RaceIcons.tsx';
import TypePill from '../ui/TypePill.tsx';
import { formatNumber, formatTimeLeft, scenarioName, serverName } from '../i18n/index.ts';
import { umapyoiUrl } from '../lib/umapyoi.ts';
import { useSettings } from '../state/settings.ts';
import { loadPullGuide } from '../lib/pullGuide.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { itemList } from './events.ts';
import { type DateFormats, dateRange } from '../lib/dates.ts';
import { barLabel, daysOf, entryTitle, kindName, labelIsFan } from './format.ts';
import { FanTl } from '../ui/FanTl.tsx';
import { type CardRank as CardRankValue, type RankResult, cardStat, useRankings } from './useRankings.ts';
import type { Entry, EntryGroup } from './entries.ts';
import type { EventItem, Phase, Race } from '../../shared/schemas/event.ts';
import type { PullGuide } from '../../shared/schemas/pullGuide.ts';
import { cardUrl, timelineUrl } from '../routes.ts';
import type { SERVERS } from '../lib/servers.ts';
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

type TimelineSheetProps = {
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
    !entry.races.length &&
    !entry.scouts.length &&
    !entry.parts.length;
  return (
    <Sheet open={open} onClose={onClose} onClosed={onClosed}>
      {entry.art && (
        <img className={clsx(styles.art, entry.art.official && styles.official)} src={entry.art.src} alt="" />
      )}
      <Header entry={entry} format={format} />
      <Relations entry={entry} lookup={lookup} format={format} onSelect={onSelect} />
      {/* First: what a player gets for free. */}
      <FreeScouts entry={entry} lookup={lookup} format={format} onSelect={onSelect} />
      <Featured entry={entry} rankings={rankings} advice={advice} />
      <Races races={entry.races} predicted={!!entry.prediction} />
      <Rewards items={entry.items} fan={entry.fan} />
      <Schedule entry={entry} format={format} />
      <Titles titles={entry.titles} fan={entry.fan} />
      {/* Its note (a paid scout's "Any ★3") where nothing else is listed; an empty sheet says nothing. */}
      {nothing && entry.note && <p className={styles.empty}>{entry.note}</p>}
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
      <div className={styles.pills}>
        <Pill variant="tinted" tone={entry.tone}>
          {kindName(entry)}
        </Pill>
        <StatusPill entry={entry} />
        {/* (the card page's paid banners' tone) */}
        {entry.paid && (
          <Pill variant="status" tone="kind-champions_meeting" size="lg">
            {t('timeline.paidBadge')}
          </Pill>
        )}
      </div>
      <SheetTitle className={styles.title}>
        <FanTl fan={labelIsFan(entry, { title: true })}>{entryTitle(entry)}</FanTl>
      </SheetTitle>
      {/* A div: the info's popup sits inside it. One span, so the (i) wraps with the text's end. */}
      <div className={styles.dates}>
        <span>
          {format.sheet(entry)}
          {days != null && ` · ${t('timeline.days', { count: days })}`}
          {entry.endPredicted && ` · ${t('timeline.endPredicted')}`} <Provenance entry={entry} format={format} />
        </span>
      </div>
    </>
  );
}

// The status, and how long until it changes: a live entry's time left, an upcoming one's time to its start.
function StatusPill({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  const now = Date.now();
  const start = Date.parse(entry.start);
  const end = entry.end ? Date.parse(entry.end) : null;
  const left =
    entry.status === 'live'
      ? end != null && end > now && t('timeline.timeLeft', { duration: formatTimeLeft(end - now, { narrow: true }) })
      : entry.status !== 'ended' &&
        start > now &&
        t('timeline.startsIn', { duration: formatTimeLeft(start - now, { narrow: true }) });
  // The status alone on the pill; how long is left beside it, as plain text.
  // (the two kept together: they wrap as one)
  return (
    <span className={styles.statusGroup}>
      <StatusBadge status={entry.status} size="lg" />
      {left && <span className={styles.timeLeft}>{left}</span>}
    </span>
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
      {/* The count beside the heading, not in it: the list says how many to a screen reader. */}
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>{t(FEATURED_HEADING[entry.group])}</h3>
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
                        <dt className="section-label">{t(`events.race.label.${key}`)}</dt>
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
function Rewards({ items, fan }: { items: EventItem[]; fan: Set<string> }) {
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
            <FanTl fan={fan.has(item.name)}>
              {item.count == null ? item.name : t('timeline.itemCount', { name: item.name, count: count(item.count) })}
            </FanTl>
          </li>
        ))}
      </ul>
    </>
  );
}

// Free scout windows: a campaign's, each banner (a link to it); a banner's, each campaign giving them. Then the pulls,
// its dates under them. A predicted Global banner's are what JP gave (with no JP campaign on the calendar: the
// count alone).
function FreeScouts({
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
  const fromJp = entry.group !== 'event' && !!entry.prediction;
  if (!entry.scouts.length && entry.freePulls == null) return null;
  return (
    <>
      <h3 className={styles.heading}>{t(fromJp ? 'timeline.freeScoutsJp' : 'timeline.freeScouts')}</h3>
      <ul className={styles.list}>
        {!entry.scouts.length && (
          <li>
            <span />
            <span className={styles.pulls}>
              <strong>{t('timeline.freePulls', { count: entry.freePulls })}</strong>
            </span>
          </li>
        )}
        {entry.scouts.map((row) => {
          // (the banner, on a campaign; the campaign, on a banner)
          const other = row.target ? lookup(row.target) : undefined;
          const dates = dateRange({ start: row.start, end: row.end }, format.short);
          return (
            <li key={`${row.scout} ${row.start}`}>
              {other ? (
                <button type="button" className={styles.part} onClick={() => onSelect(other)}>
                  <span className={styles.dot} data-tone={other.tone} aria-hidden="true" />
                  {entryTitle(other)}
                </button>
              ) : (
                <span>{row.scout}</span>
              )}
              {/* The pulls stand out; the window and how they come under them. */}
              <span className={styles.pulls}>
                <strong>{t('timeline.freePulls', { count: row.scouts * row.size })}</strong>
                <small>{row.size === 10 ? `${dates} · ${t('timeline.tenTimes', { times: row.scouts })}` : dates}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// When a phase ends: its own end, else when the next one starts, else the event's end.
const phaseEnd = (phases: Phase[], i: number, eventEnd: string | null): string | null =>
  phases[i].end?.date ??
  phases.slice(i + 1).find((p) => Date.parse(p.start.date) > Date.parse(phases[i].start.date))?.start.date ??
  eventEnd;

function Schedule({ entry, format }: { entry: Entry; format: DateFormats }) {
  const { t } = useTranslation();
  const { phases } = entry;
  if (!phases.length) return null;
  const now = Date.now();
  // The phase running now; of overlapping ones, the one that started last.
  // (only while the event is live: an ended event's phases all ended, nothing to tell apart)
  const live = entry.status === 'live';
  const ends = phases.map((_, i) => phaseEnd(phases, i, entry.end));
  const ended = (i: number): boolean => live && ends[i] != null && Date.parse(ends[i]) <= now;
  let current = -1;
  if (live)
    phases.forEach((phase, i) => {
      const start = Date.parse(phase.start.date);
      if (start <= now && !ended(i) && (current < 0 || start >= Date.parse(phases[current].start.date))) current = i;
    });
  const currentEnd = current >= 0 ? ends[current] : null;
  return (
    <>
      <h3 className={styles.heading}>{t('timeline.schedule')}</h3>
      <ul className={clsx(styles.list, styles.schedule)}>
        {phases.map((phase, i) => {
          // (a "coming soon" post's schedule: what it doesn't give yet is the prediction's)
          const predicted = [phase.start, phase.end].some((d) => d?.status === 'predicted');
          const dates = format.sheet({ start: phase.start.date, end: phase.end?.date ?? null });
          return (
            // The phase running now isn't greyed out for its predicted dates: it is happening; only its countdown,
            // to a predicted end, is.
            <li
              key={phase.key}
              className={clsx(predicted && i !== current && styles.predicted, ended(i) && styles.ended)}
            >
              <span className={styles.phaseName}>
                {/* Every row keeps the dot's room, so the names line up. */}
                {current >= 0 && (
                  <span className={styles.phaseDot}>
                    {i === current && (
                      <span className={styles.ping} role="img" aria-label={t('timeline.status.live')} />
                    )}
                  </span>
                )}
                <span>
                  {t(`events.phase.${phase.key}`)}
                  {i === current && currentEnd && (
                    <span className={clsx(styles.endsIn, predicted && styles.endsInPredicted)}>
                      {t('timeline.endsIn', { duration: formatTimeLeft(Date.parse(currentEnd) - now) })}
                    </span>
                  )}
                </span>
              </span>
              <small>{predicted ? `${dates} · ${t('timeline.status.predicted')}` : dates}</small>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// One mark for the line: the titles are a list in one sentence.
function Titles({ titles, fan }: { titles: string[]; fan: Set<string> }) {
  const { t } = useTranslation();
  return (
    titles.length > 0 && (
      <p className={styles.titles}>
        <FanTl fan={titles.some((title) => fan.has(title))}>{t('timeline.titles', { titles })}</FanTl>
      </p>
    )
  );
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
              <FanTl fan={labelIsFan(part)}>{barLabel(part)}</FanTl>
              {part.featured.length > 0 && (
                <Pill variant="tag" size="sm">
                  {t('timeline.supportCards')}
                </Pill>
              )}
            </button>
            <small>{dateRange(part, format.short)}</small>
          </li>
        ))}
      </ul>
    </>
  );
}

// "Read announcement", the site after it; named in full for a screen reader.
function NewsLink({ href, site }: { href: string; site: string }) {
  const { t } = useTranslation();
  return (
    <LinkButton className={styles.newsLink} href={href} external aria-label={t('timeline.newsOn', { site })}>
      {t('timeline.news')}
      <span className={styles.site}>{site}</span>
    </LinkButton>
  );
}

function Links({ news, counterpart }: { news: Entry['news']; counterpart: Entry['counterpart'] }) {
  const { t } = useTranslation();
  const { jpNewsLanguage } = useSettings().settings;
  if (!news && !counterpart) return null;
  const umapyoi = news && umapyoiUrl(news.url, jpNewsLanguage);
  return (
    <p className={styles.links}>
      {counterpart && (
        <LinkButton href={timelineUrl(counterpart.server, counterpart.id)} icon={ArrowLeftRight} filled>
          {t('timeline.counterpart', { server: serverName(counterpart.server) })}
        </LinkButton>
      )}
      {news && <NewsLink href={news.url} site={news.site} />}
      {umapyoi && <NewsLink href={umapyoi} site="umapyoi.net" />}
    </p>
  );
}
