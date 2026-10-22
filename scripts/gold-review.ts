// Usage: pnpm gold:review [--server jp]   (a local page to label every post by hand → data/news/<server>/gold.json)
//
// Posts without a label get today's rules' (gold.ts' ruleLabel()) when it starts, and posts edited since they were
// labelled are unreviewed again, written out at once; the page shows
// each post cut into units next to its label, the rules' and the other server's same-id post's (gold.ts' twins()),
// and saves one label at a time into the file as it is then.

import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { createServer, type Plugin } from 'vite';
import { GoldLabelSchema, type NewsPost } from '../shared/schemas/news.ts';
import { readGold, ruleLabel, twins, units, withRuleLabels, writeGold } from './lib/gold.ts';
import { loadPosts, serverArg } from './lib/news-api.ts';
import { newsUrl } from './lib/news-text.ts';
import { ROOT } from './lib/paths.ts';
import { plain } from './lib/post-categories.ts';

const site = serverArg();
const posts = [...loadPosts(site).values()];
const byId = new Map(posts.map((p) => [p.announce_id, p]));
const others = twins(site);
writeGold(withRuleLabels(posts, readGold(site), site), site);

const view = (post: NewsPost) => ({
  id: post.announce_id,
  title: plain(post.title),
  posted: post.post_at,
  url: newsUrl(post.announce_id, site),
  image: post.image_big || null,
  units: units(post, site),
  rules: ruleLabel(post, site),
  twin: others.get(post.announce_id) ?? null,
});
export type PostView = ReturnType<typeof view>;

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const body = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const api: Plugin = {
  name: 'gold-api',
  configureServer(server) {
    server.middlewares.use('/api/posts', (_req, res) =>
      send(res, 200, {
        server: site,
        posts: posts.map(view),
        gold: Object.fromEntries(readGold(site).map((l) => [l.id, l])),
      })
    );
    server.middlewares.use('/api/gold', async (req, res) => {
      if (req.method !== 'PUT') return send(res, 405, { error: 'PUT a label' });
      const label = GoldLabelSchema.safeParse(await body(req));
      if (!label.success) return send(res, 400, { error: label.error.message });
      // (Of the post as it is now. Read again: the file may have changed since the page loaded, by hand or another run.)
      const saved = { ...label.data, post_updated: byId.get(label.data.id)?.update_at ?? null };
      writeGold(
        readGold(site).map((l) => (l.id === saved.id ? saved : l)),
        site
      );
      send(res, 200, saved);
    });
  },
};

const server = await createServer({
  configFile: false,
  root: `${ROOT}scripts/gold-review/`,
  // (not the app's: its dev server would re-optimize after each run)
  cacheDir: `${ROOT}node_modules/.vite-gold-review`,
  plugins: [react(), api],
  server: { port: 5190, strictPort: true, open: true },
});
await server.listen();
server.printUrls();
