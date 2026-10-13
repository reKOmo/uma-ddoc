// How the Timeline words dates and entries: shared by its bars, its sheet and the card page's banner box.

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
// A span of dates (an entry, a scenario).
type DateSpan = { start: string; end: string | null; openEnded?: boolean };

// Times in the timezone picked in Settings: UTC (as the game announces them, the default) or the viewer's own.
export function dateFormats(timeZone: 'utc' | 'local'): DateFormats {
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

// A span's dates: "start – end"; without an end, "from start" when it runs on (`openEnded`: a scout "until further
// notice", a scenario still running), else its one day.
export function dateRange({ start, end, openEnded = !end }: DateSpan, format: (iso: string) => string): string {
  if (end) return i18n.t('common.dateRange', { start: format(start), end: format(end) });
  return openEnded ? i18n.t('timeline.since', { date: format(start) }) : format(start);
}

// How many days an entry runs (null without an end).
export const daysOf = (entry: Pick<Entry, 'start' | 'end'>): number | null =>
  entry.end ? Math.round((Date.parse(entry.end) - Date.parse(entry.start)) / DAY) : null;

// An entry's kind, as its pill says it.
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

// The sheet's heading: its own name (a scout's from its post), else its bar's label.
export const entryTitle = (entry: Pick<Entry, 'name' | 'main' | 'kind' | 'group'>): string =>
  entry.name ?? barLabel(entry);
