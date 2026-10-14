import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ArtBanner } from '../../gametora.ts';
import type { Release } from '../../../shared/schemas/pullGuide.ts';
import { formatDate } from '../../i18n/index.ts';
import { useSettings } from '../../settings.tsx';
import { currentAdvice, latestAdvice, loadPullGuide, sheetLink, upcomingBanner } from '../../pullGuide.ts';
import { timelineUrl } from '../../routes.ts';
import { loadBanners } from '../../timeline/data.ts';
import { bannerStatus } from '../../timeline/entries.ts';
import { dateFormats, dateRange } from '../../timeline/format.ts';
import StatusBadge from '../../timeline/StatusBadge.tsx';
import { useAsync } from '../../useAsync.ts';
import LinkButton from '../../ui/LinkButton.tsx';
import Pill from '../../ui/Pill.tsx';
import ShouldPullChip from '../../ui/ShouldPullChip.tsx';
import Status from '../../ui/Status.tsx';
import { formatDay } from '../RankChart.tsx';
import styles from './PullAdvice.module.css';

function BannerDates({ banner, timeZone }: { banner: ArtBanner; timeZone: 'utc' | 'local' }) {
  return (
    <>
      <StatusBadge status={bannerStatus(banner)} />
      <span className={styles.dates}>{dateRange(banner, dateFormats(timeZone).long)}</span>
    </>
  );
}

// A release's date as the guide gives it: a day, or early / late in a month for estimates.
function releaseDate(release: Release, t: TFunction): string {
  if ('date' in release) return formatDay(release.date);
  if (!('month' in release)) return release.dateText ?? '';
  const month = formatDate(`${release.month}-01T00:00:00Z`, { year: 'numeric', month: 'short', timeZone: 'UTC' });
  return t(`pullGuide.${release.part ?? 'month'}`, { month });
}

// Nothing while the guide loads or for cards it doesn't cover.
export default function PullAdvice({ cardId }: { cardId: number }) {
  const { t } = useTranslation();
  const { timeZone } = useSettings().settings;
  const guide = useAsync(loadPullGuide, []).data;
  const banners = useAsync(() => loadBanners('global').then((b) => b.cards), []).data;
  const latest = guide && latestAdvice(guide, cardId);
  if (!guide || !latest || !banners) return null;
  const now = Date.now();
  const upcoming = upcomingBanner(banners, cardId, now);
  const banner = upcoming && banners.find((b) => b.id === upcoming.id);
  const entry = currentAdvice(guide, cardId, upcoming, new Date(now).toISOString().slice(0, 10));
  const release = !upcoming && entry && 'release' in entry ? entry.release : undefined;
  const label = banner
    ? !banner.featured.find((item) => item.id === cardId)?.new && t('pullGuide.rerun')
    : release?.label;

  return (
    <section className={styles.guide}>
      <div className={styles.entry}>
        <div
          className={clsx(styles.banner, banner && styles.hasArt, banner?.officialArt && styles.officialArt)}
          style={banner ? { backgroundImage: `url(${banner.image})` } : undefined}
        >
          <h2 className={styles.heading}>{t('pullGuide.upcomingBanner')}</h2>
          {banner || release ? (
            <>
              <p className={styles.when}>
                {banner ? <BannerDates banner={banner} timeZone={timeZone} /> : release && releaseDate(release, t)}
              </p>
              {(label || banner) && (
                <div className={styles.head}>
                  {label && <Pill variant="label">{label}</Pill>}
                  {banner && (
                    <LinkButton className={styles.bannerLink} href={timelineUrl('gl', banner.id)}>
                      {t('pullGuide.seeBanner')}
                      <ChevronRight size={16} aria-hidden="true" />
                    </LinkButton>
                  )}
                </div>
              )}
            </>
          ) : (
            <Status className={styles.status}>{t('pullGuide.noUpcoming')}</Status>
          )}
        </div>

        {entry && (entry.shouldPull || entry.comment || entry.advice) && (
          <div className={styles.should}>
            <h2 className={styles.heading}>
              {t('pullGuide.shouldPull')}
              {entry.shouldPull && <ShouldPullChip pill={entry.shouldPull} />}
            </h2>
            {entry.comment && <p className={styles.advice}>{entry.comment}</p>}
            {entry.freePulls && <p className={styles.free}>{t('pullGuide.freePulls', { count: entry.freePulls })}</p>}
            {entry.advice && <p className={styles.note}>{entry.advice}</p>}
          </div>
        )}
        <div className={styles.actions}>
          <LinkButton href={sheetLink(entry ?? latest) ?? ''} external>
            {t('pullGuide.seeMore')}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
