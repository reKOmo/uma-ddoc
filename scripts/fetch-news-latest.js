// New and edited posts from the official news (Global, or JP with --server jp) into data/news/<server>/posts.json,
// for periodic runs.
//
// Pages through the news index (10 posts a page, like the site) and stops at the first page holding a post we
// already have; fetches the detail of every post that's new or whose update_at changed. A normal day is 1–3
// requests. Needs posts.json to exist: run `pnpm news:all` once first.
//
// Writes what came in to data/news/<server>/summary.md (`pnpm update-global` appends what it changed; news.yml makes the
// commit message from it). In GitHub Actions it also writes to the job summary and $GITHUB_OUTPUT: `changed`
// (anything new or edited) and `update` (a banner, event or scenario post among them, so data/ needs rebuilding).
//
// Usage: pnpm news:latest [--server jp]   (pnpm news:latest:jp)

import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { newsDir } from './lib/paths.js';
import { fetchPost, indexPage, loadPosts, postsFile, requests, savePosts, serverArg } from './lib/news-api.js';
import { categorize, plain } from './lib/post-categories.js';
import { lexicon } from './lib/news-lang/index.js';
import { newsUrl } from './lib/news-text.js';

const MAX_PAGES = 5; // more than that and something's off
const server = serverArg();

if (!existsSync(postsFile(server))) {
  console.error(`No ${postsFile(server)} yet: run \`pnpm news:all --server ${server}\` first.`);
  process.exit(1);
}

const posts = loadPosts(server);
const fresh = [];
let reachedKnown = false;
for (let page = 1; page <= MAX_PAGES && !reachedKnown; page++) {
  const { items, more } = await indexPage(page, server);
  for (const item of items) {
    const old = posts.get(String(item.announce_id));
    if (old) reachedKnown = true;
    if (!old || old.update_at !== item.update_at) fresh.push(item);
  }
  if (!more) break;
}
if (!reachedKnown) console.warn(`Stopped after ${MAX_PAGES} pages without reaching a known post.`);

const added = [];
const edited = [];
for (const item of fresh) {
  const id = String(item.announce_id);
  (posts.has(id) ? edited : added).push(id);
  posts.set(id, await fetchPost(id, server));
}
if (fresh.length) savePosts(posts, server);

// Each server's posts read with its own wording (scripts/lib/news-lang/).
const lang = lexicon(server);
const categories = new Map([...added, ...edited].map((id) => [id, categorize(posts.get(id), lang)]));
// "- [Title](url) — event / story, started"
const describe = (id) => {
  const post = posts.get(id);
  const c = categories.get(id);
  const link = `[${plain(post.title)}](${newsUrl(id, server)})`;
  const what = [c.category, c.kind].filter(Boolean).join(' / ');
  return `- ${link} — ${what}${c.phase ? `, ${c.phase}` : ''}`;
};
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
const summary = [
  `# Umamusume news${server === 'gl' ? '' : ` (${server.toUpperCase()})`} — ${now} UTC`,
  '',
  `${added.length} new, ${edited.length} edited.`,
  '',
  ...(added.length ? ['## New', '', ...added.map(describe), ''] : []),
  ...(edited.length ? ['## Edited', '', ...edited.map(describe), ''] : []),
].join('\n');
writeFileSync(`${newsDir(server)}summary.md`, `${summary}\n`);
console.log(summary);
console.log(`${posts.size} stored (${requests} requests).`);

const update = [...categories.values()].some((c) => c.category !== 'other' || c.kind === 'scenario');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${fresh.length > 0}\nupdate=${update}\n`);
