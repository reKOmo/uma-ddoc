// Fills data/news/posts.json with the official English news posts the official site no longer serves, from
// umapyoi.net's mirror of them (https://umapyoi.net/docs/news.html: GET /api/v1/en/news → every post id,
// /api/v1/en/news/<id> → one post). Its posts are the official ones (same title, HTML, ids) in other packaging, turned
// into the official detail's shape so every parser reads them unchanged:
//   post_at / update_at   unix seconds → "YYYY-MM-DD HH:MM:SS" (UTC), 'None' → null
//   image_big             its `image` (the news index's thumbnail; the same file as the detail's header art)
//   from_date / to_date   null (the mirror doesn't have the post's display window)
//   next_announce_id      null; source: 'umapyoi'
// Only posts we don't have are fetched (the official ones stay as they are), one at a time with 1–2 s pauses; saves
// every 20 and can be rerun.
//
// Usage: pnpm news:umapyoi

import { loadPosts, savePosts } from './lib/news-api.js';

const API = 'https://umapyoi.net/api/v1/en/news';
const HEADERS = { 'User-Agent': 'uma-ddoc scraper (Umaddoc, static tier list site)' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function get(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

const date = (unix) =>
  unix && unix !== 'None' ? new Date(Number(unix) * 1000).toISOString().slice(0, 19).replace('T', ' ') : null;
const int = (s) => (s == null || s === 'None' ? null : Number(s));

// A umapyoi.net post in the official detail's shape (scripts/lib/news-api.js).
export const fromUmapyoi = (p) => ({
  announce_id: Number(p.announce_id),
  title: p.title,
  message: p.message,
  post_at: date(p.post_at),
  update_at: date(p.update_at),
  announce_label: int(p.announce_label),
  image_big: p.image && p.image !== 'None' ? p.image : '',
  post_platform_flag: int(p.post_platform_flag),
  from_date: null,
  to_date: null,
  next_announce_id: null,
  fetched_at: new Date().toISOString(),
  source: 'umapyoi',
});

const posts = loadPosts();
const ids = (await get(API)).map(Number).filter((id) => !posts.has(String(id)));
console.log(`${ids.length} posts to fetch from umapyoi.net`);
for (const [i, id] of ids.entries()) {
  await sleep(1000 + Math.random() * 1000);
  const post = fromUmapyoi(await get(`${API}/${id}`));
  posts.set(String(id), post);
  console.log(`${post.post_at}  ${id}  ${post.title}`);
  if ((i + 1) % 20 === 0) savePosts(posts);
}
savePosts(posts);
console.log(`${ids.length} posts added, ${posts.size} stored.`);
