// @ts-nocheck
import { ArrowLeftRight, ChevronRight, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Sheet, { SheetTitle } from '../Sheet.tsx';
import StatusBadge from './StatusBadge.tsx';
import { TIER_NAMES } from '../tiers.ts';
import { formatNumber, scenarioName, serverName, statName } from '../i18n/index.ts';
import { umapyoiUrl } from '../umapyoi.ts';
import { useSettings } from '../settings.tsx';
import { itemList } from './events.ts';
import { barLabel, dateRange, daysOf, entryTitle, kindName } from './format.ts';
import { useRankings } from './useRankings.ts';
import './sheet.css';
import { cardUrl, timelineUrl } from '../routes.ts';

// Trainee icons don't show rarity (card icons do), so it's spelled out.
const STARS = ['', '★1', '★2', '★3'];
const FEATURED_HEADING = {
  characters: 'timeline.featuredTrainees',
  cards: 'timeline.featuredCards',
  event: 'timeline.supportCards',
};

// One banner or event (an entry, ./entries.js), the same sheet for all of them on either server: art, kind and name,
// status and dates, where its dates come from, how it relates to others, what it features or gives, its schedule,
// its parts, its post. Sections without content aren't shown. `lookup(key)`: another entry on the calendar;
// `onSelect(entry)` opens it. `open` false: sliding away, then `onClosed()`.
export default function TimelineSheet({ entry, lookup, server, scenario, format, open, onSelect, onClose, onClosed }) {
  const { t } = useTranslation();
  const cardIds = entry.featured.filter((item) => item.card && item.id != null).map((item) => item.id);
  const rankings = useRankings(server, scenario, cardIds);
  const nothing = !entry.featured.length && !entry.items.length && !entry.titles.length && !entry.phases.length;
  return (
    <Sheet open={open} onClose={onClose} onClosed={onClosed}>
      {entry.art && <img className={clsx('sheet-art', entry.art.official && 'official')} src={entry.art.src} alt="" />}
      <Header entry={entry} format={format} />
      <Provenance entry={entry} format={format} />
      <Relations entry={entry} lookup={lookup} format={format} onSelect={onSelect} />
      <Featured entry={entry} rankings={rankings} />
      <Rewards items={entry.items} />
      <Schedule phases={entry.phases} format={format} />
      <Titles titles={entry.titles} />
      {nothing && <p className="sheet-empty">{entry.note ?? t('timeline.nothingListed')}</p>}
      <Parts entry={entry} lookup={lookup} format={format} onSelect={onSelect} />
      {cardIds.length > 0 && <RankNote scenario={scenario} server={server} upcoming={rankings?.upcoming} />}
      <Links news={entry.news} counterpart={entry.counterpart} />
    </Sheet>
  );
}

// Kind pill, name, status and dates.
function Header({ entry, format }) {
  const { t } = useTranslation();
  const days = daysOf(entry);
  return (
    <>
      <span className="entry-kind" data-tone={entry.tone}>
        {kindName(entry)}
      </span>
      <SheetTitle className="sheet-title">{entryTitle(entry)}</SheetTitle>
      <p className="sheet-dates">
        <StatusBadge status={entry.status} />
        {entry.paid && <span className="badge paid">{t('timeline.paidBadge')}</span>}
        {dateRange(entry, format.time)}
        {days != null && ` · ${t('timeline.days', { count: days })}`}
      </p>
    </>
  );
}

// Where its dates and content come from when it isn't the server's own record: predicted (or confirmed) from JP's,
// a paid scout.
function Provenance({ entry, format }) {
  const { t } = useTranslation();
  const { prediction } = entry;
  const jpDates = prediction && dateRange({ ...prediction.from, openEnded: false }, format.long);
  return (
    <>
      {prediction && (
        <p className="sheet-note">
          {prediction.confirmed
            ? t('timeline.confirmedFrom', { dates: jpDates })
            : t('timeline.predictedFrom', { dates: jpDates, count: prediction.margin })}{' '}
          {t('timeline.fromJp')}
        </p>
      )}
      {entry.paid && <p className="sheet-note">{t('timeline.paid')}</p>}
    </>
  );
}

// Re-run of / re-held (banners), part of (events): opens the other one; greyed when it isn't on the calendar.
function Relations({ entry, lookup, format, onSelect }) {
  const { t } = useTranslation();
  return entry.relations.map((relation) => {
    const target = relation.target && lookup(relation.target);
    return (
      <button
        type="button"
        key={relation.type}
        className="sheet-relation"
        disabled={!target}
        onClick={() => onSelect(target)}
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
function Featured({ entry, rankings }) {
  const { t } = useTranslation();
  if (!entry.featured.length) return null;
  return (
    <>
      <h3 className="sheet-heading">{t(FEATURED_HEADING[entry.group])}</h3>
      <ul className="featured">
        {entry.featured.map((item) => (
          <FeaturedItem key={item.key} item={item} rankings={rankings} />
        ))}
      </ul>
    </>
  );
}

function FeaturedItem({ item, rankings }) {
  const { t } = useTranslation();
  return (
    <li>
      {/* NEW sits on the icon, leaving the rank row room for "See more". */}
      <div className="item-icon">
        {item.icon && <img src={item.icon} alt="" loading="lazy" />}
        {item.isNew && <span className="badge new">{t('timeline.new')}</span>}
      </div>
      <div className="item-info">
        <span className="item-name">
          <strong>{item.name}</strong>
          {item.title && (
            <span className="item-title" title={item.title}>
              {item.title}
            </span>
          )}
        </span>
        <span className="item-meta">
          {item.card ? <CardRank id={item.id} rankings={rankings} /> : STARS[item.stars]}
          {item.copies && <span>{t('timeline.copies', { count: item.copies })}</span>}
          {item.card && item.id != null && (
            <a className="see-more" href={cardUrl(item.id)}>
              {t('timeline.seeMore')}
              <ChevronRight size={15} aria-hidden="true" />
            </a>
          )}
        </span>
      </div>
    </li>
  );
}

// A card's MLB tier and position in its stat's tier list.
function CardRank({ id, rankings }) {
  const { t } = useTranslation();
  if (!rankings) return <span className="rank pending">{t('common.ranking')}</span>;
  const rank = rankings.ranks.get(id);
  if (!rank) return <span className="rank missing">{t('timeline.notRanked')}</span>;
  return (
    <span className="rank">
      <span className={`rank-tier tier-${rank.tier}`}>{TIER_NAMES[rank.tier]}</span>
      {t('common.rank', { position: rank.position })} {statName(rank.stat)}
    </span>
  );
}

function RankNote({ scenario, server, upcoming }) {
  const { t } = useTranslation();
  return (
    <p className="rank-note">
      {t('timeline.rankNote', { scenario: scenarioName(scenario) })}
      {upcoming && ` ${t('timeline.upcomingRankNote', { server: serverName(server) })}`}
    </p>
  );
}

// An event's other rewards (JP's items go by Global's names where Global has them, to sort alike; shown as JP calls
// them).
function Rewards({ items }) {
  const { t } = useTranslation();
  if (!items.length) return null;
  const count = (value) =>
    typeof value === 'number'
      ? formatNumber(value)
      : t('timeline.range', { min: formatNumber(value.min), max: formatNumber(value.max) });
  return (
    <>
      <h3 className="sheet-heading">{t('timeline.items')}</h3>
      <ul className="sheet-rewards">
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
function Schedule({ phases, format }) {
  const { t } = useTranslation();
  if (!phases.length) return null;
  return (
    <>
      <h3 className="sheet-heading">{t('timeline.schedule')}</h3>
      <ul className="sheet-list sheet-schedule">
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

function Titles({ titles }) {
  const { t } = useTranslation();
  return titles.length > 0 && <p className="sheet-titles">{t('timeline.titles', { titles })}</p>;
}

// Its parts (a celebration's sub-events, an event's mission sets): each opens its own sheet.
function Parts({ entry, lookup, format, onSelect }) {
  const { t } = useTranslation();
  const parts = entry.parts.map(lookup).filter(Boolean);
  if (!parts.length) return null;
  return (
    <>
      <h3 className="sheet-heading">{t('timeline.includes')}</h3>
      <ul className="sheet-list">
        {parts.map((part) => (
          <li key={part.key}>
            <button type="button" className="sheet-part" onClick={() => onSelect(part)}>
              <span className="entry-dot" data-tone={part.tone} aria-hidden="true" />
              {barLabel(part)}
              {part.featured.length > 0 && <small className="has-cards">{t('timeline.supportCards')}</small>}
            </button>
            <small>{dateRange(part, format.short)}</small>
          </li>
        ))}
      </ul>
    </>
  );
}

// The same banner or event on the other server (opens it there, in the Timeline), its post, and umapyoi.net's copy.
function Links({ news, counterpart }) {
  const { t } = useTranslation();
  const { jpNewsLanguage } = useSettings().settings;
  if (!news && !counterpart) return null;
  const umapyoi = news && umapyoiUrl(news.url, jpNewsLanguage);
  return (
    <p className="sheet-links">
      {counterpart && (
        <a className="link-button" href={timelineUrl(counterpart.server, counterpart.id)}>
          <ArrowLeftRight size={15} aria-hidden="true" />
          {t('timeline.counterpart', { server: serverName(counterpart.server) })}
        </a>
      )}
      {news && (
        <a className="link-button" href={news.url} target="_blank" rel="noreferrer">
          {t('timeline.news', { site: news.site })}
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      )}
      {umapyoi && (
        <a className="link-button" href={umapyoi} target="_blank" rel="noreferrer">
          {t('timeline.umapyoi')}
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      )}
    </p>
  );
}
