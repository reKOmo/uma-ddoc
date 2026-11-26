import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { type UpstreamCard, buildCards } from './lib/cards/build.ts';
import { CARDS_FILE as GLOBAL_CARDS_FILE } from './lib/banners/global.ts';
import { JP_CARDS_FILE, readJpCards } from './lib/cards/jp.ts';
import { cardRows, cardStatsFile } from './lib/cards/mdb.ts';
import { SERVERS } from '../shared/schemas/common.ts';
import { readJson } from './lib/json.ts';
import { CARDS_JSON, GENERATED_DIR } from './lib/paths.ts';
import { readSources } from './lib/sources.ts';
import { UPSTREAM_RAW } from './lib/upstream.ts';
import type { GlobalCardsFile } from '../shared/schemas/card.ts';
import type { GametoraCard } from '../shared/schemas/gametora.ts';

export const GAMETORA_CARDS_FILE = `${GENERATED_DIR}raw/gametora_cards.json`;
export { JP_CARDS_FILE };
export const OUTPUTS = ['cards.json', 'card_stats/gl_card_stats.json', 'card_stats/jp_card_stats.json'];
// What buildCardFiles() reads besides upstream's files: a pull that changes one makes the outputs stale.
export const INPUTS = [JP_CARDS_FILE, GLOBAL_CARDS_FILE, GAMETORA_CARDS_FILE, ...SERVERS.map(cardStatsFile)];

const perLine = (object: Record<string, unknown>): string =>
  `{\n${Object.entries(object)
    .map(([id, value]) => `  ${JSON.stringify(id)}: ${JSON.stringify(value)}`)
    .join(',\n')}\n}\n`;

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
    globalCards: readJson<GlobalCardsFile>(GLOBAL_CARDS_FILE, {}),
    iconBase: `https://raw.githubusercontent.com/${repo}/${ref}/public/cardImages/`,
  });
  mkdirSync(`${GENERATED_DIR}card_stats`, { recursive: true });
  writeFileSync(CARDS_JSON, perLine(cards));
  for (const server of ['gl', 'jp'] as const) {
    writeFileSync(`${GENERATED_DIR}card_stats/${server}_card_stats.json`, perLine(stats[server]));
  }
  const count = (o: object): number => Object.keys(o).length;
  console.log(
    `cards: ${count(cards)} (stats for ${count(stats.gl)} on Global, ${count(stats.jp)} on JP; ours from master.mdb: ${SERVERS.filter((s) => existsSync(cardStatsFile(s))).join(', ') || 'none'})`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await buildCardFiles();
  } catch (err) {
    console.error(`Card data build failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
