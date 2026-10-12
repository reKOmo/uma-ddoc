// Brings JP's own record (data/) up to date with the JP news (data/news/jp/posts.json, from `pnpm news:latest:jp`):
// the scout banners its posts announce merged into data/jp_banners.json (scripts/lib/jp-banners.js), and its in-game
// events with what they give into data/jp_events.json (scripts/lib/events.js with the Japanese lexicon,
// scripts/lib/news-lang/ja.js). Idempotent: everything made from the news is rebuilt from all posts each time.
// Appends what changed to data/news/jp/summary.md.
//
// Usage: pnpm update-jp
//        pnpm update-jp --seed [--force]   first seed data/jp_banners.json from GameTora's (generated/jp_banners.json,
//                                          pnpm scrape-gametora); once: --force starts over

import { appendFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildEvents, readAnswers, readEvents, writeEvents } from './lib/events.js';
import { seedJpBanners, updateJpBanners } from './lib/jp-banners.js';
import { loadPosts } from './lib/news-api.js';
import { ja } from './lib/news-lang/ja.js';
import { GENERATED_DIR, newsDir } from './lib/paths.js';
import { readJson } from './lib/global.js';
import { ensureCards } from './update-cards.js';

const SUMMARY_FILE = `${newsDir('jp')}summary.md`;

export async function updateJp() {
  await ensureCards();
  const cards = readJson(`${GENERATED_DIR}cards.json`);
  const posts = [...loadPosts('jp').values()];

  const banners = await updateJpBanners({ posts, cards });

  // Events and what they give (data/jp_events.json), rebuilt from every post.
  const old = new Map(readEvents('jp').map((e) => [e.id, JSON.stringify(e)]));
  const events = buildEvents(posts, { cards, answers: readAnswers('jp'), lang: ja });
  writeEvents(events, 'jp');
  const changed = events.filter((e) => old.get(e.id) !== JSON.stringify(e));

  const lines = [...banners.lines, `JP events: ${events.length}, ${changed.length} added or changed.`];
  console.log(lines.join('\n'));
  if (existsSync(SUMMARY_FILE))
    appendFileSync(SUMMARY_FILE, `\n## JP record\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`);
  return { banners, events };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  Promise.resolve()
    .then(() => process.argv.includes('--seed') && seedJpBanners({ force: process.argv.includes('--force') }))
    .then(updateJp)
    .catch((err) => {
      console.error(`JP update failed: ${err.message}`);
      process.exit(1);
    });
}
