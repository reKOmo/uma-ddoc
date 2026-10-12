// Fills data/news/<server>/posts.json with the official news posts the official site no longer serves, from
// umapyoi.net's mirror of them (https://umapyoi.net/docs/news.html). Global: the English posts, GET /api/v1/en/news →
// every post id, /api/v1/en/news/<id> → one post. JP: the Japanese originals, /api/v1/news and /api/v1/news/<id> (its
// title_english / message_english are machine translations, dropped). Its posts are the official ones (same title,
// HTML, ids) in other packaging, turned into the official detail's shape so every parser reads them unchanged:
//   post_at / update_at   unix seconds → "YYYY-MM-DD HH:MM:SS" in the official API's time zone (Global UTC, JP JST),
//                         'None' → null
//   image_big             Global: its `image` (the news index's thumbnail; the same file as the detail's header art);
//                         JP: its `article_image` (the header art), else `image` (the thumbnail) under Header/
//   from_date / to_date   null (the mirror doesn't have the post's display window)
//   next_announce_id      null (and JP's prev_announce_id); source: 'umapyoi'
// Only posts we don't have are fetched (the official ones stay as they are, so run `pnpm news:all` first), one at a
// time with 0.1 s pauses (umapyoi.net allows 10 requests a second); saves every 20 and can be rerun.
//
// Usage: pnpm news:umapyoi [--server jp]   (pnpm news:umapyoi:jp)

import { loadPosts, savePosts, serverArg } from './lib/news-api.js';

const server = serverArg();
const API = server === 'jp' ? 'https://umapyoi.net/api/v1/news' : 'https://umapyoi.net/api/v1/en/news';
const OFFSET = server === 'jp' ? 9 * 3600 : 0; // the official API's times: UTC on Global, JST on JP
const HEADERS = { 'User-Agent': 'uma-ddoc scraper (Umaddoc, static tier list site)' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function get(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

const date = (unix) =>
  unix && unix !== 'None'
    ? new Date((Number(unix) + OFFSET) * 1000).toISOString().slice(0, 19).replace('T', ' ')
    : null;
const int = (s) => (s == null || s === 'None' ? null : Number(s));

const set = (url) => (url && url !== 'None' ? url : '');
// JP: the official image_big is the header art, prd-info-umamusume.akamaized.net/announce/<id>/Header/<file>; umapyoi
// has it as article_image on older posts and otherwise only the thumbnail, the same file under Thumbnail/.
const image = (p) =>
  server === 'jp' ? set(p.article_image) || set(p.image).replace('/Thumbnail/', '/Header/') : set(p.image);

// A umapyoi.net post in the official detail's shape (scripts/lib/news-api.js).
export const fromUmapyoi = (p) => ({
  announce_id: Number(p.announce_id),
  title: p.title,
  message: p.message,
  post_at: date(p.post_at),
  update_at: date(p.update_at),
  announce_label: int(p.announce_label),
  image_big: image(p),
  post_platform_flag: int(p.post_platform_flag),
  from_date: null,
  to_date: null,
  ...(server === 'jp' && { prev_announce_id: null }),
  next_announce_id: null,
  fetched_at: new Date().toISOString(),
  source: 'umapyoi',
});

const posts = loadPosts(server);
const ids = (await get(API)).map(Number).filter((id) => !posts.has(String(id)));
console.log(`${ids.length} posts to fetch from umapyoi.net`);
for (const [i, id] of ids.entries()) {
  await sleep(100);
  const post = fromUmapyoi(await get(`${API}/${id}`));
  posts.set(String(id), post);
  console.log(`${post.post_at}  ${id}  ${post.title}`);
  if ((i + 1) % 20 === 0) savePosts(posts, server);
}
savePosts(posts, server);
console.log(`${ids.length} posts added, ${posts.size} stored.`);
