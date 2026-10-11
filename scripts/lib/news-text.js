// Plain text and dates out of the official news' HTML (data/news/), shared by every news parser. Pure.

// The official news site, and a post's page on it.
export const SITE = 'https://umamusume.com';
export const newsUrl = (id) => `${SITE}/news/${id}/`;

export const DAY = 24 * 3600 * 1000;

// Lower-case letters and digits only, accents dropped: names compared however they're written.
export const norm = (s) =>
  (s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// The API's "2026-10-07 22:00:00" is UTC (posts say "10:00 p.m., Oct 7, 2026 (UTC)").
export const apiDate = (s) => (s ? `${s.replace(' ', 'T')}Z` : null);

export function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m)
    .replace(/\u00a0/g, ' ');
}

// HTML → lines of plain text.
export function toLines(html) {
  return decodeEntities(html.replace(/<br\s*\/?>|<\/h2>|<\/p>|<\/li>/gi, '\n').replace(/<[^>]+>/g, ''))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// [{ heading, lines, html }] for each section under a heading of the given levels (default <h2> only; '234' for
// <h2>–<h4>, as older posts use <h3> for their headings too); text before the first heading has heading ''.
export function sections(html, levels = '2') {
  const out = [];
  let heading = '';
  let last = 0;
  const push = (end) => {
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

export function parsePeriod(text, fallbackYear) {
  const dates = [...text.matchAll(DATE_RE)].slice(0, 2).map((m) => {
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
  const [start, end] = dates;
  const startAfterEnd = end && (start.month > end.month || (start.month === end.month && start.day > end.day));
  if (startAfterEnd && start.year === end.year) start.year -= 1;
  // A start without a time is the start of that day, an end without one its last minute.
  const iso = (d, [h, min]) => new Date(Date.UTC(d.year, d.month, d.day, h, min)).toISOString();
  return {
    start: iso(start, start.time ?? [0, 0]),
    end: end ? iso(end, end.time ?? [23, 59]) : null,
  };
}
