// Usage: pnpm news:latest [--server jp]   (pnpm news:latest:jp). Needs posts.json: run `pnpm news:all` once first.
// In GitHub Actions also writes the job summary and $GITHUB_OUTPUT: `changed`, and `update` (a banner, event or
// scenario post came in, so data/ needs rebuilding).

import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { newsDir } from './lib/paths.ts';
import { fetchPost, indexPage, loadPosts, postsFile, requests, savePosts, serverArg } from './lib/news-api.ts';
import { categorize, plain } from './lib/post-categories.ts';
import { lexicon } from './lib/news-lang/index.ts';
import { newsUrl } from './lib/news-text.ts';
import type { NewsPost } from '../shared/schemas/news.ts';
import type { Categorized } from './lib/post-categories.ts';

const MAX_PAGES = 5; // more than that and something's off
const server = serverArg();

if (!existsSync(postsFile(server))) {
  console.error(`No ${postsFile(server)} yet: run \`pnpm news:all --server ${server}\` first.`);
  process.exit(1);
}

const posts = loadPosts(server);
// An index entry: the fields this script reads.
type IndexItem = { announce_id: number; update_at: string | null };
const fresh: IndexItem[] = [];
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

const added: string[] = [];
const edited: string[] = [];
for (const item of fresh) {
  const id = String(item.announce_id);
  (posts.has(id) ? edited : added).push(id);
  posts.set(id, await fetchPost(id, server));
}
if (fresh.length) savePosts(posts, server);

const lang = lexicon(server);
// Every id here was stored just above.
const stored = (id: string): NewsPost => {
  const post = posts.get(id);
  if (!post) throw new Error(`${id} is not stored`);
  return post;
};
const categories = new Map<string, Categorized>([...added, ...edited].map((id) => [id, categorize(stored(id), lang)]));
// "- [Title](url) — event / story, started"
const describe = (id: string): string => {
  const post = stored(id);
  const c = categories.get(id);
  if (!c) throw new Error(`${id} is not categorized`);
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
