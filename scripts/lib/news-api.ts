// The official news APIs (umamusume.com, umamusume.jp) and our raw copy of each, data/news/<server>/posts.json.
//
// Both sites have the same two endpoints. Global's index lists only the last few months, and its detail's
// next_announce_id is the next older post by date. JP's index lists every post the site serves, and its
// prev/next_announce_id are the next lower/higher id served (not post date). Walking older from the newest post thus
// reaches the whole archive on JP, and on Global only past the index.
// Times are UTC strings on Global and JST strings on JP (news-text.ts' apiDate() turns both into UTC).
//
// posts.json keeps each post's `detail` as sent, plus fetched_at and the ids the detail gave. One post per line,
// newest first. Parsers read that file, so a parser change never needs a request.
//
// Keep it gentle: one request at a time with a random 1–2 s pause (the pace the archive walk, hundreds of requests,
// ran at without being blocked).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { NewsPost } from '../../shared/schemas/news.ts';
import { paced } from './http.ts';
import { newsDir } from './paths.ts';
import { NEWS_SITES, type Server, SITE } from './news-text.ts';

export { SITE };
export const postsFile = (server: Server = 'gl'): string => `${newsDir(server)}posts.json`;
export const PAGE_SIZE = 10; // what the news pages themselves ask for

// An index page's item: the fields the index gives (announce_id, update_at); the rest come from the post's detail.
export type IndexItem = Pick<NewsPost, 'announce_id' | 'update_at'>;

// What the APIs send, as far as this file reads it. Checked where it's read (response_code, information_list…).
type ApiJson = {
  response_code: number;
  information_list?: IndexItem[];
  show_more_button?: boolean | number;
  total_page_count?: number | string;
  detail?: NewsPost;
  next_announce_id?: number | null;
  prev_announce_id?: number | null;
};

// One request: a POST body (Global) or GET query (JP).
type Request = { body?: object; query?: Record<string, string | number> };

type ServerConfig = {
  headers: Record<string, string>;
  index: (page: number) => Request;
  more: (json: ApiJson, page: number) => boolean;
  detail: (id: string | number) => Request;
  ids: (json: ApiJson) => { next_announce_id: number | null; prev_announce_id?: number | null };
  older: (post: NewsPost) => number | null | undefined;
};

const BROWSER: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0',
  'Accept': '*/*',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

const SERVERS: Record<Server, ServerConfig> = {
  gl: {
    headers: { 'Accept-Language': 'en-US,en;q=0.9', 'Content-Type': 'application/json', 'Origin': NEWS_SITES.gl.site },
    index: (page: number) => ({ body: { announce_label: 0, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } }),
    more: (json: ApiJson) => Boolean(json.show_more_button),
    detail: (id: string | number) => ({ body: { announce_id: Number(id) } }),
    ids: (json: ApiJson) => ({ next_announce_id: json.next_announce_id || null }),
    older: (post: NewsPost) => post.next_announce_id,
  },
  jp: {
    headers: { 'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3' },
    index: (page: number) => ({ query: { announce_label: 0, per_page: PAGE_SIZE, page } }),
    more: (json: ApiJson, page: number) => page < Number(json.total_page_count),
    detail: (id: string | number) => ({ query: { announce_id: id } }),
    ids: (json: ApiJson) => ({
      prev_announce_id: json.prev_announce_id || null,
      next_announce_id: json.next_announce_id || null,
    }),
    older: (post: NewsPost) => post.prev_announce_id,
  },
};

// One request at a time; a random pause (1–2 s) before every request but the first.
const pace = paced({ pause: [1000, 2000] });

export class ApiError extends Error {
  readonly code: number;
  constructor(endpoint: string, code: number) {
    super(`${endpoint}: response_code ${code}`);
    this.code = code;
  }
}

export let requests = 0;
const api = (server: Server, endpoint: string, request: Request, referer: string): Promise<ApiJson> =>
  pace(() => call(server, endpoint, request, referer));
async function call(server: Server, endpoint: string, { body, query }: Request, referer: string): Promise<ApiJson> {
  requests++;
  const params = new URLSearchParams(Object.entries({ format: 'json', ...query }).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${NEWS_SITES[server].site}/api/ajax/${endpoint}?${params}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...BROWSER, ...SERVERS[server].headers, Referer: referer },
    body: body && JSON.stringify(body),
    // A blocked IP can leave a request hanging instead of refusing it.
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${endpoint}: ${res.status} ${res.statusText}`);
  // TODO(ts): res.json() is any; the fields read from it are checked where they're read (response_code, etc.).
  const json = (await res.json()) as ApiJson;
  if (json.response_code !== 1) throw new ApiError(endpoint, json.response_code);
  return json;
}

export async function indexPage(page: number, server: Server = 'gl'): Promise<{ items: IndexItem[]; more: boolean }> {
  const config = SERVERS[server];
  const json = await api(server, 'pr_info_index', config.index(page), `${NEWS_SITES[server].site}/news/`);
  if (!Array.isArray(json.information_list)) throw new Error('pr_info_index: no information_list (format changed?)');
  return { items: json.information_list, more: config.more(json, page) };
}

export async function fetchPost(id: string | number, server: Server = 'gl'): Promise<NewsPost> {
  const config = SERVERS[server];
  const json = await api(server, 'pr_info_detail', config.detail(id), NEWS_SITES[server].post(id));
  const { detail } = json;
  if (!detail || String(detail.announce_id) !== String(id))
    throw new Error(`pr_info_detail ${id}: unexpected response`);
  return { ...detail, ...config.ids(json), fetched_at: new Date().toISOString() };
}

// A post by id, or null when the site serves none with it (Global answers an unknown id with response_code 500).
export async function probePost(id: string | number, server: Server = 'gl'): Promise<NewsPost | null> {
  try {
    return await fetchPost(id, server);
  } catch (e) {
    if (e instanceof ApiError && e.code === 500) return null;
    throw e;
  }
}

// The id of the post before this one (Global: by post date, JP: by id), or null at the start of the archive.
export const olderId = (post: NewsPost, server: Server = 'gl'): string | null => {
  const id = SERVERS[server].older(post);
  return id ? String(id) : null;
};

// Posts by id (a string, as the API sends it).
export function loadPosts(server: Server = 'gl'): Map<string, NewsPost> {
  const file = postsFile(server);
  if (!existsSync(file)) return new Map();
  // TODO(ts): JSON.parse is any; posts.json is written by savePosts() below, one NewsPost per post (its schema: news.ts).
  const list = JSON.parse(readFileSync(file, 'utf8')) as NewsPost[];
  return new Map(list.map((p): [string, NewsPost] => [String(p.announce_id), p]));
}

// One post per line, newest first, so commits diff per post.
export function savePosts(posts: Map<string, NewsPost>, server: Server = 'gl'): void {
  const list = [...posts.values()].sort(
    (a, b) => b.post_at.localeCompare(a.post_at) || Number(b.announce_id) - Number(a.announce_id)
  );
  mkdirSync(newsDir(server), { recursive: true });
  writeFileSync(postsFile(server), `[\n${list.map((p) => JSON.stringify(p)).join(',\n')}\n]\n`);
}

const isServer = (s: string): s is Server => s === 'gl' || s === 'jp';

export function serverArg(argv: string[] = process.argv): Server {
  // strict: false: scripts get flags they don't read (pnpm passes them through).
  const { values } = parseArgs({ args: argv.slice(2), options: { server: { type: 'string' } }, strict: false });
  const server = values.server ?? 'gl';
  if (typeof server !== 'string' || !isServer(server)) throw new Error(`--server: gl or jp, not ${server}`);
  return server;
}
