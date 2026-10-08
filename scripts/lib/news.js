// Turns announcements from the official Global site's news API
// (https://umamusume.com/news/) into structured records. Pure: no network, no files
// (scripts/fetch-news.js does those).
//
// A record is
//   { id, url, label, kind, title, posted, updated, from, to, image,
//     periods: [{ heading, text, start, end }], banners: [{ id, start, end }],
//     trainees: [{ stars, title, name }], cards: [{ rarity, title, name }],
//     scenarios: [{ full, start }], message }
// `banners` are the scouts a post announces, by gacha id (see gachaBanners); `scenarios` the new
// Career scenarios it names (see scenarioMentions).
// `kind` is banner / event / update / other (a heuristic on title + headings).
// Dates are ISO strings in UTC, or null. `message` is the post's HTML as served.

export const SITE = 'https://umamusume.com';

const LABELS = { 1: 'news', 3: 'update' };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

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

// [{ heading, lines, html }] for each <h2> section; text before the first heading has heading ''.
export function sections(html) {
  const [intro, ...parts] = html.split(/<h2[^>]*>/i);
  return [
    { heading: '', lines: toLines(intro), html: intro },
    ...parts.map((part) => {
      const [heading, body = ''] = part.split(/<\/h2>/i);
      return { heading: toLines(heading).join(' '), lines: toLines(body), html: body };
    }),
  ];
}

// Scout posts show each banner's art, gacha_banner_<id>_….png, where <id> is the game's gacha
// id, the same on Global and JP (Global reruns JP's banners under JP's ids).
// Each banner gets the scout period above it (else the post's first one).
// Returns [{ id, start, end, image }] (image: the official art's URL).
function gachaBanners(all, periods) {
  const scout = (s) => /scout.*period$/i.test(s.heading);
  const periodOf = new Map(periods.map((p) => [p.heading, p]));
  let current = periods.find(scout) ?? null;
  const banners = new Map();
  for (const section of all) {
    if (scout(section) && periodOf.get(section.heading)?.start) current = periodOf.get(section.heading);
    for (const [, image, id] of section.html.matchAll(/<img[^>]*\ssrc="([^"]*gacha_banner_(\d+)_[^"]*)"/g)) {
      if (!banners.has(Number(id)))
        banners.set(Number(id), {
          id: Number(id),
          start: current?.start ?? null,
          end: current?.end ?? null,
          image: decodeEntities(image),
        });
    }
  }
  return [...banners.values()];
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

// "• SSR [From the Ground Up] Light Hello" and "★★★ [Heroic Author] Zenno Rob Roy",
// each listed once (spotlight lists repeat the debut ones).
function featured(lines) {
  const cards = new Map();
  const trainees = new Map();
  for (const line of lines) {
    const card = line.match(/^(?:[•・]\s*)?(SSR|SR|R)\s+\[([^\]]+)\]\s+(.+)$/);
    if (card) cards.set(`${card[2]}|${card[3]}`, { rarity: card[1], title: card[2], name: card[3] });
    const trainee = line.match(/^(★{1,3})\s+\[([^\]]+)\]\s+(.+)$/);
    if (trainee)
      trainees.set(`${trainee[2]}|${trainee[3]}`, { stars: trainee[1].length, title: trainee[2], name: trainee[3] });
  }
  return { cards: [...cards.values()], trainees: [...trainees.values()] };
}

// New Career scenarios a post names: 'the new Career scenario "X" has been added', 'A new career
// scenario, titled "X," will be added … at 10:00 p.m., Jul 22, 2026 (UTC)', 'the new "X" Career
// Scenario'. Only these phrasings: plain "scenario" shows up all over (known issues, scout fine print).
// start: the time in the same sentence when it says the scenario is added / begins, else null.
const SCENARIO_RE = [
  /new career scenario,?\s*(?:titled\s*)?["“]([^"”]+?)[\s,]*["”]/i,
  /new\s*["“]([^"”]+?)[\s,]*["”]\s*career scenario/i,
];

function scenarioMentions(lines, year) {
  const found = new Map();
  for (const line of lines) {
    const match = SCENARIO_RE.map((re) => line.match(re)).find(Boolean);
    if (!match) continue;
    const full = match[1].trim();
    const dated = /\b(added|begins?|launch(es|ed)?)\b/i.test(line) && /\d{1,2}:\d{2}\s*[ap]\.?m/i.test(line);
    const start = dated ? parsePeriod(line, year).start : null;
    const key = full.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mention = found.get(key) ?? { full, start: null };
    if (start && !mention.start) mention.start = start;
    found.set(key, mention);
  }
  return [...found.values()];
}

const ISSUE_RE = /\b(issue|issues|maintenance|bug|error|compensation)\b/i;
const EVENT_RE = /\bevent\b|champions meeting|legend race|league selection|celebration|campaign/i;

export function classify({ title, label, periods }) {
  const headings = periods.map((p) => p.heading).join('\n');
  if (!ISSUE_RE.test(title)) {
    if (
      /scout availability period/i.test(headings) ||
      /\bscouts?\b.*\b(out now|coming soon|begun|available)/i.test(title)
    )
      return 'banner';
    if (/^event (availability )?period/im.test(headings) || EVENT_RE.test(title)) return 'event';
  }
  return LABELS[label] === 'update' ? 'update' : 'other';
}

// `item` is an entry of pr_info_index's information_list; `detail` (optional) is
// pr_info_detail's `detail` for it, which adds the post's display window and big image.
export function toRecord(item, detail) {
  const html = detail?.message ?? item.message ?? '';
  const posted = apiDate(item.post_at);
  const year = posted ? new Date(posted).getUTCFullYear() : new Date().getUTCFullYear();
  const all = sections(html);
  const periods = all
    .filter((s) => s.heading && /period$/i.test(s.heading) && s.lines.length)
    .map((s) => ({ heading: s.heading, text: s.lines[0], ...parsePeriod(s.lines[0], year) }));
  const record = {
    id: item.announce_id,
    url: `${SITE}/news/${item.announce_id}/`,
    label: LABELS[item.announce_label] ?? String(item.announce_label),
    kind: null,
    title: decodeEntities(item.title).trim(),
    posted,
    updated: apiDate(item.update_at),
    from: apiDate(detail?.from_date),
    to: apiDate(detail?.to_date),
    image: detail?.image_big || item.image || null,
    periods,
    banners: gachaBanners(all, periods),
    ...featured(toLines(html)),
    scenarios: scenarioMentions([decodeEntities(item.title), ...toLines(html)], year),
    message: html,
  };
  record.kind = classify({ title: record.title, label: item.announce_label, periods });
  return record;
}
