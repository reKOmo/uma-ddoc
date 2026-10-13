// Every post of the official news (Global, or JP with --server jp) into data/news/<server>/posts.json, back to the
// first one the site serves.
//
// Global's index only lists the last few months, so this starts at the newest posts and follows each post's link to
// the next older one (olderId()) until the chain ends: one request per post. JP's index lists every page
// (total_page_count), so on JP it first reads the whole index (10 posts a page) to know every id, then walks the same
// chain from each of them, so posts the index lacks are found too. 1–2 s between requests (a one-off, so quicker than
// the daily run's pace). Saves every 10 posts and skips posts already stored (following their stored link), so an
// interrupted run picks up where it stopped and a rerun only fetches what's missing. Posts already stored aren't
// refetched; `pnpm news:latest` catches edits of recent ones.
//
// Usage: pnpm news:all [--server jp]   (pnpm news:all:jp)

import { fetchPost, indexPage, loadPosts, olderId, requests, savePosts, serverArg, setPause } from './lib/news-api.ts';
import type { Server } from './lib/news-text.ts';
import type { NewsPost } from '../shared/schemas/news.ts';

setPause(1000, 2000);
// TODO(ts): serverArg() (news-api.ts, not typed yet) returns a string; it throws unless it's gl or jp.
const server = serverArg() as Server;

// TODO(ts): loadPosts() (news-api.ts, not typed yet) gives an untyped Map; the file is the stored NewsPost list.
const posts: Map<string, NewsPost> = loadPosts(server);
const before = posts.size;
// Several posts often share a post time, so the index's first post needn't be the chain's first: walk from each post
// on the first page, or on JP every page (a walk stops where an earlier one has been, so that costs nothing extra).
const starts = [];
for (let page = 1; ; page++) {
  // TODO(ts): the index's items are the API's, unchecked: indexPage() (news-api.ts) only checks they're a list.
  const { items, more }: { items: { announce_id: number }[]; more: boolean } = await indexPage(page, server);
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
      // TODO(ts): fetchPost() (news-api.ts, not typed yet) returns the post as the API sends it, unchecked.
      post = (await fetchPost(id, server)) as NewsPost;
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
