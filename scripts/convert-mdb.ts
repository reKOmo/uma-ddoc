// Usage: pnpm convert-mdb <master.mdb> [--server gl|jp] [--message <file>]
// Converts a server's master.mdb into data/<server>_card_stats.json (default gl), the server's card list: builds read it instead of upstream's
// <server>.js. A card the converter skips keeps upstream's rows when upstream has it. Run `pnpm update-cards` first:
// it reads upstream's current list. Prints `new=`, `skipped=` and `mismatch=` against it (card ids, comma separated;
// also into $GITHUB_OUTPUT); --message writes a commit message saying the same.

import { appendFileSync, createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { UpstreamCard } from './lib/cards.ts';
import { convertMdb, toStored, withUpstreamForSkipped, writeCardStats } from './lib/mdb-cards.ts';
import type { Server } from './lib/news-text.ts';
import { GENERATED_DIR } from './lib/paths.ts';
import { UPSTREAM_RAW } from './lib/upstream.ts';

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

const byId = (rows: UpstreamCard[]): Map<number, UpstreamCard[]> => {
  const map = new Map<number, UpstreamCard[]>();
  for (const row of rows) map.set(row.id, [...(map.get(row.id) ?? []), row]);
  return map;
};

export async function convert(server: Server, mdbPath: string, messagePath?: string): Promise<void> {
  const listPath = `${UPSTREAM_RAW}${server}.js`;
  if (!existsSync(listPath)) throw new Error(`${listPath} is missing (pnpm update-cards)`);
  // TODO(ts): upstream's module exports its card list.
  const upstreamRows = (await import(pathToFileURL(listPath).href)).default as UpstreamCard[];
  const db = new DatabaseSync(mdbPath, { readOnly: true });
  const { rows, skipped } = convertMdb(db);
  db.close();
  const source = { sha256: await sha256(mdbPath) };
  writeCardStats(server, { source, skipped, cards: toStored(withUpstreamForSkipped(rows, skipped, upstreamRows)) });

  const upstream = byId(upstreamRows);
  const ours = byId(rows);
  const added = [...ours.keys()].filter((id) => !upstream.has(id));
  const mismatch = [...ours.keys()].filter(
    (id) => upstream.has(id) && !isDeepStrictEqual(ours.get(id), upstream.get(id))
  );

  const result = `new=${added.join(',')}\nskipped=${skipped.map((s) => s.id).join(',')}\nmismatch=${mismatch.join(',')}\n`;
  process.stdout.write(result);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, result);
  console.error(
    `${ours.size} cards in master.mdb: ${added.length} not in upstream's list, ${skipped.length} skipped, ${mismatch.length} different from upstream's`
  );

  if (messagePath) {
    const cardsPath = `${GENERATED_DIR}cards.json`;
    const cards: CardsFile = existsSync(cardsPath) ? JSON.parse(readFileSync(cardsPath, 'utf8')) : {};
    const label = (id: number): string => {
      const card = cards[id];
      const name = card?.name.en ?? ours.get(id)?.[0].char_name ?? '';
      return `${id} ${name}${card?.title.en ? ` ${card.title.en}` : ''}`.trim();
    };
    const sections = [
      `master.mdb ${source.sha256.slice(0, 12)}: ${ours.size} cards.`,
      added.length && `New, not in upstream's list yet:\n${added.map((id) => `- ${label(id)}`).join('\n')}`,
      skipped.length &&
        `Skipped, effects the converter doesn't know (add them to scripts/lib/mdb-cards.ts):\n${skipped
          .map(
            (s) =>
              `- ${label(s.id)}: ${s.unknown.join(', ')} (${upstream.has(s.id) ? "upstream's rows kept" : 'left out'})`
          )
          .join('\n')}`,
      mismatch.length &&
        `Different from upstream's list, ours used (a game update upstream hasn't caught up with, or the port drifted from db-convert.py):\n${mismatch.map((id) => `- ${label(id)}`).join('\n')}`,
    ].filter(Boolean);
    const what = `${server === 'gl' ? 'Global' : 'JP'} card stats`;
    const mdb = `master.mdb ${source.sha256.slice(0, 12)}`;
    const subject = added.length ? `${what}: ${added.length} new from ${mdb}` : `${what}: ${mdb}`;
    writeFileSync(messagePath, `${subject}\n\n${sections.join('\n\n')}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { server: { type: 'string', default: 'gl' }, message: { type: 'string' } },
    allowPositionals: true,
  });
  const { server } = values;
  if (positionals.length !== 1 || (server !== 'gl' && server !== 'jp')) {
    console.error('Usage: pnpm convert-mdb <master.mdb> [--server gl|jp] [--message <file>]');
    process.exit(1);
  }
  try {
    await convert(server, positionals[0], values.message);
  } catch (err) {
    console.error(`master.mdb conversion failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
