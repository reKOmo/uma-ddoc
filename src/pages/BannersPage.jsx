import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Globe, LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import { rankByUsefulness } from '../../tierlist/index.js';
import { SERVERS } from '../servers.js';
import { STAT_OF_TYPE, TIER_NAMES, cardRanks } from '../tiers.js';
import { DAY, buildTimeline } from '../timeline.js';
import { globalProgress } from '../globalProgress.js';
import { useDragScroll } from '../useDragScroll.js';
import { Trans, useTranslation } from 'react-i18next';
import { timeZoneOptions, useSettings } from '../settings.jsx';
import i18n, { formatDate, formatDateTime, scenarioName, statName } from '../i18n/index.js';
import './banners.css';

// Banner data is only downloaded when this page opens.
const BANNERS = {
  global: () => import('../../data/global_banners.json'), // ours: seeded from GameTora, kept up from the news
  jp: () => import('../../generated/jp_banners.json'),
};
// Global's future banners, predicted from JP's by `pnpm predict-gl` (ml/). Optional: the glob is
// empty when the file hasn't been generated, and the page goes without. (Banners announced in the
// news are real ones in data/, with `announced` + `news_url`.)
const PREDICTED = {
  global: Object.values(import.meta.glob('../../generated/predicted_global_banners.json', { import: 'default' })),
};

async function loadBanners(name) {
  const [real, ...predicted] = await Promise.all([
    BANNERS[name]().then((m) => m.default),
    ...(PREDICTED[name] ?? []).map((load) => load()),
  ]);
  return predicted.reduce(
    (all, more) => ({ characters: [...all.characters, ...more.characters], cards: [...all.cards, ...more.cards] }),
    real
  );
}
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
const dateRange = (banner, format) =>
  i18n.t('common.dateRange', { start: format(banner.start), end: format(banner.end) });

// Label every day when there's room, else every 2nd day, else weekly. Weekly
// labels stop at the 22nd so they never collide with the next month's 1st.
const dayLabelStep = (px) => (px >= 16 ? 1 : px >= 8 ? 2 : 7);
const showDayLabel = (date, step) => (date - 1) % step === 0 && (step < 7 || date <= 22);

function status(banner, now = Date.now()) {
  if (banner.confirmed) return 'confirmed';
  if (banner.predicted) return 'predicted';
  if (now < Date.parse(banner.start)) return 'upcoming';
  if (now > Date.parse(banner.end)) return 'ended';
  return 'live';
}

function barTitleKey(banner) {
  if (banner.confirmed) return 'banners.confirmedBarTitle';
  return banner.predicted ? 'banners.predictedBarTitle' : 'banners.barTitle';
}

function barLabel(banner) {
  if (!banner.main) return '—';
  const others = banner.featured.length - 1;
  return others > 0 ? i18n.t('banners.barLabel', { name: banner.main.name, count: others }) : banner.main.name;
}

export default function BannersPage({ server, scenario }) {
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
    Promise.all([BANNERS.global().then((m) => m.default), predicted ? predicted() : null]).then(([global, future]) =>
      setGlobalBanners({ global, predicted: future })
    );
  }, [server, globalBanners]);

  const timeline = useMemo(
    () =>
      data &&
      buildTimeline(
        [
          { key: 'characters', label: t('banners.characters'), banners: data.characters },
          { key: 'cards', label: t('banners.supportCards'), banners: data.cards },
        ],
        { utc: timeZone === 'utc' }
      ),
    [data, t, timeZone]
  );
  const px = ZOOMS[zoom];
  // The scroller only exists once the timeline has loaded.
  useDragScroll(scroller, !!timeline);

  useLayoutEffect(() => {
    if (timeline && centerOn.current === null) centerOn.current = timeline.today;
  }, [timeline]);

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
                <div className="lane-label">{section.label}</div>
                {section.rows.map((row, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: lanes have no identity of their own; their order is stable.
                  <div key={i} className="lane">
                    {row.map(({ banner, from, length }) => (
                      <button
                        type="button"
                        key={banner.id}
                        className={`bar ${section.key} ${status(banner)} type-${banner.main?.type ?? 'none'}${banner.announced ? ' official-art' : ''}`}
                        style={{
                          left: from * px,
                          width: Math.max(length * px, 6),
                          backgroundImage: `url(${banner.image})`,
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
          </div>
        </div>
      )}

      {selected && (
        <BannerSheet
          {...selected}
          server={server}
          scenario={scenario}
          format={format}
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

function BannerSheet({ banner, kind, server, scenario, format, onClose }) {
  const { t } = useTranslation();
  const days = Math.round((Date.parse(banner.end) - Date.parse(banner.start)) / DAY);
  const state = status(banner);
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
        <img className="sheet-banner" src={banner.image} alt="" />
        <p className="sheet-dates">
          <span className={`badge ${state}`}>{t(`banners.status.${state}`)}</span>
          {dateRange(banner, format.time)} · {t('banners.days', { count: days })}
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
        {banner.announced && (
          <p className="sheet-prediction">
            <Trans
              i18nKey="banners.announced"
              // biome-ignore lint/a11y/useAnchorContent: <Trans> fills the link with the catalog's <a> text.
              components={{ a: <a href={banner.news_url} target="_blank" rel="noreferrer" /> }}
            />
          </p>
        )}
        <h2 className="featured-heading">
          {t(kind === 'cards' ? 'banners.featuredCards' : 'banners.featuredTrainees')}
        </h2>
        <ul className="featured">
          {banner.featured.map((item) => (
            <li key={item.id}>
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
                  {kind === 'cards' && (
                    <a className="see-more" href={`#/card/${item.id}`}>
                      {t('banners.seeMore')}
                      <ChevronRight size={15} aria-hidden="true" />
                    </a>
                  )}
                </span>
              </div>
            </li>
          ))}
          {banner.featured.length === 0 && <li className="empty">{t('banners.noItems')}</li>}
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
