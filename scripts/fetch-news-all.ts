// Usage: pnpm news:all [--server jp]   (pnpm news:all:jp)
// Walks each post's link to the next older one (olderId()) until the chain ends. JP's index is read in full first,
// so posts the index lacks are found too. Stored posts aren't refetched: a rerun resumes, `pnpm news:latest` catches edits.

import { fetchPost, indexPage, loadPosts, olderId, requests, savePosts, serverArg, setPause } from './lib/news-api.ts';

setPause(1000, 2000);
const server = serverArg();

const posts = loadPosts(server);
const before = posts.size;
// Posts often share a post time, so the index's first post needn't start the chain: walk from each one (a walk stops
// where an earlier one has been, so that costs nothing extra).
const starts = [];
for (let page = 1; ; page++) {
  const { items, more } = await indexPage(page, server);
  starts.push(...items.map((item) => String(item.announce_id)));
  if (server === 'gl' || !more) break;
}
console.log(`${starts.length} posts in the index`);

let fetched = 0;
const seen = new Set<string>();
for (const start of starts) {
  let id: string | null = start;
  while (id && !seen.has(id)) {
    seen.add(id);
    let post = posts.get(id);
    if (!post) {
      post = await fetchPost(id, server);
      posts.set(id, post);
      fetched++;
      console.log(`${post.post_at}  ${id}  ${post.title}`);
      if (fetched % 10 === 0) savePosts(posts, server);
    }
    id = olderId(post, server);
  }
}
savePosts(posts, server);
console.log(`${posts.size - before} new posts, ${posts.size} stored (${requests} requests).`);
