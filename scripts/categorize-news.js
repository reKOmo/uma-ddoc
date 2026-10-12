// Prints every stored news post (data/news/<server>/posts.json) with its category (scripts/lib/post-categories.js), grouped
// by category and kind, for checking the parser. No requests.
//
// Usage: pnpm news:categories [--server jp]   (--counts: only the number of posts per category / kind)

import { loadPosts, serverArg } from './lib/news-api.js';
import { lexicon } from './lib/news-lang/index.js';
import { categorize, plain } from './lib/post-categories.js';

const server = serverArg();
const lang = lexicon(server);
const counts = process.argv.includes('--counts');

const groups = new Map();
for (const post of loadPosts(server).values()) {
  const c = categorize(post, lang);
  const key = `${c.category}${c.kind ? ` / ${c.kind}` : ''}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push({ c, post });
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
