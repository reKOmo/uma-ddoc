// The official Global news API (https://umamusume.com/news/) and our raw copy of it, data/news/posts.json.
//
// Two endpoints, both POST JSON, no cookies needed:
//   pr_info_index  { announce_label: 0, limit, offset } → { information_list, show_more_button }: the news page,
//                  newest first, full messages but no availability period. It only lists the last few months.
//   pr_info_detail { announce_id } → { detail, prev_announce_id, next_announce_id }: one post. prev is the next
//                  newer post, next the next older one (by post date, across every id series), so following next
//                  from the newest post walks the whole archive, older than the index reaches.
//
// posts.json keeps each post's `detail` exactly as the API sends it (dates as strings, null for none) plus
// next_announce_id and fetched_at, one post per line, newest first. Parsing happens elsewhere, from this file, so a
// parser change never needs a request.
//
// Keep it gentle: one request at a time with a random pause, 3–8 s by default (like someone reading the news page);
// the one-off archive walk goes faster with setPause().

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { NEWS_DIR } from './paths.js';
import { SITE } from './news-text.js';

export { SITE };
export const POSTS_FILE = `${NEWS_DIR}posts.json`;
export const PAGE_SIZE = 10; // what the news page itself asks for

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  Origin: SITE,
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let pause = [3000, 8000];
// The pause between requests, in ms: a random one between min and max.
export function setPause(min, max) {
  pause = [min, max];
}

export let requests = 0;
async function api(endpoint, body, referer) {
  if (requests++) await sleep(pause[0] + Math.random() * (pause[1] - pause[0]));
  const res = await fetch(`${SITE}/api/ajax/${endpoint}?format=json`, {
    method: 'POST',
    headers: { ...HEADERS, Referer: referer },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${endpoint}: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.response_code !== 1) throw new Error(`${endpoint}: response_code ${json.response_code}`);
  return json;
}

// One page of the news index: { items, more }.
export async function indexPage(offset) {
  const json = await api('pr_info_index', { announce_label: 0, limit: PAGE_SIZE, offset }, `${SITE}/news/`);
  if (!Array.isArray(json.information_list)) throw new Error('pr_info_index: no information_list (format changed?)');
  return { items: json.information_list, more: Boolean(json.show_more_button) };
}

// One post, as stored in posts.json.
export async function fetchPost(id) {
  const json = await api('pr_info_detail', { announce_id: Number(id) }, `${SITE}/news/${id}/`);
  const { detail } = json;
  if (String(detail?.announce_id) !== String(id)) throw new Error(`pr_info_detail ${id}: unexpected response`);
  return { ...detail, next_announce_id: json.next_announce_id || null, fetched_at: new Date().toISOString() };
}

// Posts by id (a string, as the API sends it).
export function loadPosts() {
  if (!existsSync(POSTS_FILE)) return new Map();
  return new Map(JSON.parse(readFileSync(POSTS_FILE, 'utf8')).map((p) => [String(p.announce_id), p]));
}

// One post per line, newest first, so commits diff per post.
export function savePosts(posts) {
  const list = [...posts.values()].sort(
    (a, b) => b.post_at.localeCompare(a.post_at) || Number(b.announce_id) - Number(a.announce_id)
  );
  mkdirSync(NEWS_DIR, { recursive: true });
  writeFileSync(POSTS_FILE, `[\n${list.map((p) => JSON.stringify(p)).join(',\n')}\n]\n`);
}
