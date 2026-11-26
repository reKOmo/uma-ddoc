import { ChevronRight, Gift } from 'lucide-react';
import clsx from 'clsx';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Advice, NoBannerAdvice, Release } from '../../../shared/schemas/pullGuide.ts';
import type { Server } from '../../../tierlist/cards.ts';
import { formatDate, formatDay } from '../../i18n/index.ts';
import { useSettings } from '../../state/settings.tsx';
import { sheetLink } from '../../lib/pullGuide.ts';
import { timelineUrl } from '../../routes.ts';
import type { Art, EntryStatus } from '../../timeline/entries.ts';
import { type DateFormat, dateFormats, dateRange, daysUntil, entryTitle, labelIsFan } from '../../timeline/format.ts';
import { FanTl } from '../../ui/FanTl.tsx';
import StatusBadge from '../../ui/StatusBadge.tsx';
import LinkButton from '../../ui/LinkButton.tsx';
import Pill from '../../ui/Pill.tsx';
import ShouldPullChip from '../../ui/ShouldPullChip.tsx';
import Status from '../../ui/Status.tsx';
import { type UpcomingAdvice, useUpcomingAdvice } from './advice.ts';
import type { EntryOrigin, Origins } from './hooks.ts';
import { originLabel } from './Origins.tsx';
import styles from './NextBanner.module.css';

type Upcoming = {
  id: string;
  href: string;
  art: Art | null;
  status: EntryStatus;
  start: string;
  dates: string;
  rerun: boolean;
  // A Global banner's free pulls from the news; a predicted one's are its JP banner's.
  freePulls: { count: number; jp: boolean } | null;
};

const fromOrigin = ({ entry, server, rerun }: EntryOrigin, format: DateFormat): Upcoming => ({
  id: String(entry.id),
  href: timelineUrl(server, entry.id),
  art: entry.art,
  status: entry.status,
  start: entry.start,
  dates: dateRange(entry, format),
  rerun,
  // Global's only: the news gives them, or (predicted) JP's banner did.
  freePulls: server === 'gl' && entry.freePulls ? { count: entry.freePulls, jp: entry.prediction !== null } : null,
});

const isBanner = (origin: EntryOrigin) => origin.entry.group === 'cards';

// Global: the guide's banner (the one its advice is for) among the card's origins.
function guideUpcoming({ banner }: UpcomingAdvice, origins: Origins, format: DateFormat): Upcoming | null {
  const origin = banner && origins.find((o) => isBanner(o) && String(o.entry.id) === String(banner.id));
  return origin ? fromOrigin(origin, format) : null;
}

// JP has no guide: its next banner among the card's own origins.
function originUpcoming(origins: Origins, format: DateFormat): Upcoming | null {
  const next = origins.find((o) => isBanner(o) && o.entry.status !== 'ended');
  return next ? fromOrigin(next, format) : null;
}

// With none to come, the card's last banner fills the tile instead of an empty one.
function originLast(origins: Origins, format: DateFormat): Upcoming | null {
  const last = origins.findLast((o) => isBanner(o) && o.entry.status === 'ended');
  return last ? fromOrigin(last, format) : null;
}

// The guide's entry when it says anything (a verdict, a comment, advice).
const withAdvice = <T extends Advice | NoBannerAdvice>(a: T | null | undefined): T | null =>
  a && (a.shouldPull || a.comment || a.advice) ? a : null;

const hasRelease = (advice: Advice | NoBannerAdvice): advice is NoBannerAdvice => 'release' in advice;

// A release's date as the guide gives it: a day, or early / late in a month for estimates.
function releaseDate(release: Release, t: TFunction): string {
  if ('date' in release) return formatDay(release.date);
  if (!('month' in release)) return release.dateText ?? '';
  const month = formatDate(`${release.month}-01T00:00:00Z`, { year: 'numeric', month: 'short', timeZone: 'UTC' });
  return t(`pullGuide.${release.part ?? 'month'}`, { month });
}

type NextBannerProps = { cardId: number; server: Server; origins: Origins | null | undefined };

// The card's next banner on its art, then the guide's advice on pulling it (Global only: the guide advises on
// Global's banners).
export default function NextBanner({ cardId, server, origins }: NextBannerProps) {
  const { t } = useTranslation();
  const { timeZone } = useSettings().settings;
  const format = dateFormats(timeZone).long;
  const advice = useUpcomingAdvice(cardId, server);
  const upcoming: Upcoming | null | undefined =
    origins == null || advice === undefined
      ? undefined
      : advice
        ? guideUpcoming(advice, origins, format)
        : originUpcoming(origins, format);
  const advised = withAdvice(advice?.entry);
  // With no banner coming, the event the card comes from (story event, gift…): one running or to come, else its latest.
  const events = origins?.filter((o) => o.kind !== 'banner' && o.kind !== 'paid_banner') ?? [];
  const source = upcoming === null ? (events.find((o) => o.entry.status !== 'ended') ?? events.at(-1) ?? null) : null;
  // A card on no banner and no event we know of: the guide's own date and label stand in for the banner's.
  const release = !upcoming && !source && advised && hasRelease(advised) ? advised.release : undefined;
  const last = upcoming === null && !source && !release && origins ? originLast(origins, format) : null;
  const sourceShown = source && fromOrigin(source, format);
  const shown = upcoming ?? sourceShown ?? last;
  // On the last banner, the guide's advice was for it.
  const lastEntry = last ? (advice?.guide?.banners[last.id]?.[cardId] ?? null) : null;
  const shownAdvice = advised ?? withAdvice(lastEntry);
  const art = shown?.art?.src ? shown.art : null;
  // A running banner isn't "upcoming": it reads as one still to come.
  const live = shown?.status === 'live';
  // A card from an event (or the guide's own date, on no banner) isn't pulled for: it's got.
  const fromEvent = !upcoming && !last && (!!source || !!release);
  const question = t(
    fromEvent ? 'pullGuide.shouldGet' : upcoming && !live ? 'pullGuide.shouldPullNext' : 'pullGuide.shouldPull'
  );
  const ahead = upcoming ?? sourceShown;
  const days = ahead ? daysUntil(ahead.start) : 0;
  const guideFree = !upcoming?.freePulls && advised?.freePulls;

  return (
    <section className={styles.tile}>
      <div
        className={clsx(styles.banner, art && styles.hasArt, art?.official && styles.officialArt)}
        data-status={shown?.status}
        style={art ? { backgroundImage: `url(${art.src})` } : undefined}
      >
        <h2 className={styles.heading}>
          {source
            ? originLabel(source, t)
            : t(last ? 'pullGuide.lastBanner' : live ? 'pullGuide.availableNow' : 'pullGuide.upcomingBanner')}
          {last && <span className={clsx(styles.none, styles.shadow)}>{t('pullGuide.noUpcoming')}</span>}
        </h2>
        {upcoming === undefined ? (
          <Status className={styles.status}>{t('common.loading')}</Status>
        ) : shown ? (
          <>
            {source && (
              <p className={clsx(styles.eventName, styles.shadow)}>
                <FanTl fan={labelIsFan(source.entry, { title: true })}>{entryTitle(source.entry)}</FanTl>
              </p>
            )}
            <p className={styles.when}>
              <StatusBadge status={shown.status} />
              <span className={styles.shadow}>{shown.dates}</span>
              {shown.rerun && <Pill variant="label">{t('pullGuide.rerun')}</Pill>}
              {days > 0 && <span className={styles.soon}>{t('common.inDays', { count: days })}</span>}
            </p>
            <div className={styles.foot}>
              {upcoming && (upcoming.freePulls || guideFree) && (
                <p className={clsx(styles.pulls, styles.shadow)}>
                  <Gift size={15} aria-hidden="true" />
                  <span>
                    {upcoming.freePulls ? (
                      <Trans
                        i18nKey={upcoming.freePulls.jp ? 'pullGuide.freePullsJp' : 'pullGuide.freePullsNews'}
                        count={upcoming.freePulls.count}
                        components={{ strong: <strong /> }}
                      />
                    ) : (
                      t('pullGuide.freePulls', { count: guideFree || 0 })
                    )}
                  </span>
                </p>
              )}
              <LinkButton className={styles.bannerLink} href={shown.href}>
                {t(source ? 'pullGuide.seeEvent' : 'pullGuide.seeBanner')}
                <ChevronRight size={16} aria-hidden="true" />
              </LinkButton>
            </div>
          </>
        ) : release ? (
          <p className={styles.when}>
            <span>{releaseDate(release, t)}</span>
            {release.label && <Pill variant="label">{release.label}</Pill>}
          </p>
        ) : (
          <Status className={styles.status}>{t('pullGuide.noUpcoming')}</Status>
        )}
      </div>

      {/* The same layout without advice (Japan, a card the guide doesn't cover), so the tile doesn't change shape. */}
      {upcoming !== undefined && (
        <div className={styles.advice}>
          <h3 className={styles.question}>
            {question}
            {shownAdvice?.shouldPull && <ShouldPullChip pill={shownAdvice.shouldPull} />}
          </h3>
          {shownAdvice ? (
            <>
              {shownAdvice.comment && <p className={styles.comment}>{shownAdvice.comment}</p>}
              {shownAdvice.advice && <p className={styles.note}>{shownAdvice.advice}</p>}
              {/* Last, under the advice it's the source of: it fits beside nothing else. */}
              <LinkButton className={styles.sheet} href={sheetLink(shownAdvice) ?? ''} external>
                {t('pullGuide.seeMore')}
              </LinkButton>
            </>
          ) : (
            <p className={styles.noAdvice}>{t('pullGuide.noAdvice')}</p>
          )}
        </div>
      )}
    </section>
  );
}
