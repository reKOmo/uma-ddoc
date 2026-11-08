// Usage: pnpm fetch-umatl           fetch UmaTL's tables, then build generated/translations.json
//        pnpm fetch-umatl --build   build from the tables already fetched (after update-jp / predict-gl)
// Runs after update-jp, update-global and predict-gl: it translates what they wrote (and reads the event pairs).
// UmaTL (https://github.com/UmaTL/hachimi-tl-en) is not openly licensed: its data may be used with attribution by
// projects whose scope differs, and never with generative models (see scripts/lib/umatl.ts).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { BANNERS_FILE, readJson } from './lib/global.ts';
import { readEvents } from './lib/events.ts';
import { readGametoraEvents } from './lib/gametora-events.ts';
import { GAMETORA_TRAINEES_FILE, readJpBanners } from './lib/jp-banners.ts';
import { GENERATED_DIR } from './lib/paths.ts';
import { writeSources } from './lib/sources.ts';
import {
  TRANSLATIONS_FILE,
  UMATL_CATEGORIES,
  UMATL_MDB_FILE,
  UMATL_TEXT_FILE,
  UMATL_TABLES,
  buildTranslations,
} from './lib/umatl.ts';
import type { BannerFile } from '../shared/schemas/banner.ts';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { EventPairsFile } from '../shared/schemas/event.ts';
import type { GametoraTrainee } from '../shared/schemas/gametora.ts';
import type { UmatlRaw } from '../shared/schemas/translations.ts';

// The id-keyed text table (maintained), and the original repo's Japanese-keyed tables.
const HACHIMI = 'UmaTL/hachimi-tl-en';
const ORIGINAL = 'noccu/umamusu-translate';

// Git, not GitHub's API (its anonymous limit is shared by a CI runner's IP), as scripts/lib/upstream.ts does.
const latestRef = (repo: string, branch: string): string =>
  execFileSync('git', ['ls-remote', '--exit-code', `https://github.com/${repo}.git`, `refs/heads/${branch}`])
    .toString()
    .split('\t')[0];

async function getJson(repo: string, ref: string, path: string): Promise<unknown> {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/${path}`);
  if (!res.ok) throw new Error(`${repo} ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchUmatl(): Promise<UmatlRaw> {
  const hachimiRef = latestRef(HACHIMI, 'main');
  const originalRef = latestRef(ORIGINAL, 'master');
  // TODO(ts): UmaTL's files (their own formats); the categories and tables read here are cut, then checked by
  // test/schemas.test.ts as raw/umatl.json.
  const all = (await getJson(HACHIMI, hachimiRef, 'localized_data/text_data_dict.json')) as UmatlRaw['text_data'];
  const text_data = Object.fromEntries(Object.values(UMATL_CATEGORIES).map((c) => [c, all[c] ?? {}]));
  const mdb: UmatlRaw['mdb'] = {};
  for (const table of UMATL_TABLES) {
    const file = (await getJson(ORIGINAL, originalRef, `translations/mdb/${table}.json`)) as {
      text: UmatlRaw['mdb'][string];
    };
    mdb[table] = file.text;
  }
  mkdirSync(`${GENERATED_DIR}raw`, { recursive: true });
  writeFileSync(UMATL_TEXT_FILE, `${JSON.stringify(text_data)}\n`);
  writeFileSync(UMATL_MDB_FILE, `${JSON.stringify(mdb)}\n`);
  const fetched_at = new Date().toISOString();
  writeSources({
    'raw/umatl_text_data.json': { repo: HACHIMI, ref: hachimiRef, fetched_at },
    'raw/umatl_mdb.json': { repo: ORIGINAL, ref: originalRef, fetched_at },
  });
  return { text_data, mdb };
}

const optional = <T>(file: string, fallback: T): T => (existsSync(file) ? readJson<T>(file) : fallback);

export function writeTranslations(umatl: UmatlRaw): void {
  const { file, report } = buildTranslations({
    umatl,
    cards: readJson<CardsFile>(`${GENERATED_DIR}cards.json`),
    jpBanners: readJpBanners(),
    globalBanners: readJson<BannerFile>(BANNERS_FILE),
    jpEvents: readEvents('jp'),
    globalEvents: readEvents('gl'),
    pairs: optional<EventPairsFile | null>(`${GENERATED_DIR}event_pairs.json`, null)?.pairs ?? [],
    gametoraEvents: readGametoraEvents(),
    gametoraTrainees: optional<GametoraTrainee[]>(GAMETORA_TRAINEES_FILE, []),
  });
  if (!existsSync(`${GENERATED_DIR}event_pairs.json`))
    console.warn('translations: no event pairs (pnpm predict-gl), so no official names for JP events');
  writeFileSync(TRANSLATIONS_FILE, `${JSON.stringify(file)}\n`);
  const parts = Object.entries(report).map(([kind, { done, of }]) => `${kind} ${done}/${of}`);
  console.log(
    `translations: ${Object.keys(file.cards).length} card titles, ${parts.join(', ')} → ${TRANSLATIONS_FILE}`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { build } = parseArgs({ options: { build: { type: 'boolean' } } }).values;
    // TODO(ts): our own raw files (written above, checked by test/schemas.test.ts).
    const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
    const raw: UmatlRaw = build ? { text_data: read(UMATL_TEXT_FILE), mdb: read(UMATL_MDB_FILE) } : await fetchUmatl();
    writeTranslations(raw);
  } catch (err) {
    console.error(`UmaTL translations failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
