// Prints every stored news post (data/news/<server>/posts.json) with its category (scripts/lib/post-categories.js), grouped
// by category and kind, for checking the parser. No requests.
//
// Usage: pnpm news:categories [--server jp]   (--counts: only the number of posts per category / kind)

import { parseArgs } from 'node:util';
import type { NewsPost } from '../shared/schemas/news.ts';
import { loadPosts, serverArg } from './lib/news-api.ts';
import { lexicon } from './lib/news-lang/index.ts';
import { type Categorized, categorize, plain } from './lib/post-categories.ts';

const server = serverArg();
const lang = lexicon(server);
const counts = parseArgs({ args: process.argv.slice(2), options: { counts: { type: 'boolean' } }, strict: false })
  .values.counts;

const groups = new Map<string, { c: Categorized; post: NewsPost }[]>();
for (const post of loadPosts(server).values()) {
  const c = categorize(post, lang);
  const key = `${c.category}${c.kind ? ` / ${c.kind}` : ''}`;
  const list = groups.get(key) ?? [];
  list.push({ c, post });
  groups.set(key, list);
}

for (const [key, list] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`${counts ? '' : '\n'}${key} (${list.length})`);
  if (counts) continue;
  for (const { c, post } of list) {
    const banners = c.banners.map((b) => `${b.gachaId}:${b.type}`).join(' ');
    const extra = [c.phase, c.name && `"${c.name}"`, banners].filter(Boolean).join('  ');
    console.log(`  ${String(c.id).padStart(6)}  ${post.post_at.slice(0, 10)}  ${plain(post.title)}  → ${extra}`);
  }
}
