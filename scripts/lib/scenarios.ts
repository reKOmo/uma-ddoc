// Career scenarios and when they launched on each server: data/scenarios.json (committed), in JP launch order.
// A start date is { date, tag } (or null while unknown): tag 'out' (launched), 'confirmed' (known, still ahead), or
// 'predicted' (ml/scenarios.py, with lo / hi: a rough 90% range). Known dates are re-tagged every time the file is written.
// key: the tier list's where it ranks the scenario, else ours (an id, never shown). short: names per server, by hand
// (SCENARIO_NAMES); Global's null until it has one. full_en: Global's official name once the news gives it, else GameTora's.
// color: the cover's main colour, computed once and kept.
// JP's side comes from GameTora on every scrape-gametora; Global's from the official news (update-global; GameTora's
// Global dates seeded them once), its predictions from predict-gl. Global releases JP's scenarios in JP's order.

import { readFileSync, writeFileSync } from 'node:fs';
import type { Scenario, ScenariosFile, StartDate } from '../../shared/schemas/scenario.ts';
import type { ScenarioMention } from './news.ts';
import { imageColor } from './colors.ts';
import { ja } from './news-lang/ja.ts';
import { norm as normAny } from './news-text.ts'; // keeps kana and kanji, unlike norm() below
import { DATA_DIR } from './paths.ts';
import { categorize } from './post-categories.ts';
import type { NewsPost } from '../../shared/schemas/news.ts';

export const SCENARIOS_FILE = `${DATA_DIR}scenarios.json`;
const GAMETORA = 'https://gametora.com/umamusume/';
const GAMETORA_MEDIA = 'https://media.gametora.com/umamusume/scenarios/hero/';

// A scenario while the pipeline holds it: a new one from mergeGametora() has no Japanese name, cover or colour yet
// (GameTora gives the name, fillColors() the colour), so they may be null in memory (the file never has them so).
export type ScenarioDraft = Omit<Scenario, 'full_jp' | 'links' | 'color'> & {
  full_jp: string | null;
  links: Omit<Scenario['links'], 'cover'> & { cover: string | null };
  color: string | null;
};
export type ScenariosRead = { source: ScenariosFile['source'] | null; scenarios: ScenarioDraft[] };

// GameTora's scenario (its `scenarios` data file, external JSON): the fields read here.
export type GametoraScenario = {
  id: number | string;
  url_name: string;
  name_ja?: string | null;
  name_en?: string | null;
  name_en_full?: string | null;
  start_ja?: number | null;
};

// A scenario post (news.ts' scenarioPost()): the Global launches read here.
type ScenarioPost = { id: number; posted: string | null; scenarios: ScenarioMention[] };

// The shape of a file on disk: older ones have dates as plain ISO strings and one `full` name.
type ScenarioOnDisk = {
  key: string;
  full?: string;
  full_en?: string | null;
  full_jp?: string | null;
  en_start_date: StartDate | string | null;
  jp_start_date: StartDate | string | null;
  links: { gametora: string; cover?: string | null; umapyoi_jp?: number; umapyoi_gl?: number };
  color?: string | null;
};

type ScenarioNames = [key: string, jp: string, en: string | null];

// GameTora slug → [key, JP short name, Global short name]. key: the tier list's where it ranks the
// scenario, ours otherwise (an id: URLs, the tier list; never shown as is). Short names (the "Scenario
// names" setting): JP's from upstream's en-jp locale + the community / GameTora's "for short"; Global's from
// upstream's en-gl locale, null until Global has one (the JP one shows instead). A slug missing here gets
// its slug as key and name; add it.
export const SCENARIO_NAMES: Partial<Record<string, ScenarioNames>> = {
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

export function shortNames(slug: string): Scenario['short'] {
  const [, jp, en]: ScenarioNames = SCENARIO_NAMES[slug] ?? [slug, slug, null];
  return { jp, en };
}

const iso = (unixSeconds: number | null | undefined): string | null =>
  unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
export const norm = (s: string | null | undefined): string =>
  (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const slugOf = (scenario: { links: { gametora: string } }) => scenario.links.gametora.slice(GAMETORA.length);

export const known = (date: string | null | undefined, now = Date.now()): StartDate | null =>
  date ? { date, tag: Date.parse(date) <= now ? 'out' : 'confirmed' } : null;
// Global's launch isn't known yet: none, or only a prediction.
const unknownOnGlobal = (s: ScenarioDraft) => !s.en_start_date || s.en_start_date.tag === 'predicted';

// Re-tags every known date against `now` (a confirmed date that has passed is out). Pure.
export function retag(scenarios: ScenarioDraft[], now = Date.now()): ScenarioDraft[] {
  const again = (d: StartDate | null): StartDate | null => (d && d.tag !== 'predicted' ? known(d.date, now) : d);
  return scenarios.map((s) => ({ ...s, en_start_date: again(s.en_start_date), jp_start_date: again(s.jp_start_date) }));
}
const byJpStart = (a: ScenarioDraft, b: ScenarioDraft) =>
  (a.jp_start_date?.date ?? '9').localeCompare(b.jp_start_date?.date ?? '9');

// Merges GameTora's scenarios (its `scenarios` data file) into ours: JP launch times, Japanese names
// and links always, new scenarios added, GameTora's English name where we have none. Never Global's dates. Pure.
export function mergeGametora(
  scenarios: ScenarioDraft[],
  raws: GametoraScenario[],
  { now = Date.now() }: { now?: number } = {}
): ScenarioDraft[] {
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
        short: shortNames(raw.url_name), // its place in the file: as the assignment below would put it
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
function matchScenario(name: string, scenarios: ScenarioDraft[]) {
  const n = norm(name);
  const byName = (s: ScenarioDraft) =>
    n === norm(s.full_en) || (s.key.length > 3 && n.includes(norm(s.key))) || n.includes(norm(slugOf(s)));
  return scenarios.find(byName) ?? scenarios.find(unknownOnGlobal) ?? null;
}

// Applies the scenario launches the news mentions (posts' `scenarios`: [{ full, start }]): a dated
// mention sets en_start_date (confirmed / out; it replaces a prediction) and the official name; an
// undated one only names a scenario whose launch isn't known yet. Oldest post first, so the newest
// dated mention wins. Pure. Returns { scenarios, changed: [scenario…], unmatched: [name…] }.
export function applyScenarioNews({
  posts,
  scenarios,
  now = Date.now(),
}: {
  posts: ScenarioPost[];
  scenarios: ScenarioDraft[];
  now?: number;
}): { scenarios: ScenarioDraft[]; changed: ScenarioDraft[]; unmatched: string[] } {
  const result = scenarios.map((s) => ({ ...s, links: { ...s.links } }));
  const state = (s: ScenarioDraft) =>
    `${s.full_en}|${s.en_start_date?.tag === 'predicted' ? '' : s.en_start_date?.date}`;
  const before = new Map(scenarios.map((s): [string, string] => [s.key, state(s)]));
  const unmatched: string[] = [];
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
export function applyJpScenarioNews({ posts, scenarios }: { posts: NewsPost[]; scenarios: ScenarioDraft[] }): {
  scenarios: ScenarioDraft[];
  unmatched: string[];
} {
  const result = scenarios.map((s) => ({ ...s, links: { ...s.links } }));
  const unmatched: string[] = [];
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
export async function fillColors(scenarios: ScenarioDraft[], headers?: Record<string, string>): Promise<number> {
  let filled = 0;
  for (const s of scenarios) {
    if (s.links.cover && !s.color) {
      s.color = await imageColor(s.links.cover, headers);
      if (s.color) filled++;
    }
  }
  return filled;
}

export function readScenarios(): ScenariosRead {
  try {
    // TODO(ts): JSON.parse gives any; the file as it may be on disk (ScenarioOnDisk: older files too), not checked here.
    const file = JSON.parse(readFileSync(SCENARIOS_FILE, 'utf8')) as {
      source: ScenariosFile['source'];
      scenarios: ScenarioOnDisk[];
    };
    // Older files: dates as plain ISO strings; one `full` name (English, or Japanese when GameTora had none).
    const upgrade = (d: StartDate | string | null): StartDate | null => (typeof d === 'string' ? known(d) : d);
    const japanese = (name: string | undefined) => /[\u3040-\u30ff\u4e00-\u9fff\uff00-\uffef]/.test(name ?? '');
    const scenarios = file.scenarios.map(
      ({ full, ...x }): ScenarioDraft => ({
        key: x.key,
        short: shortNames(x.links.gametora.slice(GAMETORA.length)),
        full_en: x.full_en ?? (full && !japanese(full) ? full : null),
        full_jp: x.full_jp ?? (full && japanese(full) ? full : null),
        en_start_date: upgrade(x.en_start_date),
        jp_start_date: upgrade(x.jp_start_date),
        links: {
          ...x.links, // umapyoi_jp / umapyoi_gl when the news has them
          gametora: x.links.gametora,
          cover: x.links.cover ?? null,
        },
        color: x.color ?? null,
      })
    );
    return { ...file, scenarios };
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return { source: null, scenarios: [] };
    throw err;
  }
}

// One scenario per line, so commits diff per scenario (the file is excluded from Biome). Known dates
// are re-tagged on the way out. ml/scenarios.py writes the same format.
export function writeScenarios(source: ScenariosRead['source'], scenarios: ScenarioDraft[]) {
  const lines = retag(scenarios)
    .map((s) => JSON.stringify(s))
    .join(',\n');
  writeFileSync(SCENARIOS_FILE, `{\n"source": ${JSON.stringify(source)},\n"scenarios": [\n${lines}\n]\n}\n`);
}
