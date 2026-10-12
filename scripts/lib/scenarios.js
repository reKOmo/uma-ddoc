// Career scenarios and when they launched on each server, in data/scenarios.json (committed):
//   { source, scenarios: [scenario…] } in JP launch order, where a scenario is
//   { key, short: { jp, en }, full_en, full_jp, en_start_date, jp_start_date, links: { gametora, cover }, color }
// where a start date is { date, tag } (or null while unknown):
//   date       ISO launch time (UTC)
//   tag        'out' (launched), 'confirmed' (a known date still ahead), 'predicted' (ml/scenarios.py, from
//              the Global release model; also lo / hi: "YYYY-MM-DD", a rough 90% range)
// Tags of known dates are refreshed (confirmed → out) every time the file is written.
// key        the tier list's scenario key where it has one (tierlist/scenarios.js), else ours (an id)
// short      short names per server (SCENARIO_NAMES, by hand): en null until Global has one
// full_en    the full English name: Global's official one once the news names it, else GameTora's
//            English, else null (JP-only scenarios GameTora hasn't translated)
// full_jp    the full Japanese name (GameTora; refreshed every scrape)
// *_date     launch dates as above; en_start_date is predicted until the news gives Global's
// links      gametora: the scenario's GameTora page; cover: its key art (GameTora's media, no text, so it
//            serves both servers); umapyoi_jp / umapyoi_gl: the post id of its launch post in JP's / Global's news
//            (the scenario page links umapyoi.net's copy: JP's in Japanese), from `update-jp` / `update-global`
// color      the main colour of the cover ("#rrggbb", scripts/lib/colors.js), computed once per cover
//            (fillColors) and kept, so images aren't downloaded again
// JP's side (jp_start_date, links, new scenarios) comes from GameTora on every `pnpm scrape-gametora`;
// Global's (en_start_date, official names) from the official news (`pnpm update-global`; GameTora's Global dates
// seeded them once), predictions from `pnpm predict-gl`. Global releases JP's scenarios in JP's order.

import { readFileSync, writeFileSync } from 'node:fs';
import { imageColor } from './colors.js';
import { ja } from './news-lang/ja.js';
import { norm as normAny } from './news-text.js'; // keeps kana and kanji, unlike norm() below
import { DATA_DIR } from './paths.js';
import { categorize } from './post-categories.js';

export const SCENARIOS_FILE = `${DATA_DIR}scenarios.json`;
const GAMETORA = 'https://gametora.com/umamusume/';
const GAMETORA_MEDIA = 'https://media.gametora.com/umamusume/scenarios/hero/';

// GameTora slug → [key, JP short name, Global short name]. key: the tier list's where it ranks the
// scenario, ours otherwise (an id: URLs, the tier list; never shown as is). Short names (the "Scenario
// names" setting): JP's from upstream's en-jp locale + the community / GameTora's "for short"; Global's from
// upstream's en-gl locale, null until Global has one (the JP one shows instead). A slug missing here gets
// its slug as key and name; add it.
export const SCENARIO_NAMES = {
  'ura-finals': ['URA', 'URA', 'URA'],
  'unity-cup': ['Aoharu', 'Aoharu', 'Unity'],
  trackblazer: ['MANT', 'MANT', 'TB'],
  'our-grand-concert': ['GL', 'GL', 'GC'],
  'grand-masters': ['GM', 'GM', null],
  'project-larc': ['LArc', "L'Arc", null],
  uaf: ['UAF', 'UAF', null],
  'great-food-festival': ['GFF', 'GFF', null],
  'run-mecha-umamusume': ['Mecha', 'Mecha', null],
  'the-twinkle-legends': ['TL', 'TL', null],
  'design-your-island': ['DYI', 'DYI', null],
  'yukoma-hot-springs': ['Onsen', 'YHS', null],
  'beyond-dreams': ['BD', 'BD', null],
  'tracen-ken': ['TracenKen', 'Tracen-ken', null],
};

// { jp, en } short names of a GameTora slug (see SCENARIO_NAMES).
export function shortNames(slug) {
  const [, jp, en] = SCENARIO_NAMES[slug] ?? [slug, slug, null];
  return { jp, en };
}

const iso = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null);
export const norm = (s) =>
  (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const slugOf = (scenario) => scenario.links.gametora.slice(GAMETORA.length);

// A known launch date, tagged by whether it has passed.
export const known = (date, now = Date.now()) =>
  date ? { date, tag: Date.parse(date) <= now ? 'out' : 'confirmed' } : null;
// Global's launch isn't known yet: none, or only a prediction.
const unknownOnGlobal = (s) => !s.en_start_date || s.en_start_date.tag === 'predicted';

// Re-tags every known date against `now` (a confirmed date that has passed is out). Pure.
export function retag(scenarios, now = Date.now()) {
  const again = (d) => (d && d.tag !== 'predicted' ? known(d.date, now) : d);
  return scenarios.map((s) => ({ ...s, en_start_date: again(s.en_start_date), jp_start_date: again(s.jp_start_date) }));
}
const byJpStart = (a, b) => (a.jp_start_date?.date ?? '9').localeCompare(b.jp_start_date?.date ?? '9');

// Merges GameTora's scenarios (its `scenarios` data file) into ours: JP launch times, Japanese names
// and links always, new scenarios added, GameTora's English name where we have none. Never Global's dates. Pure.
export function mergeGametora(scenarios, raws, { now = Date.now() } = {}) {
  const result = scenarios.map((s) => ({ ...s, links: { ...s.links } }));
  for (const raw of raws) {
    const english = raw.name_en_full ?? raw.name_en ?? null;
    const gametora = `${GAMETORA}${raw.url_name}`;
    let entry = result.find((s) => s.links.gametora === gametora);
    if (!entry) {
      entry = {
        key: SCENARIO_NAMES[raw.url_name]?.[0] ?? raw.url_name,
        full_en: null,
        full_jp: null,
        en_start_date: null,
        jp_start_date: null,
        links: { gametora, cover: null },
        color: null,
      };
      result.push(entry);
    }
    entry.jp_start_date = known(iso(raw.start_ja), now);
    entry.short = shortNames(raw.url_name);
    entry.full_jp = raw.name_ja ?? null;
    // An "English" name that is just the Japanese one (older files) isn't one.
    if (entry.full_en === raw.name_ja) entry.full_en = null;
    entry.full_en ??= english;
    const cover = `${GAMETORA_MEDIA}${raw.id}.png`;
    if (entry.links.cover !== cover) {
      entry.links.cover = cover;
      entry.color = null;
    }
  }
  return result.sort(byJpStart);
}

// The scenario a news post's name means: by name (full name, key or GameTora slug), else the next
// one Global hasn't launched (Global releases them in JP's order).
function matchScenario(name, scenarios) {
  const n = norm(name);
  const byName = (s) =>
    n === norm(s.full_en) || (s.key.length > 3 && n.includes(norm(s.key))) || n.includes(norm(slugOf(s)));
  return scenarios.find(byName) ?? scenarios.find(unknownOnGlobal) ?? null;
}

// Applies the scenario launches the news mentions (posts' `scenarios`: [{ full, start }]): a dated
// mention sets en_start_date (confirmed / out; it replaces a prediction) and the official name; an
// undated one only names a scenario whose launch isn't known yet. Oldest post first, so the newest
// dated mention wins. Pure. Returns { scenarios, changed: [scenario…], unmatched: [name…] }.
export function applyScenarioNews({ posts, scenarios, now = Date.now() }) {
  const result = scenarios.map((s) => ({ ...s, links: { ...s.links } }));
  const state = (s) => `${s.full_en}|${s.en_start_date?.tag === 'predicted' ? '' : s.en_start_date?.date}`;
  const before = new Map(scenarios.map((s) => [s.key, state(s)]));
  const unmatched = [];
  for (const post of [...posts].sort((a, b) => (a.posted ?? '').localeCompare(b.posted ?? ''))) {
    for (const mention of post.scenarios ?? []) {
      const entry = matchScenario(mention.full, result);
      if (!entry) {
        unmatched.push(mention.full);
        continue;
      }
      if (mention.start) {
        entry.en_start_date = known(mention.start, now);
        entry.full_en = mention.full;
        if (post.id) entry.links.umapyoi_gl = post.id; // the post that dates the launch
      } else if (unknownOnGlobal(entry)) {
        entry.full_en = mention.full;
      }
    }
  }
  const changed = result.filter((s) => before.get(s.key) !== state(s));
  return { scenarios: result, changed, unmatched: [...new Set(unmatched)] };
}

// JP's launch posts (育成シナリオ「X」公開！: categorize(post, ja) → other / scenario, name X) → each scenario's
// links.umapyoi_jp, matched by its Japanese name (spacing and punctuation aside). Pure; returns the scenarios and the
// names it couldn't match.
export function applyJpScenarioNews({ posts, scenarios }) {
  const result = scenarios.map((s) => ({ ...s, links: { ...s.links } }));
  const unmatched = [];
  for (const post of [...posts].sort((a, b) => a.post_at.localeCompare(b.post_at))) {
    const c = categorize(post, ja);
    if (c.kind !== 'scenario' || !c.name) continue;
    const entry = result.find((s) => s.full_jp && normAny(s.full_jp) === normAny(c.name));
    if (entry) entry.links.umapyoi_jp = c.id;
    else unmatched.push(c.name);
  }
  return { scenarios: result, unmatched };
}

// Computes the colours of covers that have none yet (downloads only those images). Mutates; returns
// how many it filled.
export async function fillColors(scenarios, headers) {
  let filled = 0;
  for (const s of scenarios) {
    if (s.links.cover && !s.color) {
      s.color = await imageColor(s.links.cover, headers);
      if (s.color) filled++;
    }
  }
  return filled;
}

export function readScenarios() {
  try {
    const file = JSON.parse(readFileSync(SCENARIOS_FILE, 'utf8'));
    // Older files: dates as plain ISO strings; one `full` name (English, or Japanese when GameTora had none).
    const upgrade = (d) => (typeof d === 'string' ? known(d) : d);
    const japanese = (name) => /[\u3040-\u30ff\u4e00-\u9fff\uff00-\uffef]/.test(name ?? '');
    const scenarios = file.scenarios.map(({ full, ...x }) => ({
      key: x.key,
      short: shortNames(x.links.gametora.slice(GAMETORA.length)),
      full_en: x.full_en ?? (full && !japanese(full) ? full : null),
      full_jp: x.full_jp ?? (japanese(full) ? full : null),
      en_start_date: upgrade(x.en_start_date),
      jp_start_date: upgrade(x.jp_start_date),
      links: {
        ...x.links, // umapyoi_jp / umapyoi_gl when the news has them
        gametora: x.links.gametora,
        cover: x.links.cover ?? null,
      },
      color: x.color ?? null,
    }));
    return { ...file, scenarios };
  } catch (err) {
    if (err.code === 'ENOENT') return { source: null, scenarios: [] };
    throw err;
  }
}

// One scenario per line, so commits diff per scenario (the file is excluded from Biome). Known dates
// are re-tagged on the way out. ml/scenarios.py writes the same format.
export function writeScenarios(source, scenarios) {
  const lines = retag(scenarios)
    .map((s) => JSON.stringify(s))
    .join(',\n');
  writeFileSync(SCENARIOS_FILE, `{\n"source": ${JSON.stringify(source)},\n"scenarios": [\n${lines}\n]\n}\n`);
}
