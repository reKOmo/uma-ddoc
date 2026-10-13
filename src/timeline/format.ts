import i18n, { formatDate, formatDateTime } from '../i18n/index.ts';
import { timeZoneOptions } from '../settings.tsx';
import type { Entry } from './entries.ts';
import { DAY } from './layout.ts';

export type DateFormats = {
  long: (iso: string) => string;
  short: (iso: string) => string;
  time: (iso: string) => string;
  month: (date: Date, withYear?: boolean) => string;
  isJanuary: (date: Date) => boolean;
};
type DateSpan = { start: string; end: string | null; openEnded?: boolean };

// Settings' timezone: UTC (as the game announces times, the default) or the viewer's own.
export function dateFormats(timeZone: 'utc' | 'local'): DateFormats {
  const zone = timeZoneOptions(timeZone);
  return {
    long: (iso) => formatDate(iso, { ...zone, year: 'numeric', month: 'short', day: 'numeric' }),
    short: (iso) => formatDate(iso, { ...zone, month: 'short', day: 'numeric' }),
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

// Without an end: "from start" when openEnded (a scout with no end date, a scenario still running), else one day.
export function dateRange({ start, end, openEnded = !end }: DateSpan, format: (iso: string) => string): string {
  if (end) return i18n.t('common.dateRange', { start: format(start), end: format(end) });
  return openEnded ? i18n.t('timeline.since', { date: format(start) }) : format(start);
}

export const daysOf = (entry: Pick<Entry, 'start' | 'end'>): number | null =>
  entry.end ? Math.round((Date.parse(entry.end) - Date.parse(entry.start)) / DAY) : null;

export const kindName = (entry: Pick<Entry, 'group' | 'kind'>): string =>
  i18n.t(entry.group === 'event' ? `events.kind.${entry.kind}` : `timeline.kind.${entry.kind}`);

// A bar's label: a banner by its main featured item (and how many more), else its name; an event's name, else its
// kind's (Legend Races, Transfer Requests).
export function barLabel(entry: Pick<Entry, 'main' | 'name' | 'kind' | 'group'>): string {
  if (entry.main)
    return entry.main.others > 0
      ? i18n.t('timeline.barLabel', { name: entry.main.name, count: entry.main.others })
      : entry.main.name;
  return entry.name ?? kindName(entry);
}

export const entryTitle = (entry: Pick<Entry, 'name' | 'main' | 'kind' | 'group'>): string =>
  entry.name ?? barLabel(entry);
