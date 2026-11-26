import { ChevronRight, Gift } from 'lucide-react';
import clsx from 'clsx';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Advice, NoBannerAdvice, Release } from '../../../shared/schemas/pullGuide.ts';
import { formatDay } from '../../i18n/index.ts';
import { type DateFormat, dateRange, daysUntil, useDateFormats } from '../../lib/dates.ts';
import { sheetLink } from '../../lib/pullGuide.ts';
import { timelineUrl } from '../../routes.ts';
import type { Art, EntryStatus } from '../../timeline/entries.ts';
import { entryTitle, labelIsFan } from '../../timeline/format.ts';
import { FanTl } from '../../ui/FanTl.tsx';
import StatusBadge from '../../ui/StatusBadge.tsx';
import LinkButton from '../../ui/LinkButton.tsx';
import Pill from '../../ui/Pill.tsx';
import ShouldPullChip from '../../ui/ShouldPullChip.tsx';
import Status from '../../ui/Status.tsx';
import type { UpcomingAdvice } from './advice.ts';
import type { EntryOrigin, Origins } from './hooks.ts';
import { originLabel } from './OriginPills.tsx';
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
  const month = formatDay(`${release.month}-01`, { year: 'numeric', month: 'short' });
  return t(`pullGuide.${release.part ?? 'month'}`, { month });
}

type GuideAdvice = Advice | NoBannerAdvice;

// What the tile shows, with the advice under it (`shown`: the banner or event on the art).
type Shown =
  | { kind: 'loading' }
  | { kind: 'banner'; shown: Upcoming; advice: GuideAdvice | null }
  // With no banner coming, the event the card comes from (story event, gift…): one running or to come, else its latest.
  | { kind: 'event'; shown: Upcoming; source: EntryOrigin; advice: GuideAdvice | null }
  // A card on no banner and no event we know of: the guide's own date and label stand in for the banner's.
  | { kind: 'guideRelease'; release: Release; advice: NoBannerAdvice }
  // With none to come, the card's last banner, and the guide's advice on it.
  | { kind: 'last'; shown: Upcoming; advice: GuideAdvice | null }
  | { kind: 'none'; advice: GuideAdvice | null };

export function pickShown(
  cardId: number,
  origins: Origins | null | undefined,
  advice: UpcomingAdvice | null | undefined,
  format: DateFormat
): Shown {
  if (origins == null || advice === undefined) return { kind: 'loading' };
  const advised = withAdvice(advice?.entry);
  const upcoming = advice ? guideUpcoming(advice, origins, format) : originUpcoming(origins, format);
  if (upcoming) return { kind: 'banner', shown: upcoming, advice: advised };
  const events = origins.filter((o) => o.kind !== 'banner' && o.kind !== 'paid_banner');
  const source = events.find((o) => o.entry.status !== 'ended') ?? events.at(-1);
  if (source) return { kind: 'event', shown: fromOrigin(source, format), source, advice: advised };
  if (advised && hasRelease(advised)) return { kind: 'guideRelease', release: advised.release, advice: advised };
  const last = originLast(origins, format);
  if (last)
    return { kind: 'last', shown: last, advice: advised ?? withAdvice(advice?.guide?.banners[last.id]?.[cardId]) };
  return { kind: 'none', advice: advised };
}

type NextBannerProps = {
  cardId: number;
  origins: Origins | null | undefined;
  advice: UpcomingAdvice | null | undefined;
};

// The card's next banner on its art, then the guide's advice on pulling it (Global only: the guide advises on
// Global's banners).
export default function NextBanner({ cardId, origins, advice }: NextBannerProps) {
  const { t } = useTranslation();
  const picked = pickShown(cardId, origins, advice, useDateFormats().long);
  const shown = 'shown' in picked ? picked.shown : null;
  const shownAdvice = 'advice' in picked ? picked.advice : null;
  const art = shown?.art?.src ? shown.art : null;
  // A running banner isn't "upcoming": it reads as one still to come.
  const live = shown?.status === 'live';
  // A card from an event (or the guide's own date, on no banner) isn't pulled for: it's got.
  const question = t(
    picked.kind === 'event' || picked.kind === 'guideRelease'
      ? 'pullGuide.shouldGet'
      : picked.kind === 'banner' && !live
        ? 'pullGuide.shouldPullNext'
        : 'pullGuide.shouldPull'
  );
  const days = picked.kind === 'banner' || picked.kind === 'event' ? daysUntil(picked.shown.start) : 0;
  const upcoming = picked.kind === 'banner' ? picked.shown : null;
  const guideFree = !upcoming?.freePulls && shownAdvice?.freePulls;

  return (
    <section className={styles.tile}>
      <div
        className={clsx(styles.banner, art && styles.hasArt, art?.official && styles.officialArt)}
        data-status={shown?.status}
        style={art ? { backgroundImage: `url(${art.src})` } : undefined}
      >
        <h2 className={styles.heading}>
          {picked.kind === 'event'
            ? originLabel(picked.source, t)
            : t(
                picked.kind === 'last'
                  ? 'pullGuide.lastBanner'
                  : live
                    ? 'pullGuide.availableNow'
                    : 'pullGuide.upcomingBanner'
              )}
          {picked.kind === 'last' && (
            <span className={clsx(styles.none, styles.shadow)}>{t('pullGuide.noUpcoming')}</span>
          )}
        </h2>
        {picked.kind === 'loading' ? (
          <Status className={styles.status}>{t('common.loading')}</Status>
        ) : shown ? (
          <>
            {picked.kind === 'event' && (
              <p className={clsx(styles.eventName, styles.shadow)}>
                <FanTl fan={labelIsFan(picked.source.entry, { title: true })}>{entryTitle(picked.source.entry)}</FanTl>
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
                {t(picked.kind === 'event' ? 'pullGuide.seeEvent' : 'pullGuide.seeBanner')}
                <ChevronRight size={16} aria-hidden="true" />
              </LinkButton>
            </div>
          </>
        ) : picked.kind === 'guideRelease' ? (
          <p className={styles.when}>
            <span>{releaseDate(picked.release, t)}</span>
            {picked.release.label && <Pill variant="label">{picked.release.label}</Pill>}
          </p>
        ) : (
          <Status className={styles.status}>{t('pullGuide.noUpcoming')}</Status>
        )}
      </div>

      {/* The same layout without advice (Japan, a card the guide doesn't cover), so the tile doesn't change shape. */}
      {picked.kind !== 'loading' && (
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
