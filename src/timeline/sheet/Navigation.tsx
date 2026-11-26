import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Pill from '../../ui/Pill.tsx';
import { FanTl } from '../../ui/FanTl.tsx';
import { dateRange } from '../../lib/dates.ts';
import { barLabel, entryTitle, labelIsFan } from '../format.ts';
import type { Entry } from '../entries.ts';
import type { NavigationProps } from './types.ts';
import shared from './shared.module.css';
import styles from './Navigation.module.css';

export function Relations({ entry, lookup, format, onSelect }: NavigationProps) {
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

// Free scout windows: a campaign's, each banner (a link to it); a banner's, each campaign giving them. Then the pulls,
// its dates under them. A predicted Global banner's are what JP gave (with no JP campaign on the calendar: the
// count alone).
export function FreeScouts({ entry, lookup, format, onSelect }: NavigationProps) {
  const { t } = useTranslation();
  const fromJp = entry.group !== 'event' && !!entry.prediction;
  if (!entry.scouts.length && entry.freePulls == null) return null;
  return (
    <>
      <h3 className={shared.heading}>{t(fromJp ? 'timeline.freeScoutsJp' : 'timeline.freeScouts')}</h3>
      <ul className={shared.list}>
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

export function Parts({ entry, lookup, format, onSelect }: NavigationProps) {
  const { t } = useTranslation();
  const parts = entry.parts.map((key) => lookup(key)).filter((part): part is Entry => part !== undefined);
  if (!parts.length) return null;
  return (
    <>
      <h3 className={shared.heading}>{t('timeline.includes')}</h3>
      <ul className={shared.list}>
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
