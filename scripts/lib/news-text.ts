export type Server = 'gl' | 'jp';

export const NEWS_SITES: Record<Server, { site: string; post: (id: number | string) => string }> = {
  gl: { site: 'https://umamusume.com', post: (id) => `https://umamusume.com/news/${id}/` },
  jp: { site: 'https://umamusume.jp', post: (id) => `https://umamusume.jp/news/detail/?id=${id}` },
};
export const SITE: string = NEWS_SITES.gl.site;
export const newsUrl = (id: number | string, server: Server = 'gl'): string => NEWS_SITES[server].post(id);

export const DAY: number = 24 * 3600 * 1000;

// Lower-case letters and digits only (of any script: kana and kanji too), accents dropped, full-width folded: names
// compared however they're written.
export const norm = (s: string | null | undefined): string =>
  (s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]/gu, '');

export const MONTHS: string[] = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// The API's "2026-10-07 22:00:00" is UTC on Global (posts say "10:00 p.m., Oct 7, 2026 (UTC)") and JST on JP; both
// come out as UTC, "2026-10-07T22:00:00Z".
export function apiDate(s: string | null | undefined, server: Server = 'gl'): string | null {
  if (!s) return null;
  const iso = s.replace(' ', 'T');
  return server === 'jp' ? `${new Date(`${iso}+09:00`).toISOString().slice(0, 19)}Z` : `${iso}Z`;
}

export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m)
    .replace(/\u00a0/g, ' ');
}

export function toLines(html: string): string[] {
  return decodeEntities(html.replace(/<br\s*\/?>|<\/h2>|<\/p>|<\/li>/gi, '\n').replace(/<[^>]+>/g, ''))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export type Section = { heading: string; lines: string[]; html: string };

// [{ heading, lines, html }] for each section under a heading of the given levels (default <h2> only; '234' for
// <h2>–<h4>, as older posts use <h3> for their headings too); text before the first heading has heading ''.
export function sections(html: string, levels = '2'): Section[] {
  const out: Section[] = [];
  let heading = '';
  let last = 0;
  const push = (end: number) => {
    const body = html.slice(last, end);
    out.push({ heading, lines: toLines(body), html: body });
  };
  for (const m of html.matchAll(new RegExp(`<h([${levels}])[^>]*>([\\s\\S]*?)<\\/h\\1>`, 'gi'))) {
    push(m.index);
    heading = toLines(m[2]).join(' ');
    last = m.index + m[0].length;
  }
  push(html.length);
  return out;
}

// Dates in a period like "10:00 p.m., Oct 7–9:59 p.m., Oct 15, 2026 (UTC)",
// "Apr 7, 2026 - 11:59 p.m., Apr 13, 2026 (UTC)" or "From 10:00 p.m., Sep 15, 2026 (UTC)".
// A missing year comes from the next date that has one (else `fallbackYear`); a start
// that would land after its end is in the previous year. Returns { start, end }, where
// end is null for open-ended periods.
const DATE_RE =
  /(?:(\d{1,2}):(\d{2})\s*([ap])\.?m\.?,?\s*)?\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b(?:,\s*(\d{4}))?(?:,\s*(\d{1,2}):(\d{2})\s*([ap])\.?m\.?)?/gi;

type ParsedDate = { month: number; day: number; year: number | null; time: [number, number] | null };
type ResolvedDate = Omit<ParsedDate, 'year'> & { year: number };

export function parsePeriod(text: string, fallbackYear: number): { start: string | null; end: string | null } {
  const dates: ParsedDate[] = [...text.matchAll(DATE_RE)].slice(0, 2).map((m): ParsedDate => {
    const [h, min, ap] = m[1] ? [m[1], m[2], m[3]] : [m[7], m[8], m[9]];
    return {
      month: MONTHS.indexOf(m[4].toLowerCase()),
      day: Number(m[5]),
      year: m[6] ? Number(m[6]) : null,
      time: h ? [(Number(h) % 12) + (ap.toLowerCase() === 'p' ? 12 : 0), Number(min)] : null,
    };
  });
  if (!dates.length) return { start: null, end: null };
  for (let i = dates.length - 1; i >= 0; i--) dates[i].year ??= dates[i + 1]?.year ?? fallbackYear;
  // TODO(ts): the loop above has set every date's year; TS can't see that through the array's element type.
  const [start, end] = dates as [ResolvedDate, ResolvedDate?];
  const startAfterEnd = end && (start.month > end.month || (start.month === end.month && start.day > end.day));
  if (startAfterEnd && start.year === end.year) start.year -= 1;
  // A start without a time is the start of that day, an end without one its last minute.
  const iso = (d: ResolvedDate, [h, min]: [number, number]): string =>
    new Date(Date.UTC(d.year, d.month, d.day, h, min)).toISOString();
  return {
    start: iso(start, start.time ?? [0, 0]),
    end: end ? iso(end, end.time ?? [23, 59]) : null,
  };
}

// Dates in a JP period (times JST): "9/30 12:00 ～ 10/13 11:59", "2024/5/24 12:00 ～ 2025/3/31 11:59",
// "2026年2月24日（火）12:00から", "7/22 12:00 ～" (open-ended), "3/11 12:00 ～ 終了日時未定". Posts rarely give a year
// ("12/26 12:00 ～ 1/8 11:59"), so a date without one takes the year that puts it nearest `posted` (the post's time,
// ISO), and an end before its start is a year later. Returns { start, end } in ISO UTC like parsePeriod(); a start
// without a time is the start of that day, an end without one its last minute; end null when open-ended.
const JA_DATE =
  /(?:(\d{4})\s*[/年]\s*)?(\d{1,2})\s*[/月]\s*(\d{1,2})日?(?:\s*[（(][^）)]{1,4}[）)])?(?:\s*(\d{1,2}):(\d{2}))?/g;
const JST = 9 * 3600 * 1000;
type JaDate = { year: number | null; month: number; day: number; time: [number, number] | null };
type ResolvedJaDate = Omit<JaDate, 'year'> & { year: number };

export function parsePeriodJa(text: string, posted: string): { start: string | null; end: string | null } {
  const ref = Date.parse(posted);
  const refYear = new Date(ref + JST).getUTCFullYear();
  const at = (y: number, d: JaDate, [h, min]: [number, number]): number => Date.UTC(y, d.month, d.day, h, min) - JST;
  const dates: JaDate[] = [...text.matchAll(JA_DATE)]
    .slice(0, 2)
    .map(
      (m): JaDate => ({
        year: m[1] ? Number(m[1]) : null,
        month: Number(m[2]) - 1,
        day: Number(m[3]),
        time: m[4] ? [Number(m[4]), Number(m[5])] : null,
      })
    )
    .filter((d) => d.month >= 0 && d.month < 12 && d.day >= 1 && d.day <= 31);
  if (!dates.length) return { start: null, end: null };
  const nearest = (d: JaDate, time: [number, number]): number =>
    [refYear - 1, refYear, refYear + 1].reduce((best, y) =>
      Math.abs(at(y, d, time) - ref) < Math.abs(at(best, d, time) - ref) ? y : best
    );
  // TODO(ts): as in parsePeriod: each year is set below, which TS can't follow through the array's element type.
  const [start, end] = dates as [ResolvedJaDate, ResolvedJaDate?];
  const startTime: [number, number] = start.time ?? [0, 0];
  start.year ??= nearest(start, startTime);
  if (end) {
    const endTime = end.time ?? [23, 59];
    end.year ??= start.year;
    if (at(end.year, end, endTime) < at(start.year, start, startTime)) end.year += 1;
    end.time = endTime;
  }
  const iso = (d: ResolvedJaDate, time: [number, number]): string => new Date(at(d.year, d, time)).toISOString();
  // end.time was set to endTime above (its own or the last minute): the same value here, out of that block.
  return { start: iso(start, startTime), end: end ? iso(end, end.time ?? [23, 59]) : null };
}
