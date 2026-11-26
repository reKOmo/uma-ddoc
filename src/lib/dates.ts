import { useMemo } from 'react';
import i18n, { formatDate, formatDateRange } from '../i18n/index.ts';
import { useSettings } from '../state/settings.ts';

export const DAY = 24 * 60 * 60 * 1000;

// A "YYYY-MM-DD" day's start (UTC, so it's the same day everywhere), and back.
export const dayStart = (day: string): number => Date.parse(`${day}T00:00:00Z`);
export const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// Intl options for the chosen timezone: UTC, or none (the viewer's own).
const timeZoneOptions = (timeZone: string) => (timeZone === 'utc' ? { timeZone: 'UTC' } : {});
// Intl options for the chosen clock.
const clockOptions = (clock: string): Intl.DateTimeFormatOptions => ({
  hourCycle: clock === '24h' ? 'h23' : 'h12',
});
// The viewer's timezone, e.g. "Europe/Warsaw".
export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// One date, or (`range`) two with what they share written once.
export type DateFormat = ((iso: string) => string) & { range: (start: string, end: string) => string };
export type DateFormats = {
  long: DateFormat;
  short: DateFormat;
  time: DateFormat;
  // The sheet's dates: "Thu, Nov 5, 10:00 PM – Sun, Nov 15, 9:59 PM UTC", the year only when it isn't this one, the
  // zone once at the end.
  sheet: (span: DateSpan) => string;
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
    sheet: (span) => {
      const thisYear = new Date().getUTCFullYear();
      const otherYear = [span.start, span.end].some((date) => date && new Date(date).getUTCFullYear() !== thisYear);
      const text = dateRange(
        span,
        dateFormat({
          ...zone,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          ...clockOptions(clock),
          ...(otherYear && { year: 'numeric' }),
        })
      );
      return timeZone === 'utc' ? i18n.t('timeline.inUtc', { dates: text }) : text;
    },
    month: (date) => formatDate(date, { ...zone, month: 'short', year: 'numeric' }),
    isJanuary: (date) => (timeZone === 'utc' ? date.getUTCMonth() : date.getMonth()) === 0,
  };
}

// The formats for Settings' timezone and clock, kept while they stay the same.
export function useDateFormats(): DateFormats {
  const { timeZone, clock } = useSettings().settings;
  return useMemo(() => dateFormats(timeZone, clock), [timeZone, clock]);
}

// Without an end: "from start" when openEnded (a scout with no end date, a scenario still running), else one day.
export function dateRange({ start, end, openEnded = !end }: DateSpan, format: DateFormat): string {
  if (end) return format.range(start, end);
  return openEnded ? i18n.t('timeline.since', { date: format(start) }) : format(start);
}

// Whole days from now until a date-time (ISO, or ms; negative once past).
export const daysUntil = (at: string | number): number => Math.ceil((new Date(at).getTime() - Date.now()) / DAY);
