// Usage: pnpm news:umapyoi [--server jp] [--refresh-images]   (pnpm news:umapyoi:jp)
// Fetches only the posts we lack (run `pnpm news:all` first). JP's mirror has the Japanese originals; its title_english /
// message_english are machine translations and dropped. --refresh-images: updates the stored umapyoi posts' image_big
// alone (older runs stored the header art instead of the banner).

import { parseArgs } from 'node:util';
import { paced } from './lib/http.ts';
import { loadPosts, savePosts, serverArg } from './lib/news-api.ts';
import type { NewsPost } from '../shared/schemas/news.ts';

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

const server = serverArg();
const API = server === 'jp' ? 'https://umapyoi.net/api/v1/news' : 'https://umapyoi.net/api/v1/en/news';
const OFFSET = server === 'jp' ? 9 * 3600 : 0; // the official API's times: UTC on Global, JST on JP
const HEADERS = { 'User-Agent': 'uma-ddoc scraper (Umaddoc, static tier list site)' };

const pace = paced({ pause: [100, 100], first: true });
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
// On JP, older posts have no banner `image`: then their article_image (the header over the first section).
const image = (p: UmapyoiPost): string => set(p.image) || (server === 'jp' ? set(p.article_image) : '');

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

const posts = loadPosts(server);

if (
  parseArgs({ args: process.argv.slice(2), options: { 'refresh-images': { type: 'boolean' } }, strict: false }).values[
    'refresh-images'
  ]
) {
  const todo = [...posts.values()].filter((p) => p.source === 'umapyoi' && !p.image_big?.includes('/Thumbnail/'));
  console.log(`${todo.length} umapyoi posts' images to refresh`);
  let changed = 0;
  for (const [i, post] of todo.entries()) {
    const image_big = image(await pace(() => getPost(post.announce_id)));
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
  const post = fromUmapyoi(await pace(() => getPost(id)));
  posts.set(String(id), post);
  console.log(`${post.post_at}  ${id}  ${post.title}`);
  if ((i + 1) % 20 === 0) savePosts(posts, server);
}
savePosts(posts, server);
console.log(`${ids.length} posts added, ${posts.size} stored.`);
