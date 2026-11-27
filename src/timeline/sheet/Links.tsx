import { ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LinkButton from '../../ui/LinkButton.tsx';
import { FanTl } from '../../ui/FanTl.tsx';
import { serverName } from '../../i18n/index.ts';
import { umapyoiUrl } from '../../lib/umapyoi.ts';
import { useSettings } from '../../state/settings.ts';
import type { Entry } from '../entries.ts';
import { timelineUrl } from '../../routes.ts';
import shared from './shared.module.css';
import styles from './Links.module.css';

// One mark for the line: the titles are a list in one sentence.
export function Titles({ titles, fan }: { titles: string[]; fan: Set<string> }) {
  const { t } = useTranslation();
  return (
    titles.length > 0 && (
      <p className={shared.titles}>
        <FanTl fan={titles.some((title) => fan.has(title))}>{t('timeline.titles', { titles })}</FanTl>
      </p>
    )
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

export function Links({ news, counterpart }: { news: Entry['news']; counterpart: Entry['counterpart'] }) {
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
