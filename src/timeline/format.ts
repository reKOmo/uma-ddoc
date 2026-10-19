import i18n, { formatDate, formatDateRange } from '../i18n/index.ts';
import { clockOptions, timeZoneOptions } from '../settings.tsx';
import type { Entry } from './entries.ts';
import { DAY } from './layout.ts';

// One date, or (`range`) two with what they share written once.
export type DateFormat = ((iso: string) => string) & { range: (start: string, end: string) => string };
export type DateFormats = {
  long: DateFormat;
  short: DateFormat;
  time: DateFormat;
  // "Oct 2026": always with its year, so scrolling never loses it.
  month: (date: Date) => string;
  isJanuary: (date: Date) => boolean;
};
type DateSpan = { start: string; end: string | null; openEnded?: boolean };

const dateFormat = (options: Intl.DateTimeFormatOptions): DateFormat =>
  Object.assign((iso: string) => formatDate(iso, options), {
    range: (start: string, end: string) => formatDateRange(start, end, options),
  });

// Settings' timezone: UTC (as the game announces times, the default; named, "10:00 PM UTC") or the viewer's own (not
// named: it's theirs).
// (`clock`: Settings' 12- or 24-hour clock, for the times.)
export function dateFormats(timeZone: 'utc' | 'local', clock: '12h' | '24h' = '12h'): DateFormats {
  const zone = timeZoneOptions(timeZone);
  return {
    long: dateFormat({ ...zone, year: 'numeric', month: 'short', day: 'numeric' }),
    short: dateFormat({ ...zone, month: 'short', day: 'numeric' }),
    time: dateFormat({
      ...zone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...clockOptions(clock),
      ...(timeZone === 'utc' && { timeZoneName: 'short' }),
    }),
    month: (date) => formatDate(date, { ...zone, month: 'short', year: 'numeric' }),
    isJanuary: (date) => (timeZone === 'utc' ? date.getUTCMonth() : date.getMonth()) === 0,
  };
}

// Without an end: "from start" when openEnded (a scout with no end date, a scenario still running), else one day.
export function dateRange({ start, end, openEnded = !end }: DateSpan, format: DateFormat): string {
  if (end) return format.range(start, end);
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

// The bar's course: its first race with a distance ("Nakayama 2500m"), or null.
export function raceLabel(entry: Pick<Entry, 'races'>): string | null {
  const race = entry.races.find((r) => r.distance);
  return race ? `${i18n.t(`events.race.track.${race.track}`, { defaultValue: race.track })} ${race.distance}m` : null;
}

export const entryTitle = (entry: Pick<Entry, 'name' | 'main' | 'kind' | 'group'>): string =>
  entry.name ?? barLabel(entry);
