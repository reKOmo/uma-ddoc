// Every post of the official Global news into data/news/posts.json, back to the first one.
//
// Starts at the newest post in the index and follows each post's next_announce_id (the next older post) until the
// chain ends: one request per post, 1–2 s apart (a one-off, so quicker than the daily run's pace). Saves every 10
// posts and skips posts already stored (following their stored next_announce_id), so an interrupted run picks up
// where it stopped and a rerun only fetches what's missing. Posts already stored aren't refetched; `pnpm news:latest` catches edits
// of recent ones.
//
// Usage: pnpm news:all

import { fetchPost, indexPage, loadPosts, requests, savePosts, setPause } from './lib/news-api.js';

setPause(1000, 2000);

const posts = loadPosts();
const before = posts.size;
// Several posts often share a post time, so the index's first post needn't be the chain's first: walk from each post
// on the first page (a walk stops where an earlier one has been, so that costs nothing extra).
const { items } = await indexPage(0);

let fetched = 0;
const seen = new Set();
for (const item of items) {
  let id = String(item.announce_id);
  while (id && !seen.has(id)) {
    seen.add(id);
    let post = posts.get(id);
    if (!post) {
      post = await fetchPost(id);
      posts.set(id, post);
      fetched++;
      console.log(`${post.post_at}  ${id}  ${post.title}`);
      if (fetched % 10 === 0) savePosts(posts);
    }
    id = post.next_announce_id ? String(post.next_announce_id) : null;
  }
}
savePosts(posts);
console.log(`${posts.size - before} new posts, ${posts.size} stored (${requests} requests).`);
