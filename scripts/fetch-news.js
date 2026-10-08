// Fetches new announcements (banners, events, updates…) from the official Global
// site's news API (https://umamusume.com/news/) into data/news/announcements.json and
// writes what changed to data/news/summary.md.
//
// Incremental and gentle, so it looks like someone reading the news page: it pages
// through the index 10 posts at a time (like the site's "show more") and stops at the
// first page holding a post it already has; only new or edited posts get their detail
// fetched. Requests go one at a time with a random 3–8 s pause between them.
//
// data/news/ is committed (the workflow in .github/workflows/news.yml commits it), so
// each run only asks for what's newer than the last one.
//
// Usage:
//   pnpm fetch-news              new posts since the last run (first run: the newest page)
//   pnpm fetch-news --backfill   the whole archive (index pages only, no detail requests)
//   pnpm fetch-news --reparse    re-parse the stored posts after a parser change (no requests)

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { NEWS_DIR } from './lib/paths.js';
import { SITE, apiDate, toRecord } from './lib/news.js';

const DATA_FILE = `${NEWS_DIR}announcements.json`;
const SUMMARY_FILE = `${NEWS_DIR}summary.md`;

const PAGE_SIZE = 10; // what the news page itself asks for
const MAX_PAGES = 5; // per incremental run; more than that and something's off
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  Origin: SITE,
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pause = () => sleep(3000 + Math.random() * 5000);

let requests = 0;
async function api(endpoint, body, referer) {
  if (requests++) await pause();
  const res = await fetch(`${SITE}/api/ajax/${endpoint}?format=json`, {
    method: 'POST',
    headers: { ...HEADERS, Referer: referer },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${endpoint}: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.response_code !== 1) throw new Error(`${endpoint}: response_code ${json.response_code}`);
  return json;
}

async function indexPage(offset) {
  const json = await api('pr_info_index', { announce_label: 0, limit: PAGE_SIZE, offset }, `${SITE}/news/?t=all`);
  if (!Array.isArray(json.information_list)) throw new Error('pr_info_index: no information_list (format changed?)');
  return { items: json.information_list, more: Boolean(json.show_more_button) };
}

async function detail(id) {
  const json = await api('pr_info_detail', { announce_id: id }, `${SITE}/news/${id}/`);
  if (json.detail?.announce_id !== id) throw new Error(`pr_info_detail ${id}: unexpected response (format changed?)`);
  return json.detail;
}

function load() {
  if (!existsSync(DATA_FILE)) return [];
  return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
}

// One record per line, newest first, so commits diff per announcement.
function save(records) {
  mkdirSync(NEWS_DIR, { recursive: true });
  writeFileSync(DATA_FILE, `[\n${records.map((r) => JSON.stringify(r)).join(',\n')}\n]\n`);
}

const day = (iso) => (iso ? iso.slice(0, 10) : '?');
const when = (iso) => (iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : 'open-ended');

function describe(record) {
  const lines = [`- [${record.title}](${record.url}) — posted ${day(record.posted)}`];
  const main = record.periods[0];
  if (main?.start) lines.push(`  - ${main.heading}: ${when(main.start)} → ${when(main.end)}`);
  else if (main) lines.push(`  - ${main.heading}: ${main.text}`);
  if (record.trainees.length)
    lines.push(
      `  - Trainees: ${record.trainees.map((t) => `${'★'.repeat(t.stars)} [${t.title}] ${t.name}`).join(', ')}`
    );
  if (record.cards.length)
    lines.push(`  - Support cards: ${record.cards.map((c) => `${c.rarity} [${c.title}] ${c.name}`).join(', ')}`);
  return lines.join('\n');
}

const SECTIONS = [
  ['banner', 'Banners'],
  ['event', 'Events'],
  ['update', 'Game updates'],
  ['other', 'Other news'],
];

export function summarize(added, updated, date = new Date()) {
  const out = [`# Umamusume news — ${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`, ''];
  if (!added.length && !updated.length) return `${out.join('\n')}No new announcements.\n`;
  out.push(`${added.length} new, ${updated.length} updated.`, '');
  for (const [list, verb] of [
    [added, 'New'],
    [updated, 'Updated'],
  ]) {
    for (const [kind, name] of SECTIONS) {
      const records = list.filter((r) => r.kind === kind);
      if (records.length) out.push(`## ${verb}: ${name}`, '', ...records.map(describe), '');
    }
  }
  return out.join('\n');
}

export async function fetchNews({ backfill = false } = {}) {
  const records = load();
  const known = new Map(records.map((r) => [r.id, r]));
  const fresh = []; // index items that are new or edited
  const maxPages = backfill ? Number.POSITIVE_INFINITY : known.size ? MAX_PAGES : 1;

  for (let page = 0; page < maxPages; page++) {
    const { items, more } = await indexPage(page * PAGE_SIZE);
    let seenKnown = false;
    for (const item of items) {
      const old = known.get(item.announce_id);
      if (old) seenKnown = true;
      if (!old || old.updated !== apiDate(item.update_at)) fresh.push(item);
    }
    if (!more || (seenKnown && !backfill)) break;
    if (known.size && page === maxPages - 1)
      console.warn(`Stopped after ${maxPages} pages without reaching a known post.`);
  }

  const added = [];
  const updated = [];
  for (const item of fresh) {
    const record = toRecord(item, backfill ? null : await detail(item.announce_id));
    (known.has(record.id) ? updated : added).push(record);
    known.set(record.id, record);
  }

  const all = [...known.values()].sort((a, b) => (b.posted ?? '').localeCompare(a.posted ?? '') || b.id - a.id);
  if (fresh.length) save(all);
  const summary = summarize(added, updated);
  mkdirSync(NEWS_DIR, { recursive: true });
  writeFileSync(SUMMARY_FILE, summary);
  return { added, updated, total: all.length, requests, summary };
}

// Rebuilds the stored records with the current parser (scripts/lib/news.js), from what's
// stored: no requests. Run it after changing the parser.
export function reparse() {
  const back = (iso) => iso?.slice(0, 19).replace('T', ' ');
  const labels = { news: 1, update: 3 };
  const records = load().map((r) =>
    toRecord(
      {
        announce_id: r.id,
        title: r.title,
        post_at: back(r.posted),
        update_at: back(r.updated),
        announce_label: labels[r.label] ?? Number(r.label),
        image: r.image,
        message: r.message,
      },
      r.from || r.to ? { message: r.message, from_date: back(r.from), to_date: back(r.to), image_big: r.image } : null
    )
  );
  save(records);
  return records.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes('--reparse')) {
  console.log(`Reparsed ${reparse()} stored announcements (no requests).`);
} else if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const backfill = process.argv.includes('--backfill');
  const { added, updated, total, requests: count, summary } = await fetchNews({ backfill });
  console.log(summary);
  console.log(`${added.length} new, ${updated.length} updated, ${total} stored (${count} requests).`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (process.env.GITHUB_OUTPUT) {
    const changed = [...added, ...updated];
    const banners = changed.some((r) => r.banners.length);
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed.length > 0}\nbanners=${banners}\n`);
  }
}
