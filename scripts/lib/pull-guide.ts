// Pure parsing of Luh's Umamusume Support Card Encyclopedia, a public Google Sheet with pull advice
// for Global's support cards: one tab per Career scenario era, one row per card banner (reruns get
// their own row). See scripts/fetch-pull-guide.js.
//
// Read from the sheet's HTML view (`htmlview/sheet?gid=…`, ~170 KB a tab): its CSV export has no
// hyperlinks, and each row's card id is only in its GameTora link ("…/supports/30087-mejiro-bright";
// GameTora's ids are ours). The xlsx export has them too, but is ~110 MB of card art. Cell comments
// are in neither the HTML view nor the CSV, so they're left out.

import type { Banner } from '../../shared/schemas/banner.ts';
import type { Advice, PullGuide, Release } from '../../shared/schemas/pullGuide.ts';

export const SHEET_ID = '1zZOBxjcgJEKna7ftYKq0AlZS25Q3hE_occ7kXB-Q6MQ';
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
export const tabUrl = (gid: string): string => `${SHEET_URL}/htmlview/sheet?headers=false&gid=${gid}`;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string): string =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m: string, e: string) =>
    e[0] === '#' ? String.fromCodePoint(Number(e[1] === 'x' ? `0${e.slice(1)}` : e.slice(1))) : (ENTITIES[e] ?? m)
  );

// A cell's text, line breaks kept.
const cellText = (html: string): string =>
  decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''))
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

// Google wraps links as https://www.google.com/url?q=<target>&…
function linkTarget(href: string): string {
  const url = decode(href);
  const q = url.match(/[?&]q=([^&]*)/);
  return q ? decodeURIComponent(q[1]) : url;
}

// Every <tr> as its <td> cells ({ html, text }), with the sheet's row number (1-based) from the row
// header (<th id="<gid>R<index>">) as `row`.
type TableCell = { html: string; text: string };
type TableRow = TableCell[] & { row: number | null };
function tableRows(html: string): TableRow[] {
  return [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map(([, row]) => {
    const cells = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(([, cell]) => ({ html: cell, text: cellText(cell) }));
    const index = row.match(/<th id="\d+R(\d+)"/)?.[1];
    return Object.assign(cells, { row: index ? Number(index) + 1 : null });
  });
}

// The sheet's tabs, from its main HTML view: [{ name, gid }].
export function parseSheetList(html: string): { name: string; gid: string }[] {
  return [...html.matchAll(/\{name: "((?:[^"\\]|\\.)*)", pageUrl: "[^"]*", gid: "(\d+)"/g)].map(([, name, gid]) => ({
    name: name.replace(/\\x([0-9a-f]{2})/gi, (_: string, h: string) => String.fromCharCode(Number.parseInt(h, 16))),
    gid,
  }));
}

// "(Latest update: 06/10/26)" on the INDEX tab, day first → "2026-10-06".
export function parseUpdated(html: string): string | null {
  const m = cellText(html).match(/Latest update:\s*(\d{1,2})\/(\d{1,2})\/(\d{2})/);
  return m ? `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

// A banner date as the sheet writes it: "Mar 12th '26", "July 23rd, '26", "18 Sep '25" (exact) or
// "Late Jun '28" (an estimate for banners Global hasn't scheduled) → { date } or { month, part },
// else { dateText }.
const PARTS = ['early', 'mid', 'late'] as const;
type Part = (typeof PARTS)[number];

// A date as the sheet writes it, without its label: exact, or an estimate's month and part, or the sheet's text.
type DateOf = { date: string } | { month: string; part: Part | null } | { dateText: string | null };

export function parseDate(text: string): DateOf {
  const monthFirst = text.match(/^(early|mid|late)?\s*([a-z]+)\.?\s*(?:(\d{1,2})(?:st|nd|rd|th)?)?\s*,?\s*'(\d{2})$/i);
  const dayFirst = text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?\s*,?\s*'(\d{2})$/i);
  if (!monthFirst && !dayFirst) return { dateText: text || null };
  const [, part, name, day, year] = monthFirst ?? [text, null, dayFirst?.[2], dayFirst?.[1], dayFirst?.[3]];
  const month = MONTHS.indexOf((name ?? '').slice(0, 3).toLowerCase()) + 1;
  if (!month) return { dateText: text };
  const ym = `20${year}-${String(month).padStart(2, '0')}`;
  if (day) return { date: `${ym}-${day.padStart(2, '0')}` };
  return { month: ym, part: PARTS.find((p) => p === part?.toLowerCase()) ?? null };
}

// Advice up to this long that isn't a verdict goes into the notes ("With Kitasan", "Conditional",
// "If dedicated to Fronts"); longer, it's shown as the recommendation.
const SHORT_ADVICE = 24;

// The "Pull?" cell: an optional "60 free pulls" line (how many the banner gives), then the advice,
// wrapped to the column ("If dedicated\nto Ends"), evened out: "If whale" / "with Duramente" /
// "If Dolpin" / "to lates" read like the rest. Split for showing:
//   freePulls   the free pulls the banner gives, or null
//   shouldPull  the pill: yes | no | free | whale | dolphin, with the advice's pluses ("whale++"), when
//               the advice starts with one, else null; "1LB+" (pull to at least that limit break) is a
//               yes, its text placed as if there were no pill
//   comment     the whole advice when it says more than the pill ("If Whale or With Palmer"), or when
//               there's no pill and it's longer than SHORT_ADVICE; else null
//   note        short advice without a pill, to lead the notes; else null
export function parsePull(text: string): {
  freePulls: number | null;
  shouldPull: string | null;
  comment: string | null;
  note: string | null;
} {
  const lines = text.split('\n').filter(Boolean);
  const free = lines[0]?.match(/^(\d+)\s+free pulls?$/i);
  if (free) lines.shift();
  const pull = lines
    .join(' ')
    .replace(/^#/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bwhale\b/gi, 'Whale')
    .replace(/\bdolph?in\b/gi, 'Dolphin')
    .replace(
      /(^|\b(?:or|and) )(if|with)\b/g,
      (_: string, before: string, word: string) => before + word[0].toUpperCase() + word.slice(1)
    )
    .replace(
      /\bto (fronts|paces|lates|ends)\b/gi,
      (_: string, style: string) => `to ${style[0].toUpperCase()}${style.slice(1)}`
    );
  const match = pull.match(/^(?:(yes|no|free)\b|if (whale|dolphin)\b(\+*)|\d\s*LB\b\+?)/i);
  const lb = match && !match[1] && !match[2];
  const pill = match ? (match[1] ?? match[2] ?? 'yes').toLowerCase() + (match[3] ?? '') : null;
  const rest = match && !lb ? pull.slice(match[0].length).trim() : null;
  const short = (!pill || lb) && pull.length <= SHORT_ADVICE;
  return {
    freePulls: free ? Number(free[1]) : null,
    shouldPull: pill,
    comment: (pill && !lb ? rest : !short) ? pull : null,
    note: short && pull ? pull : null,
  };
}

// The notes as one paragraph: the author rarely ends a sentence with a full stop, so one is added
// where a sentence has no closing punctuation of its own. Null when there are none.
export const notesParagraph = (notes: string[]): string | null =>
  notes.map((note) => (/[.!?…:)]$/.test(note) ? note : `${note}.`)).join(' ') || null;

// Words a wrapped line can end on mid-sentence ("…good skills like" ⏎ "Uma Stan…").
const CONTINUES =
  /\b(a|an|the|and|or|nor|neither|either|both|but|of|in|on|at|to|for|from|into|with|by|as|than|like|during|through|about|between|before|after|until|including|is|are|be|has|have|get|give|negates|only|because|which|that|her|his|its|their|your|my|our|this|other|entire|great|very|more|most|some|any|such|not)$/i;

// Words that start a sentence, where the author ran two together on one line ("…early on Could see…").
const STARTS = /(?<=[a-z]) (?=(?:Could|Just|She|She's|Also|It's|Plus|Downside)\b)/g;

// Whether a line break falls inside a name: the last word before it and the first after it are
// consecutive words of one ("Tamamo ⏎ Cross", "Admire ⏎ Groove").
function splitsName(before: string, after: string, names: string[]): boolean {
  const pair = `${before.split(' ').at(-1)} ${after.split(' ')[0]}`;
  return names.some((name) => ` ${name} `.includes(` ${pair} `));
}

// The "Notes" cell is wrapped to the column by hand, so lines are joined back up. The author rarely
// uses full stops, so a line starts a new sentence after a blank line, or when it starts with a capital
// or "(" or a digit, and the line before doesn't run on into it: ending on a comma, colon, number or a
// word that runs on (or mid-sentence, before "(" or a digit), or splitting a name from `names` (the
// sheet's card names). Sentences the author ran together
// on one line are split again, and spaces before "!" / "?" dropped. Still a guess: "Rice ⏎ Golshi" splits.
export function parseNotes(text: string, names: string[] = []): string[] {
  const notes: string[] = [];
  let blank = true;
  for (const line of text.split('\n')) {
    if (!line) {
      blank = true;
      continue;
    }
    const last = notes.at(-1) ?? '';
    const runsOn =
      !blank &&
      (/^[a-z]/.test(line) ||
        // "a nice ⏎ 100% mood", "on a Medium ⏎ (and sometimes Long) card"
        (/^\d/.test(line) && /[a-z]$/.test(last)) ||
        (line.startsWith('(') && !/[.!?]$/.test(last)) ||
        /[,:;–—-]$|\d(?:st|nd|rd|th|\.\d+)?$/.test(last) ||
        CONTINUES.test(last) ||
        splitsName(last, line, names));
    if (runsOn) notes[notes.length - 1] = `${last} ${line}`;
    else notes.push(line);
    blank = false;
  }
  return notes
    .flatMap((note) => note.split(STARTS))
    .map((note) => note.replace(/\s+([!?])/g, '$1').replace(/\s+/g, ' '));
}

// One card's entry in a tab (parseTab()): the sheet's row, its banner's label and date, and the advice.
export type PullEntry = Omit<Advice, 'googleSheetsSrc'> & {
  id: string;
  name: string;
  row: number | null;
  banner: Release;
};
// A scenario tab as byBanner() takes it: its sheet's gid and entries.
export type Tab = { gid?: string | null; entries: PullEntry[] };
// An entry as byBanner() keeps it: its advice (with where it is in the sheet) and its banner's date.
type Listed = Advice & { banner: Release };

// One scenario tab → { entries: [{ id, name, row, banner: { label, …date }, freePulls, shouldPull,
// comment, advice }] }: `advice` is the notes as one paragraph, led by short advice without a pill (see
// parsePull).
// Tabs without a "Support Card" header (READ ME, Links…) give no entries. `names`: card names across the sheet, for joining notes
// (parse every tab once without them to collect them).
export function parseTab(html: string, names: string[] = []): { entries: PullEntry[] } {
  const rows = tableRows(html);
  const head = rows.findIndex((cells) => cells.some((c) => c.text === 'Support Card'));
  if (head < 0) return { entries: [] };
  const headers = rows[head].map((c) => c.text);
  const col = (name: string): number => headers.indexOf(name);
  const card = col('Support Card');
  const date = col('Date');
  const pull = col('Pull?');
  // One tab has no "Notes" header over its notes.
  const notes = col('Notes') >= 0 ? col('Notes') : pull + 1;
  if (date < 0 || pull < 0) throw new Error(`pull guide tab has an unexpected header: ${headers.join(' | ')}`);

  const entries = [];
  for (const cells of rows.slice(head + 1)) {
    const href = cells[card]?.html.match(/href="([^"]*)"/);
    const id = href && linkTarget(href[1]).match(/gametora\.com\/umamusume\/supports\/(\d+)/)?.[1];
    if (!id) continue;
    // "Mejiro Bright\n(Event)": the card's name, and what kind of banner if not a regular one.
    const [name] = cells[card].text.split('\n');
    const label = cells[card].text.match(/\(([^)]+)\)\s*$/)?.[1] ?? null;
    const { note, ...pullAdvice } = parsePull(cells[pull]?.text ?? '');
    const comments = parseNotes(cells[notes]?.text ?? '', names);
    entries.push({
      id,
      name,
      row: cells.row,
      banner: { label, ...parseDate(cells[date]?.text ?? '') },
      ...pullAdvice,
      advice: notesParagraph(note ? [note, ...comments] : comments),
    });
  }
  return { entries };
}

// Where in its month an estimate ("early Jun") points, as a day.
const PART_DAY: Record<Part, number> = { early: 5, mid: 15, late: 25 };

// The Global card banner (real or predicted) one of a card's entries (`entries`: all of them, in sheet
// order) is about. Its first release is the earliest banner featuring the card (the guide's estimates
// and our predictions can be months apart that far ahead); a rerun, the one starting closest to the
// guide's date — within 3 weeks of an exact date, 6 weeks of an estimate. Null if none (event, story
// and shop cards aren't on gacha banners).
export function findBanner(banners: Banner[], cardId: number, entries: Listed[], entry: Listed): Banner | null {
  const featuring = banners
    .filter((banner) => banner.featured.some((item) => item.id === cardId))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (entry === entries[0]) return featuring[0] ?? null;
  const { date, month, part }: { date?: string; month?: string; part?: Part | null; dateText?: string | null } =
    entry.banner;
  const target = date
    ? Date.parse(`${date}T00:00:00Z`)
    : month
      ? Date.parse(`${month}-${String((part && PART_DAY[part]) ?? 15).padStart(2, '0')}T00:00:00Z`)
      : null;
  if (target === null) return null;
  const within = (date ? 21 : 42) * 86400000;
  let best: { banner: Banner; distance: number } | null = null;
  for (const banner of featuring) {
    const distance = Math.abs(Date.parse(banner.start) - target);
    if (distance <= within && (!best || distance < best.distance)) best = { banner, distance };
  }
  return best?.banner ?? null;
}

// Parsed tabs + Global's banners (real and predicted) → the advice per banner and card:
//   { banners: { [banner id]: { [card id]: advice } }, noBanner: { [card id]: advice } }
// where advice is { googleSheetsSrc: { gid, row }, freePulls, shouldPull, comment, advice } (where it is
// in the sheet, for links to the row). Whether a banner is a card's rerun is on the banner (`featured`'s
// `new`). Entries on no banner (event, story and shop cards; or a banner we don't know) go in `noBanner`,
// with `release`: the sheet's label ("Event", "Story"…) and date; a card's latest wins.
export function byBanner(tabs: Tab[], banners: Banner[]): Pick<PullGuide, 'banners' | 'noBanner'> {
  const cards: Record<string, Listed[]> = {};
  for (const { gid, entries } of tabs) {
    for (const { id, name, row, ...entry } of entries) {
      cards[id] ??= [];
      cards[id].push({ googleSheetsSrc: { gid: gid ?? null, row }, ...entry });
    }
  }
  const result: Pick<PullGuide, 'banners' | 'noBanner'> = { banners: {}, noBanner: {} };
  for (const [id, entries] of Object.entries(cards)) {
    for (const entry of entries) {
      const { banner: release, ...advice } = entry;
      const banner = findBanner(banners, Number(id), entries, entry);
      if (banner) {
        result.banners[banner.id] ??= {};
        result.banners[banner.id][id] = advice;
      } else result.noBanner[id] = { ...advice, release };
    }
  }
  return result;
}
