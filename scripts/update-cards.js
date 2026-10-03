import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { DATA_FILES, GENERATED_DIR, REPO, ROOT, download, latestRef } from './lib/upstream.js';
import { NAME_FIELD, joinCards } from '../tierlist/join-cards.js';

const statsOf = ({ id, limit_break, char_name, type, group, rarity, ...stats }) => stats;

// Splits the two upstream card lists into metadata + per-server stats. The
// lists must join back to exactly the input, which also proves that type,
// group, rarity and names are consistent across limit breaks and servers.
function split(lists) {
  const metadata = {};
  const stats = {};
  for (const [server, cards] of Object.entries(lists)) {
    stats[server] = {};
    for (const card of cards) {
      metadata[card.id] ??= {
        id: card.id,
        type: card.type,
        group: card.group,
        rarity: card.rarity,
        name_en: null,
        name_jp: null,
      };
      metadata[card.id][NAME_FIELD[server]] = card.char_name;
      stats[server][card.id] ??= [];
      stats[server][card.id][card.limit_break] = statsOf(card);
    }
  }
  for (const [server, cards] of Object.entries(lists)) {
    if (!isDeepStrictEqual(joinCards(server, metadata, stats[server]), cards)) {
      throw new Error(`${server}: split card data doesn't join back to the upstream list`);
    }
  }
  return { metadata, stats };
}

const OUTPUTS = ['card-events.json', 'metadata.json', 'global_stats.json', 'jp_stats.json', 'SOURCE.json'];

// JSON keyed by card id, one card per line so the files stay readable and diffable.
function jsonSource(object) {
  const lines = Object.entries(object).map(([id, value]) => `  ${JSON.stringify(id)}: ${JSON.stringify(value)}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

const importDefault = async (path) => (await import(pathToFileURL(path))).default;

export async function updateCards() {
  const ref = await latestRef();
  console.log(`Fetching card data from ${REPO} @ ${ref.slice(0, 10)}…`);
  const sources = await download(ref, DATA_FILES);

  // Build everything in a temp dir and swap it in, so a failure never leaves
  // generated/ half-written.
  const tmp = `${ROOT}generated.tmp/`;
  rmSync(tmp, { recursive: true, force: true });
  try {
    for (const file of DATA_FILES) {
      mkdirSync(dirname(tmp + file.local), { recursive: true });
      const header = `// Downloaded from https://github.com/${REPO}/blob/${ref}/${file.upstream}\n// by scripts/update-cards.js — do not edit.\n\n`;
      writeFileSync(tmp + file.local, header + sources[file.upstream]);
    }
    const lists = {
      gl: await importDefault(`${tmp}raw/gl.js`),
      jp: await importDefault(`${tmp}raw/jp.js`),
    };
    const { metadata, stats } = split(lists);

    writeFileSync(`${tmp}card-events.json`, jsonSource(await importDefault(`${tmp}raw/card-events.js`)));
    writeFileSync(`${tmp}metadata.json`, jsonSource(metadata));
    writeFileSync(`${tmp}global_stats.json`, jsonSource(stats.gl));
    writeFileSync(`${tmp}jp_stats.json`, jsonSource(stats.jp));
    const source = {
      repo: REPO,
      ref,
      fetched_at: new Date().toISOString(),
      cards: {
        total: Object.keys(metadata).length,
        gl: Object.keys(stats.gl).length,
        jp: Object.keys(stats.jp).length,
      },
    };
    writeFileSync(`${tmp}SOURCE.json`, `${JSON.stringify(source, null, 2)}\n`);

    // Swap in only our files; other scripts also write to generated/.
    mkdirSync(GENERATED_DIR, { recursive: true });
    for (const name of readdirSync(tmp)) {
      rmSync(GENERATED_DIR + name, { recursive: true, force: true });
      renameSync(tmp + name, GENERATED_DIR + name);
    }
    console.log(
      `Wrote ${source.cards.total} cards to generated/ (${source.cards.gl} on Global, ${source.cards.jp} on JP).`
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Fetches card data only if this checkout is missing any of it.
export async function ensureCards() {
  if (OUTPUTS.some((name) => !existsSync(GENERATED_DIR + name))) await updateCards();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await updateCards();
  } catch (err) {
    console.error(`Card data update failed: ${err.message}`);
    process.exit(1);
  }
}
