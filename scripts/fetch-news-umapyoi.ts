// Fills data/news/<server>/posts.json with the official news posts the official site no longer serves, from
// umapyoi.net's mirror of them (https://umapyoi.net/docs/news.html). Global: the English posts, GET /api/v1/en/news →
// every post id, /api/v1/en/news/<id> → one post. JP: the Japanese originals, /api/v1/news and /api/v1/news/<id> (its
// title_english / message_english are machine translations, dropped). Its posts are the official ones (same title,
// HTML, ids) in other packaging, turned into the official detail's shape so every parser reads them unchanged:
//   post_at / update_at   unix seconds → "YYYY-MM-DD HH:MM:SS" in the official API's time zone (Global UTC, JP JST),
//                         'None' → null
//   image_big             its `image`: the post's banner as the news list shows it (936×228; Global: the same file as
//                         the detail's header art; JP: …/Thumbnail/<file>, on older posts the only banner of the post
//                         as a whole: its `article_image` is then the header over its first section, 936×120, which
//                         in a celebration post is its first part's), else (JP) `article_image`
//   from_date / to_date   null (the mirror doesn't have the post's display window)
//   next_announce_id      null (and JP's prev_announce_id); source: 'umapyoi'
// Only posts we don't have are fetched (the official ones stay as they are, so run `pnpm news:all` first), one at a
// time with 0.1 s pauses (umapyoi.net allows 10 requests a second); saves every 20 and can be rerun.
// --refresh-images (JP): instead, fetches the stored umapyoi posts again and updates their image_big alone (older runs
// stored the header art; resumable: a post already showing its …/Thumbnail/ banner is skipped).
//
// Usage: pnpm news:umapyoi [--server jp] [--refresh-images]   (pnpm news:umapyoi:jp)

import { loadPosts, savePosts, serverArg } from './lib/news-api.ts';
import type { Server } from './lib/news-text.ts';
import type { NewsPost } from '../shared/schemas/news.ts';

// umapyoi.net's post as its API sends it (its fields are read as they come; see fromUmapyoi()).
type UmapyoiPost = {
  announce_id: number | string;
  title: string;
  message: string;
  post_at: number | string | null; // unix seconds, or 'None'
  update_at: number | string | null;
  announce_label: number | string | null;
  image?: string | null;
  article_image?: string | null;
  post_platform_flag: number | string | null;
};

// TODO(ts): serverArg() (news-api.ts, not typed yet) returns a string; it throws unless it's gl or jp.
const server = serverArg() as Server;
const API = server === 'jp' ? 'https://umapyoi.net/api/v1/news' : 'https://umapyoi.net/api/v1/en/news';
const OFFSET = server === 'jp' ? 9 * 3600 : 0; // the official API's times: UTC on Global, JST on JP
const HEADERS = { 'User-Agent': 'uma-ddoc scraper (Umaddoc, static tier list site)' };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function get(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

// TODO(ts): umapyoi.net's post, unchecked: fromUmapyoi() and image() read its fields as the mirror sends them.
const getPost = async (id: number | string): Promise<UmapyoiPost> => (await get(`${API}/${id}`)) as UmapyoiPost;

const date = (unix: number | string | null | undefined): string | null =>
  unix && unix !== 'None'
    ? new Date((Number(unix) + OFFSET) * 1000).toISOString().slice(0, 19).replace('T', ' ')
    : null;
const int = (s: number | string | null | undefined): number | null => (s == null || s === 'None' ? null : Number(s));

const set = (url: string | null | undefined): string => (url && url !== 'None' ? url : '');
// The post's banner (see image_big above).
const image = (p: UmapyoiPost): string => set(p.image) || (server === 'jp' ? set(p.article_image) : '');

// A umapyoi.net post in the official detail's shape (scripts/lib/news-api.js).
export const fromUmapyoi = (p: UmapyoiPost): NewsPost => {
  const post = {
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
    source: 'umapyoi' as const,
  };
  // TODO(ts): umapyoi.net's API is unchecked: every post has a time and a label (as the mirror sends them, 'None'
  // aside, which the helpers above turn into null), so the nulls the types allow don't come up.
  return post as NewsPost;
};

// TODO(ts): loadPosts() (news-api.ts, not typed yet) gives an untyped Map; the file is the stored NewsPost list.
const posts: Map<string, NewsPost> = loadPosts(server);

if (process.argv.includes('--refresh-images')) {
  const todo = [...posts.values()].filter((p) => p.source === 'umapyoi' && !p.image_big?.includes('/Thumbnail/'));
  console.log(`${todo.length} umapyoi posts' images to refresh`);
  let changed = 0;
  for (const [i, post] of todo.entries()) {
    await sleep(100);
    const image_big = image(await getPost(post.announce_id));
    if (image_big && image_big !== post.image_big) changed++;
    posts.set(String(post.announce_id), { ...post, image_big: image_big || post.image_big });
    if ((i + 1) % 100 === 0) {
      savePosts(posts, server);
      console.log(`${i + 1}/${todo.length}, ${changed} changed`);
    }
  }
  savePosts(posts, server);
  console.log(`${todo.length} refreshed, ${changed} images changed.`);
  process.exit(0);
}

const list = await get(API);
if (!Array.isArray(list)) throw new Error(`${API}: not a list of ids`);
const ids = list.map(Number).filter((id) => !posts.has(String(id)));
console.log(`${ids.length} posts to fetch from umapyoi.net`);
for (const [i, id] of ids.entries()) {
  await sleep(100);
  const post = fromUmapyoi(await getPost(id));
  posts.set(String(id), post);
  console.log(`${post.post_at}  ${id}  ${post.title}`);
  if ((i + 1) % 20 === 0) savePosts(posts, server);
}
savePosts(posts, server);
console.log(`${ids.length} posts added, ${posts.size} stored.`);
