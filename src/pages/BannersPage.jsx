import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Globe, LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import { rankByUsefulness } from '../../tierlist/index.js';
import { cards } from '../../tierlist/cards.js';
import { SERVERS } from '../servers.js';
import { STAT_OF_TYPE, TIER_NAMES, cardRanks } from '../tiers.js';
import { DAY, buildTimeline } from '../timeline.js';
import { globalProgress } from '../globalProgress.js';
import { scenarioSegments } from '../scenarioStrip.js';
import scenarioData from '../../data/scenarios.json' with { type: 'json' };
import { eventGroups, itemList, partCount, subEvents } from '../eventStrip.js';
import { getCollapsed, saveCollapsed } from '../timelineGroups.js';
import { useDragScroll } from '../useDragScroll.js';
import { Trans, useTranslation } from 'react-i18next';
import { timeZoneOptions, useSettings } from '../settings.jsx';
import i18n, { formatDate, formatDateTime, formatNumber, scenarioName, statName } from '../i18n/index.js';
import './banners.css';

import { PREDICTED, bannerStatus as status, loadBanners, loadEvents, loadRealBanners } from '../bannerData.js';
import StatusBadge from '../StatusBadge.jsx';
import { cardIcon } from '../gametora.js';
import { umapyoiUrl } from '../umapyoi.js';

const ZOOMS = [4, 8, 16, 32]; // pixels per day
// Trainee icons don't show rarity (card icons do), so it's spelled out.
const TRAINEE_RARITY = ['', '★1', '★2', '★3'];

// Banner times in the timezone picked in Settings: UTC (as the game announces them, the default)
// or the viewer's own.
function dateFormats(timeZone) {
  const zone = timeZoneOptions(timeZone);
  return {
    long: (iso) => formatDate(iso, { ...zone, year: 'numeric', month: 'short', day: 'numeric' }),
    short: (iso) => formatDate(iso, { ...zone, month: 'short', day: 'numeric' }),
    // The sheet's exact times: "Oct 14, 2026, 10:00 PM UTC".
    time: (iso) =>
      formatDateTime(iso, {
        ...zone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }),
    month: (date, withYear) => formatDate(date, { ...zone, month: 'short', ...(withYear && { year: 'numeric' }) }),
    isJanuary: (date) => (timeZone === 'utc' ? date.getUTCMonth() : date.getMonth()) === 0,
  };
}
// (A banner without an end, a JP paid scout "until further notice": since its start.)
const dateRange = (banner, format) =>
  banner.end
    ? i18n.t('common.dateRange', { start: format(banner.start), end: format(banner.end) })
    : i18n.t('banners.since', { date: format(banner.start) });
// A banner's art: the official one from the news where there is one (cropped differently from GameTora's).
const artOf = (banner) => banner.news_image ?? banner.image;
const isOfficialArt = (banner) => !!(banner.announced || banner.news_image);

// Label every day when there's room, else every 2nd day, else weekly. Weekly
// labels stop at the 22nd so they never collide with the next month's 1st.
const dayLabelStep = (px) => (px >= 16 ? 1 : px >= 8 ? 2 : 7);
const showDayLabel = (date, step) => (date - 1) % step === 0 && (step < 7 || date <= 22);

// When the last of these events ends (ms; one without an end: a day after its start).
const lastEnd = (events) =>
  Math.max(...events.filter((e) => e.start).map((e) => (e.end ? Date.parse(e.end) : Date.parse(e.start) + DAY)));

function barTitleKey(banner) {
  if (banner.confirmed) return 'banners.confirmedBarTitle';
  return banner.predicted ? 'banners.predictedBarTitle' : 'banners.barTitle';
}

function barLabel(banner) {
  // A scout without featured items (JP's paid ones: guaranteed ★3/SSR, step-up…) goes by its name from the post.
  if (!banner.main) return banner.name ?? '—';
  const others = banner.featured.length - 1;
  return others > 0 ? i18n.t('banners.barLabel', { name: banner.main.name, count: others }) : banner.main.name;
}

// `bannerId` (from #/timeline/<server>/<id>): a card banner to open and centre on once loaded.
export default function BannersPage({ server, scenario, bannerId }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [zoom, setZoom] = useState(2);
  const [selected, setSelected] = useState(null);
  const { timeZone } = useSettings().settings;
  const format = useMemo(() => dateFormats(timeZone), [timeZone]);
  const scroller = useRef(null);
  // Day to centre on after the next render (initial load, zoom, "Today").
  const centerOn = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    loadBanners(SERVERS[server].banners).then((banners) => {
      if (!cancelled) setData(banners);
    });
    return () => {
      cancelled = true;
    };
  }, [server]);

  // On JP's calendar: Global's banners (real + predicted, kept apart) to place Global in JP's history.
  const [globalBanners, setGlobalBanners] = useState(null);
  useEffect(() => {
    if (server !== 'jp' || globalBanners) return;
    const predicted = PREDICTED.global[0];
    Promise.all([loadRealBanners('global'), predicted ? predicted() : null]).then(([global, future]) =>
      setGlobalBanners({ global, predicted: future })
    );
  }, [server, globalBanners]);

  // The server's in-game events, in labelled groups under the banners (names as the news gives them: Japanese on JP);
  // events with parts (a celebration's sub-events, mission sets) are folded until opened.
  const [eventData, setEventData] = useState(null); // { server, events }
  useEffect(() => {
    let cancelled = false;
    loadEvents(SERVERS[server].banners).then((events) => {
      if (!cancelled) setEventData({ server, events });
    });
    return () => {
      cancelled = true;
    };
  }, [server]);
  const serverEvents = eventData?.server === server ? eventData.events : null;
  // (The calendar waits for the events too: predicted ones can run past the last banner.)
  const timeline = useMemo(
    () =>
      data &&
      serverEvents &&
      buildTimeline(
        [
          { key: 'characters', label: t('banners.characters'), banners: data.characters },
          { key: 'cards', label: t('banners.supportCards'), banners: data.cards },
        ],
        { utc: timeZone === 'utc', until: lastEnd(serverEvents) }
      ),
    [data, serverEvents, t, timeZone]
  );
  const px = ZOOMS[zoom];
  // The scroller only exists once the timeline has loaded.
  useDragScroll(scroller, !!timeline);

  const linked = useMemo(() => (bannerId && data?.cards.find((b) => b.id === bannerId)) || null, [bannerId, data]);

  useLayoutEffect(() => {
    if (!timeline || centerOn.current !== null) return;
    centerOn.current = linked
      ? timeline.at((Date.parse(linked.start) + Date.parse(linked.end ?? linked.start)) / 2)
      : timeline.today;
  }, [timeline, linked]);

  // Another server's calendar: the open sheet was the old one's.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on a server change only.
  useEffect(() => setSelected(null), [server]);

  // A linked banner opens its sheet.
  useEffect(() => {
    if (linked) setSelected({ banner: linked, kind: 'cards' });
  }, [linked]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || centerOn.current === null) return;
    el.scrollLeft = centerOn.current * px - el.clientWidth / 2;
    centerOn.current = null;
  });

  function changeZoom(next) {
    const el = scroller.current;
    centerOn.current = (el.scrollLeft + el.clientWidth / 2) / px;
    setZoom(next);
  }

  function scrollToDay(day) {
    const el = scroller.current;
    el.scrollTo({ left: day * px - el.clientWidth / 2, behavior: 'smooth' });
  }

  // The Career scenario strip at the top: which scenario runs when on this server.
  const scenarios = useMemo(() => scenarioSegments(scenarioData.scenarios, server), [server]);

  const events = useMemo(() => (serverEvents ? eventGroups(serverEvents) : []), [serverEvents]);
  const [unfolded, setUnfolded] = useState(() => new Set());
  // Groups (banner sections, event groups) folded away by their label, remembered in this browser.
  const [collapsed, setCollapsed] = useState(getCollapsed);
  const toggleGroup = (key) =>
    setCollapsed((old) => {
      const next = toggled(old, key);
      saveCollapsed(next);
      return next;
    });
  const toggleParts = (id) => setUnfolded((old) => toggled(old, id));

  // Where Global is in JP's history, as timeline days: the window it's going through and the estimate.
  const globalMark = useMemo(() => {
    if (server !== 'jp' || !timeline || !globalBanners) return null;
    const progress = globalProgress({ ...globalBanners, jp: data });
    if (!progress) return null;
    const { estimate, from, to, toKnown } = progress;
    return { day: timeline.at(estimate), from: timeline.at(from), to: timeline.at(to), toKnown, estimate };
  }, [server, timeline, globalBanners, data]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  return (
    <div className="banners-page">
      <header className="banners-header">
        <div className="toolbar">
          <div className="toolbar-end">
            {server === 'jp' && (
              <button
                type="button"
                onClick={() => scrollToDay(globalMark.day)}
                disabled={!globalMark}
                title={t('banners.globalNowTitle')}
              >
                <Globe size={18} aria-hidden="true" />
                {t('banners.globalNow')}
              </button>
            )}
            <button type="button" onClick={() => scrollToDay(timeline.today)} disabled={!timeline}>
              <LocateFixed size={18} aria-hidden="true" />
              {t('banners.today')}
            </button>
            <fieldset className="segmented" aria-label={t('banners.zoom')}>
              <button
                type="button"
                onClick={() => changeZoom(zoom - 1)}
                disabled={!timeline || zoom === 0}
                aria-label={t('banners.zoomOut')}
              >
                <ZoomOut size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => changeZoom(zoom + 1)}
                disabled={!timeline || zoom === ZOOMS.length - 1}
                aria-label={t('banners.zoomIn')}
              >
                <ZoomIn size={18} aria-hidden="true" />
              </button>
            </fieldset>
          </div>
        </div>
      </header>

      {!timeline ? (
        <p className="status">{t('banners.loading')}</p>
      ) : (
        <div className="timeline" ref={scroller}>
          {/* Half a screen of slack at the end, so today can always be centred. */}
          <div
            className="timeline-canvas"
            style={{ width: `calc(${timeline.days * px}px + 50vw)`, '--day': `${px}px` }}
          >
            <div className="axis">
              <ul className="axis-scenarios" aria-label={t('banners.scenarios')}>
                {scenarios.map((s) => {
                  const from = timeline.at(s.start);
                  const to = s.end === null ? timeline.days : timeline.at(s.end);
                  if (to <= 0 || from >= timeline.days) return null;
                  const dates =
                    s.end === null
                      ? t('banners.since', { date: format.long(s.start) })
                      : dateRange({ start: s.start, end: s.end }, format.long);
                  return (
                    <li
                      key={s.key}
                      className={`scenario tag-${s.tag}${s.current ? ' current' : ''}${s.ink ? ` ink-${s.ink}` : ''}`}
                      style={{
                        left: Math.max(from, 0) * px,
                        width: (to - Math.max(from, 0)) * px,
                        ...(s.color && { '--scenario-color': s.color }),
                      }}
                      title={t('banners.scenarioTitle', {
                        name: s.name,
                        status: t(`banners.scenarioTag.${s.tag}`),
                        dates,
                      })}
                    >
                      <a className="scenario-link" href={`#/scenario/${s.key}`}>
                        {/* The arrow: right after the name on desktop (moves with it), at the right edge on phones. */}
                        <span className="scenario-label">
                          <span className="scenario-name">
                            <strong>{scenarioName(s.key)}</strong> {s.name}
                          </span>
                          <ChevronRight className="scenario-arrow inline" size={16} aria-hidden="true" />
                        </span>
                        <ChevronRight className="scenario-arrow edge" size={16} aria-hidden="true" />
                      </a>
                    </li>
                  );
                })}
              </ul>
              <div className="axis-months">
                {timeline.months.map(({ date, day }) => (
                  <span key={day} className={format.isJanuary(date) ? 'tick year' : 'tick'} style={{ left: day * px }}>
                    {format.month(date, format.isJanuary(date))}
                  </span>
                ))}
              </div>
              <div className="axis-days">
                {timeline.dayDates
                  .filter(({ date }) => showDayLabel(date, dayLabelStep(px)))
                  .map(({ day, date }) => (
                    <span
                      key={day}
                      className={Math.floor(timeline.today) === Math.floor(day) ? 'day today' : 'day'}
                      style={{ left: day * px, width: px * dayLabelStep(px) }}
                    >
                      {date}
                    </span>
                  ))}
              </div>
            </div>
            {/* Where each Career scenario begins, down the whole calendar (the strip in the axis names them). */}
            {scenarios
              .filter((s) => timeline.at(s.start) > 0 && timeline.at(s.start) < timeline.days)
              .map((s) => (
                <div
                  key={s.key}
                  className={`scenario-line tag-${s.tag}`}
                  style={{ left: timeline.at(s.start) * px, ...(s.color && { '--scenario-color': s.color }) }}
                />
              ))}
            <div className="today-line" style={{ left: timeline.today * px }} />
            {globalMark && (
              <>
                {/* The stretch of JP's history Global is going through now (to its next banner's JP start). */}
                <div
                  className={globalMark.toKnown ? 'global-window' : 'global-window open-end'}
                  style={{ left: globalMark.from * px, width: Math.max((globalMark.to - globalMark.from) * px, 2) }}
                />
                <div
                  className="global-line"
                  style={{ left: globalMark.day * px }}
                  data-label={t('banners.globalLine', { date: format.short(globalMark.estimate) })}
                />
              </>
            )}

            {timeline.sections.map((section) => (
              <section key={section.key} className="lane-group">
                <GroupLabel
                  label={section.label}
                  collapsed={collapsed.has(section.key)}
                  onToggle={() => toggleGroup(section.key)}
                />
                {!collapsed.has(section.key) &&
                  section.rows.map((row, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: lanes have no identity of their own; their order is stable.
                    <div key={i} className="lane">
                      {row.map(({ banner, from, length }) => (
                        <button
                          type="button"
                          key={banner.id}
                          className={`bar ${section.key} ${status(banner)} type-${banner.main?.type ?? 'none'}${isOfficialArt(banner) ? ' official-art' : ''}`}
                          style={{
                            left: from * px,
                            width: Math.max(length * px, 6),
                            backgroundImage: `url(${artOf(banner)})`,
                          }}
                          title={t(barTitleKey(banner), {
                            label: barLabel(banner),
                            dates: dateRange(banner, format.long),
                          })}
                          onClick={() => setSelected({ banner, kind: section.key })}
                        >
                          <strong>{barLabel(banner)}</strong>
                          <small>{dateRange(banner, format.short)}</small>
                        </button>
                      ))}
                    </div>
                  ))}
              </section>
            ))}
            {events.map((group) => (
              <section key={group.key} className="lane-group events">
                <GroupLabel
                  label={t(`events.group.${group.key}`)}
                  collapsed={collapsed.has(`events-${group.key}`)}
                  onToggle={() => toggleGroup(`events-${group.key}`)}
                />
                {!collapsed.has(`events-${group.key}`) && (
                  <EventRows
                    rows={group.rows}
                    at={(ms) => timeline.at(ms) * px}
                    format={format}
                    unfolded={unfolded}
                    onToggle={toggleParts}
                    onSelect={(event) => setSelected({ event })}
                  />
                )}
              </section>
            ))}
          </div>
        </div>
      )}

      {selected?.event && serverEvents && (
        <EventSheet
          event={selected.event}
          events={serverEvents}
          format={format}
          onSelect={(event) => setSelected({ event })}
          onClose={() => setSelected(null)}
        />
      )}
      {selected?.banner && (
        <BannerSheet
          {...selected}
          server={server}
          scenario={scenario}
          format={format}
          banners={data}
          onSelect={(banner, kind) => {
            if (timeline)
              centerOn.current = timeline.at((Date.parse(banner.start) + Date.parse(banner.end ?? banner.start)) / 2);
            setSelected({ banner, kind });
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// Tier list rankings for the given stats, computed after the sheet has painted.
// Keyed by the joined stat names, since the caller builds a new array each render.
function useRankings(server, scenario, stats) {
  const [rankings, setRankings] = useState({});
  const key = stats.join();
  useEffect(() => {
    let cancelled = false;
    setRankings({});
    const stats = key ? key.split(',') : [];
    const timer = setTimeout(async () => {
      const results = await Promise.all(stats.map((stat) => rankByUsefulness(server, scenario, stat)));
      if (!cancelled) setRankings(Object.fromEntries(stats.map((stat, i) => [stat, results[i]])));
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [server, scenario, key]);
  return rankings;
}

// The card's MLB tier and position in its stat's tier list.
function CardRank({ item, rankings }) {
  const { t } = useTranslation();
  const stat = STAT_OF_TYPE[item.type];
  const ranking = rankings[stat];
  if (!ranking) return <span className="rank pending">{t('common.ranking')}</span>;
  const rank = cardRanks(ranking).get(`${item.id}/4`);
  if (!rank) return <span className="rank missing">{t('banners.notRanked')}</span>;
  return (
    <span className="rank">
      <span className={`rank-tier tier-${rank.tier}`}>{TIER_NAMES[rank.tier]}</span>
      {t('common.rank', { position: rank.position })} {statName(stat)}
    </span>
  );
}

function BannerSheet({ banner, kind, server, scenario, format, banners, onSelect, onClose }) {
  const { t } = useTranslation();
  // A re-run and its original (JP: a scout re-held after an issue) point to each other.
  const rerunOf = banner.rerunOf != null && banners?.[kind].find((b) => b.id === banner.rerunOf);
  const rerun = banner.rerun && banners?.[kind].find((b) => b.id === banner.rerun.id);
  const days = Math.round((Date.parse(banner.end) - Date.parse(banner.start)) / DAY);
  const stats = kind === 'cards' ? [...new Set(banner.featured.map((i) => STAT_OF_TYPE[i.type]).filter(Boolean))] : [];
  // A predicted or announced banner's new cards aren't in Global's card data yet; JP's tier list has them.
  const fromJp = banner.predicted || banner.announced;
  const rankings = useRankings(fromJp ? 'jp' : server, scenario, stats);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: tapping outside the sheet closes it; Escape (handled in BannersPage) and the close button cover keyboards.
    <div className="sheet-backdrop" onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops taps inside the sheet from reaching the backdrop. */}
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('banners.details')}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="sheet-close" onClick={onClose} aria-label={t('common.close')}>
          <ChevronDown size={24} aria-hidden="true" />
        </button>
        <img className="sheet-banner" src={artOf(banner)} alt="" />
        {banner.name && <p className="sheet-banner-name">{banner.name}</p>}
        <p className="sheet-dates">
          <StatusBadge banner={banner} />
          {banner.paid && <span className="badge paid">{t('banners.paidBadge')}</span>}
          {dateRange(banner, format.time)}
          {banner.end && ` · ${t('banners.days', { count: days })}`}
        </p>
        {banner.confirmed && (
          <p className="sheet-prediction">
            {t('banners.confirmedFrom', {
              dates: dateRange({ start: banner.jp_start, end: banner.jp_end }, format.long),
            })}
          </p>
        )}
        {banner.predicted && !banner.confirmed && (
          <p className="sheet-prediction">
            {t('banners.predictedFrom', {
              dates: dateRange({ start: banner.jp_start, end: banner.jp_end }, format.long),
              count: banner.margin_days,
            })}
          </p>
        )}
        {banner.paid && <p className="sheet-prediction">{t('banners.paid')}</p>}
        {rerunOf && (
          <button type="button" className="event-parent" onClick={() => onSelect(rerunOf, kind)}>
            {t('banners.rerunOf', { dates: dateRange(rerunOf, format.long) })}
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        )}
        {banner.rerun && (
          <button type="button" className="event-parent" disabled={!rerun} onClick={() => onSelect(rerun, kind)}>
            {t('banners.reheld', { dates: dateRange(banner.rerun, format.long) })}
            {rerun && <ChevronRight size={15} aria-hidden="true" />}
          </button>
        )}
        {banner.announced && (
          <p className="sheet-prediction">
            <Trans
              i18nKey="banners.announced"
              components={{
                // biome-ignore lint/a11y/useAnchorContent: <Trans> fills the link with the catalog's <a> text.
                a: <a href={banner.news_url} target="_blank" rel="noreferrer" />,
                // biome-ignore lint/a11y/useAnchorContent: <Trans> fills the link with the catalog's <u> text.
                u: <a href={umapyoiUrl(banner.news_url)} target="_blank" rel="noreferrer" />,
              }}
            />
          </p>
        )}
        <h2 className="featured-heading">
          {t(kind === 'cards' ? 'banners.featuredCards' : 'banners.featuredTrainees')}
        </h2>
        <ul className="featured">
          {banner.featured.map((item) => (
            <li key={item.id ?? `${item.title}|${item.name}`}>
              {/* NEW sits on the icon, leaving the rank row room for "See more". */}
              <div className="item-icon">
                {item.icon && <img src={item.icon} alt="" loading="lazy" />}
                {item.new && <span className="badge new">{t('banners.new')}</span>}
              </div>
              <div className="item-info">
                <span className="item-name">
                  <strong>{item.name ?? `#${item.id}`}</strong>
                  {item.title && (
                    <span className="item-title" title={item.title}>
                      {item.title}
                    </span>
                  )}
                </span>
                <span className="item-meta">
                  {kind === 'cards' ? <CardRank item={item} rankings={rankings} /> : TRAINEE_RARITY[item.rarity]}
                  {kind === 'cards' && item.id != null && (
                    <a className="see-more" href={`#/card/${item.id}`}>
                      {t('banners.seeMore')}
                      <ChevronRight size={15} aria-hidden="true" />
                    </a>
                  )}
                </span>
              </div>
            </li>
          ))}
          {banner.featured.length === 0 && <li className="empty">{banner.note ?? t('banners.noItems')}</li>}
        </ul>
        {stats.length > 0 && (
          <p className="rank-note">
            {t(fromJp ? 'banners.predictedRankNote' : 'banners.rankNote', {
              scenario: scenarioName(scenario),
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// A group's label, which folds the group away (its rows hidden) or opens it again.
function GroupLabel({ label, collapsed, onToggle }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`lane-label${collapsed ? ' collapsed' : ''}`}
      aria-expanded={!collapsed}
      title={t(collapsed ? 'banners.showGroup' : 'banners.hideGroup', { name: label })}
      onClick={onToggle}
    >
      {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      {label}
    </button>
  );
}

// Rows of event bars; an event with parts has a fold button (+N), and its parts' rows open under its row, over a
// tinted band spanning it. Bars too short for a label are chips.
const CHIP_WIDTH = 64;
// A copy of a set with `key` added, or removed if it was in it.
function toggled(set, key) {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}
// An event's name, or its kind's when it has none (Legend Races, Transfer Requests).
const eventName = (t, event) => event.name ?? t(`events.kind.${event.kind}`);
// Where an event stands, as a banner would (`end`: ms, a day after the start when it has none): predicted from JP's
// (half-transparent bar), confirmed (nearly solid), else ended / live / upcoming.
const eventStatus = (event, end) =>
  status({
    start: event.start,
    end: new Date(end).toISOString(),
    predicted: event.predicted,
    confirmed: event.confirmed,
  });
function eventTitleKey(event) {
  if (event.confirmed) return 'events.confirmedBarTitle';
  return event.predicted ? 'events.predictedBarTitle' : 'events.barTitle';
}
function EventRows({ rows, at, format, unfolded, onToggle, onSelect, depth = 0 }) {
  const { t } = useTranslation();
  const name = (event) => eventName(t, event);
  return rows.map((row, i) => {
    const open = row.filter((item) => item.parts.length && unfolded.has(item.event.id));
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: lanes have no identity of their own; their order is stable.
      <Fragment key={i}>
        <div className={`lane${depth ? ' part-lane' : ''}`}>
          {row.map((item) => {
            const { event, start, end } = item;
            const left = at(start);
            const width = Math.max(at(end) - left, 6);
            const chip = width < CHIP_WIDTH;
            const parts = partCount(item);
            const isOpen = unfolded.has(event.id);
            const dates = event.end ? dateRange(event, format.short) : format.short(event.start);
            return (
              <Fragment key={event.id}>
                <button
                  type="button"
                  className={`bar event-bar kind-${event.kind} ${eventStatus(event, end)}${chip ? ' chip' : ''}${parts ? ' has-parts' : ''}`}
                  style={{ left, width, ...(event.image && !chip && { backgroundImage: `url(${event.image})` }) }}
                  title={t(eventTitleKey(event), {
                    name: name(event),
                    kind: t(`events.kind.${event.kind}`),
                    dates: event.end ? dateRange(event, format.long) : format.long(event.start),
                  })}
                  onClick={() => onSelect(event)}
                >
                  {!chip && (
                    <>
                      <strong>{name(event)}</strong>
                      <small>{dates}</small>
                    </>
                  )}
                </button>
                {parts > 0 && (
                  <button
                    type="button"
                    className={`bar-fold${isOpen ? ' open' : ''}`}
                    style={{ left: chip ? left + width + 2 : left + width - 40 }}
                    aria-expanded={isOpen}
                    aria-label={t(isOpen ? 'events.hideParts' : 'events.showParts', {
                      count: parts,
                      name: name(event),
                    })}
                    onClick={() => onToggle(event.id)}
                  >
                    {isOpen ? <ChevronDown size={14} aria-hidden="true" /> : `+${parts}`}
                  </button>
                )}
              </Fragment>
            );
          })}
        </div>
        {open.map((item) => (
          <div key={item.event.id} className={`event-part-rows kind-${item.event.kind}`}>
            <div
              className="event-part-band"
              style={{ left: at(item.start), width: Math.max(at(item.end) - at(item.start), 6) }}
            />
            <EventRows
              rows={item.parts}
              at={at}
              format={format}
              unfolded={unfolded}
              onToggle={onToggle}
              onSelect={onSelect}
              depth={depth + 1}
            />
          </div>
        ))}
      </Fragment>
    );
  });
}

// A predicted event's JP dates (one without an end: its start).
const jpDates = (event, format) =>
  event.jp_end ? dateRange({ start: event.jp_start, end: event.jp_end }, format) : format(event.jp_start);

// An in-game event in the banner sheet's style: the support cards it gives first, then its other rewards and titles;
// its parts (sub-events, mission sets), or the event it's part of.
function EventSheet({ event, events, format, onSelect, onClose }) {
  const { t } = useTranslation();
  const items = itemList(event.items);
  const parent = event.parent && events.find((e) => e.id === event.parent);
  const parts = subEvents(event, events);
  const count = (value) =>
    typeof value === 'number'
      ? formatNumber(value)
      : t('events.range', { min: formatNumber(value.min), max: formatNumber(value.max) });
  const days = event.end && Math.round((Date.parse(event.end) - Date.parse(event.start)) / DAY);
  const nothing = !event.cards.length && !items.length && !event.titles.length;
  const name = (e) => eventName(t, e);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: tapping outside the sheet closes it; Escape (handled in BannersPage) and the close button cover keyboards.
    <div className="sheet-backdrop" onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops taps inside the sheet from reaching the backdrop. */}
      <div
        className="sheet event-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('events.details')}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="sheet-close" onClick={onClose} aria-label={t('common.close')}>
          <ChevronDown size={24} aria-hidden="true" />
        </button>
        <span className={`event-kind kind-${event.kind}`}>{t(`events.kind.${event.kind}`)}</span>
        <h2 className="event-name">{name(event)}</h2>
        <p className="sheet-dates">
          {event.predicted && <StatusBadge banner={event} />}
          {event.end
            ? `${dateRange(event, format.time)} · ${t('banners.days', { count: days })}`
            : format.time(event.start)}
        </p>
        {event.predicted && (
          <p className="sheet-prediction">
            {event.confirmed
              ? t('events.confirmedFrom', { dates: jpDates(event, format.long) })
              : t('events.predictedFrom', { dates: jpDates(event, format.long), count: event.margin_days })}{' '}
            {t('events.predictedNames')}
          </p>
        )}
        {parent && (
          <button type="button" className="event-parent" onClick={() => onSelect(parent)}>
            {t('events.partOf', { name: name(parent) })}
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        )}
        {event.cards.length > 0 && (
          <>
            <h3 className="featured-heading">{t('events.cards')}</h3>
            <ul className="featured">
              {event.cards.map((card) => (
                <li key={`${card.title}|${card.name}`}>
                  <div className="item-icon">
                    {cards[card.id] && <img src={cardIcon(card.id, cards)} alt="" loading="lazy" />}
                  </div>
                  <div className="item-info">
                    <span className="item-name">
                      {/* A predicted event's cards are JP's; Global's English name where the card data has one. */}
                      <strong>{(event.predicted && cards[card.id]?.name.en) || card.name}</strong>
                      <span className="item-title" title={card.title}>
                        [{card.title}]
                      </span>
                    </span>
                    <span className="item-meta">
                      {card.rarity && t(`rarity.${card.rarity}`)}
                      {card.copies && <span>{t('events.copies', { count: card.copies })}</span>}
                      {card.id && (
                        <a className="see-more" href={`#/card/${card.id}`}>
                          {t('banners.seeMore')}
                          <ChevronRight size={15} aria-hidden="true" />
                        </a>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {items.length > 0 && (
          <>
            <h3 className="featured-heading">{t('events.items')}</h3>
            <ul className="event-rewards">
              {items.map((item) => (
                <li key={item.name}>
                  {/* JP's items go by Global's names where Global has them (to sort alike); shown as JP calls them. */}
                  {item.count == null
                    ? (item.local ?? item.name)
                    : t('events.itemCount', { name: item.local ?? item.name, count: count(item.count) })}
                </li>
              ))}
            </ul>
          </>
        )}
        {event.phases?.length > 0 && (
          <>
            <h3 className="featured-heading">{t('events.schedule')}</h3>
            <ul className="event-parts event-schedule">
              {event.phases.map((phase) => (
                <li key={phase.key}>
                  <span>{t(`events.phase.${phase.key}`)}</span>
                  <small>{dateRange(phase, format.time)}</small>
                </li>
              ))}
            </ul>
          </>
        )}
        {event.titles.length > 0 && <p className="event-titles">{t('events.titles', { titles: event.titles })}</p>}
        {nothing && <p className="event-none">{t('events.noRewards')}</p>}
        {parts.length > 0 && (
          <>
            <h3 className="featured-heading">{t('events.includes')}</h3>
            <ul className="event-parts">
              {parts.map((part) => (
                <li key={part.id}>
                  <button type="button" className="event-part" onClick={() => onSelect(part)}>
                    <span className={`event-dot kind-${part.kind}`} aria-hidden="true" />
                    {name(part)}
                    {part.cards.length > 0 && <small className="event-has-card">{t('events.cards')}</small>}
                  </button>
                  <small>{part.end ? dateRange(part, format.short) : format.short(part.start)}</small>
                </li>
              ))}
            </ul>
          </>
        )}
        {event.news_url && (
          <p className="event-links">
            <a className="event-news" href={event.news_url} target="_blank" rel="noreferrer">
              {t(event.predicted ? 'events.jpNews' : 'events.news')}
              <ExternalLink size={15} aria-hidden="true" />
            </a>
            {umapyoiUrl(event.news_url) && (
              <a className="event-news" href={umapyoiUrl(event.news_url)} target="_blank" rel="noreferrer">
                {t('events.umapyoi')}
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
