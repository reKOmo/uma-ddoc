// The card data the app and the tier list read (generated/cards.json, card_stats/): fetched from upstream, built from
// it and data/ (pnpm update-cards, pnpm build-cards), and rebuilt when stale (ensureCards()).

import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SERVERS } from '../../../shared/schemas/common.ts';
import type { GlobalCardsFile } from '../../../shared/schemas/card.ts';
import type { GametoraCard } from '../../../shared/schemas/gametora.ts';
import { type UpstreamCard, buildCards } from './build.ts';
import { readJpCards } from './jp.ts';
import { cardRows, cardStatsFile } from './mdb.ts';
import { jsonEntries, readJson } from '../json.ts';
import { CARDS_JSON, GENERATED_DIR, dataFile } from '../paths.ts';
import { readSources, writeSources } from '../sources.ts';
import { DATA_FILES, REPO, UPSTREAM_RAW, download, latestRef } from '../upstream.ts';

export const GAMETORA_CARDS_FILE = `${GENERATED_DIR}raw/gametora_cards.json`;
const OUTPUTS = ['cards.json', 'card_stats/gl_card_stats.json', 'card_stats/jp_card_stats.json'];
// What buildCardFiles() reads besides upstream's files: a pull that changes one makes the outputs stale.
const INPUTS = [dataFile('jp', 'cards'), dataFile('gl', 'cards'), GAMETORA_CARDS_FILE, ...SERVERS.map(cardStatsFile)];

// The query skips Node's module cache, so a rerun in the same process sees the new file.
// TODO(ts): upstream's modules (generated/raw/upstream/, as downloaded): the caller names what each exports.
const importFresh = async <T>(path: string): Promise<T> =>
  (await import(`${pathToFileURL(path)}?t=${Date.now()}`)).default;

export async function buildCardFiles(): Promise<void> {
  const glSource = readSources()['raw/upstream/gl.js'];
  if (!glSource || !('repo' in glSource))
    throw new Error('generated/sources.json: raw/upstream/gl.js has no repo (pnpm update-cards)');
  const { repo, ref } = glSource;
  // A server's list is ours where we store it (data/<server>_card_stats.json, pnpm convert-mdb), else upstream's.
  const { cards, stats } = buildCards({
    upstream: {
      gl: cardRows('gl', await importFresh<UpstreamCard[]>(`${UPSTREAM_RAW}gl.js`)),
      jp: cardRows('jp', await importFresh<UpstreamCard[]>(`${UPSTREAM_RAW}jp.js`)),
      events: await importFresh<Record<string, number[]>>(`${UPSTREAM_RAW}card-events.js`),
    },
    history: readJpCards(),
    gametora: readJson<GametoraCard[]>(GAMETORA_CARDS_FILE, []),
    globalCards: readJson<GlobalCardsFile>(dataFile('gl', 'cards'), {}),
    iconBase: `https://raw.githubusercontent.com/${repo}/${ref}/public/cardImages/`,
  });
  mkdirSync(`${GENERATED_DIR}card_stats`, { recursive: true });
  writeFileSync(CARDS_JSON, `${jsonEntries(cards, '  ')}\n`);
  for (const server of SERVERS) {
    writeFileSync(`${GENERATED_DIR}card_stats/${server}_card_stats.json`, `${jsonEntries(stats[server], '  ')}\n`);
  }
  const count = (o: object): number => Object.keys(o).length;
  console.log(
    `cards: ${count(cards)} (stats for ${count(stats.gl)} on Global, ${count(stats.jp)} on JP; ours from master.mdb: ${SERVERS.filter((s) => existsSync(cardStatsFile(s))).join(', ') || 'none'})`
  );
}

const sourceKey = (file: { local: string }): string => `raw/upstream/${file.local}`;

// Upstream main's card lists + events → generated/raw/upstream/, then the card data built from them.
export async function updateCards(): Promise<void> {
  const ref = latestRef();
  console.log(`Fetching card data from ${REPO} @ ${ref.slice(0, 10)}…`);
  const texts = await download(ref, DATA_FILES);

  // Written next to the old files and swapped in, so a failure never leaves them half-written.
  const tmp = `${UPSTREAM_RAW.slice(0, -1)}.tmp/`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  for (const file of DATA_FILES) {
    const header = `// Downloaded from https://github.com/${REPO}/blob/${ref}/${file.upstream}\n// by scripts/update-cards.js — do not edit.\n\n`;
    writeFileSync(tmp + file.local, header + texts[file.upstream]);
  }
  rmSync(UPSTREAM_RAW, { recursive: true, force: true });
  renameSync(tmp, UPSTREAM_RAW);
  const source = { repo: REPO, ref, fetched_at: new Date().toISOString() };
  writeSources(Object.fromEntries(DATA_FILES.map((file) => [sourceKey(file), source])));
  await buildCardFiles();
}

const mtime = (path: string): number => (existsSync(path) ? statSync(path).mtimeMs : 0);

// Fetches upstream's card data if this checkout is missing it, and builds the card data if that's missing or older
// than what it's built from (e.g. a pulled news commit added cards to data/jp_cards.json).
export async function ensureCards(): Promise<void> {
  const sources = readSources();
  if (DATA_FILES.some((file) => !existsSync(UPSTREAM_RAW + file.local) || !sources[sourceKey(file)])) {
    await updateCards();
    return;
  }
  const built = Math.min(...OUTPUTS.map((name) => mtime(GENERATED_DIR + name)));
  const inputs = [...INPUTS, ...DATA_FILES.map((file) => UPSTREAM_RAW + file.local)];
  if (inputs.some((path) => mtime(path) > built)) await buildCardFiles();
}
