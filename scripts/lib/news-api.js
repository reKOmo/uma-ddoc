// The official news APIs (Global: https://umamusume.com/news/, JP: https://umamusume.jp/news/) and our raw copy of
// each, data/news/<server>/posts.json.
//
// Both sites have the same two endpoints, called differently:
//   pr_info_index   the news page, newest first, full messages but no availability period. Global only lists the
//                   last few months.
//                     gl: POST JSON { announce_label: 0, limit, offset } → { information_list, show_more_button }
//                     jp: GET ?announce_label=0&per_page=&page= (from 1) → { information_list, total_page_count }
//   pr_info_detail  one post: { detail, prev_announce_id, next_announce_id }.
//                     gl: POST JSON { announce_id }; prev is the next newer post, next the next older one
//                     jp: GET ?announce_id=; prev is the next lower id the site serves, next the next higher one (by
//                     id, not post date; ids it doesn't serve are skipped)
//                   Following the older one from the newest post walks the whole archive. On Global that reaches
//                   older than the index; JP's index lists every post the site serves (~317, a few pinned old ones
//                   among the newest), so there the walk only checks it.
// Times are UTC strings on Global and JST strings on JP (news-text.js' apiDate() turns both into UTC).
//
// posts.json keeps each post's `detail` exactly as the API sends it (dates as strings, null for none) plus fetched_at
// and the ids the detail gave: Global's next_announce_id (older), JP's prev_announce_id (lower id) and
// next_announce_id (higher). One post per line, newest first. Parsing happens elsewhere, from this file, so a parser change never needs
// a request. olderId() reads the older post's id on either server.
//
// Keep it gentle: one request at a time with a random pause, 3–8 s by default (like someone reading the news page);
// the one-off archive walk goes faster with setPause().

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { newsDir } from './paths.js';
import { NEWS_SITES, SITE } from './news-text.js';

export { SITE };
export const postsFile = (server = 'gl') => `${newsDir(server)}posts.json`;
export const PAGE_SIZE = 10; // what the news pages themselves ask for

const BROWSER = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0',
  Accept: '*/*',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

// How each server's API is called.
const SERVERS = {
  gl: {
    headers: { 'Accept-Language': 'en-US,en;q=0.9', 'Content-Type': 'application/json', Origin: NEWS_SITES.gl.site },
    index: (page) => ({ body: { announce_label: 0, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } }),
    more: (json) => Boolean(json.show_more_button),
    detail: (id) => ({ body: { announce_id: Number(id) } }),
    ids: (json) => ({ next_announce_id: json.next_announce_id || null }),
    older: (post) => post.next_announce_id,
  },
  jp: {
    headers: { 'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3' },
    index: (page) => ({ query: { announce_label: 0, per_page: PAGE_SIZE, page } }),
    more: (json, page) => page < Number(json.total_page_count),
    detail: (id) => ({ query: { announce_id: id } }),
    ids: (json) => ({
      prev_announce_id: json.prev_announce_id || null,
      next_announce_id: json.next_announce_id || null,
    }),
    older: (post) => post.prev_announce_id,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let pause = [3000, 8000];
// The pause between requests, in ms: a random one between min and max.
export function setPause(min, max) {
  pause = [min, max];
}

export let requests = 0;
async function api(server, endpoint, { body, query }, referer) {
  if (requests++) await sleep(pause[0] + Math.random() * (pause[1] - pause[0]));
  const params = new URLSearchParams({ format: 'json', ...query });
  const res = await fetch(`${NEWS_SITES[server].site}/api/ajax/${endpoint}?${params}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...BROWSER, ...SERVERS[server].headers, Referer: referer },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${endpoint}: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.response_code !== 1) throw new Error(`${endpoint}: response_code ${json.response_code}`);
  return json;
}

// One page of the news index (from 1): { items, more }.
export async function indexPage(page, server = 'gl') {
  const config = SERVERS[server];
  const json = await api(server, 'pr_info_index', config.index(page), `${NEWS_SITES[server].site}/news/`);
  if (!Array.isArray(json.information_list)) throw new Error('pr_info_index: no information_list (format changed?)');
  return { items: json.information_list, more: config.more(json, page) };
}

// One post, as stored in posts.json.
export async function fetchPost(id, server = 'gl') {
  const config = SERVERS[server];
  const json = await api(server, 'pr_info_detail', config.detail(id), NEWS_SITES[server].post(id));
  const { detail } = json;
  if (String(detail?.announce_id) !== String(id)) throw new Error(`pr_info_detail ${id}: unexpected response`);
  return { ...detail, ...config.ids(json), fetched_at: new Date().toISOString() };
}

// The id of the post before this one (Global: by post date, JP: by id), or null at the start of the archive.
export const olderId = (post, server = 'gl') => {
  const id = SERVERS[server].older(post);
  return id ? String(id) : null;
};

// Posts by id (a string, as the API sends it).
export function loadPosts(server = 'gl') {
  const file = postsFile(server);
  if (!existsSync(file)) return new Map();
  return new Map(JSON.parse(readFileSync(file, 'utf8')).map((p) => [String(p.announce_id), p]));
}

// One post per line, newest first, so commits diff per post.
export function savePosts(posts, server = 'gl') {
  const list = [...posts.values()].sort(
    (a, b) => b.post_at.localeCompare(a.post_at) || Number(b.announce_id) - Number(a.announce_id)
  );
  mkdirSync(newsDir(server), { recursive: true });
  writeFileSync(postsFile(server), `[\n${list.map((p) => JSON.stringify(p)).join(',\n')}\n]\n`);
}

// `--server gl|jp` from a script's arguments (gl by default).
export function serverArg(argv = process.argv) {
  const i = argv.indexOf('--server');
  const server = i < 0 ? 'gl' : argv[i + 1];
  if (!SERVERS[server]) throw new Error(`--server: gl or jp, not ${server}`);
  return server;
}
