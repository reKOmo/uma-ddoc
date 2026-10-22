// Usage: pnpm news:features [--server jp]   (a server's posts → generated/news_features[_jp].json, what
// ml/categorize.py learns from)
//
// What the parsers see in each post, so the classifiers (docs/data/classifier.md) need no parser of their own:
// per post its title, opening sentence, text, template phrases, art series, id series, today's rules' label and the
// other server's same-id post's (gold.ts' twins()); per unit (gold.ts' units()) its opening sentence, headings, text,
// art series, whether it gives dates and the rules' role. `stale`: edited since its gold label (no gold, gold.ts).

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { GoldLabel, NewsPost } from '../shared/schemas/news.ts';
import { blockLines } from './lib/event-blocks.ts';
import { type Twin, readGold, ruleLabel, stale, twins, units } from './lib/gold.ts';
import { loadPosts, serverArg } from './lib/news-api.ts';
import { lexicon } from './lib/news-lang/index.ts';
import type { Server } from './lib/news-text.ts';
import { GENERATED_DIR } from './lib/paths.ts';
import { plain, postSignals } from './lib/post-categories.ts';

export const featuresFile = (server: Server = 'gl'): string =>
  `${GENERATED_DIR}news_features${server === 'gl' ? '' : `_${server}`}.json`;

// An art id's leading digits name its series, its last five count within it (Global's 264 New Beginnings 2026, 301
// story events; JP's 2128…); JP's campaign art is named by the campaign's date (CP_20261017).
const series = (id: string | null | undefined): string | null =>
  id && /^\d{6,}$/.test(id) ? id.slice(0, -5) : (id ?? null);
// 1… in-game news, 100001… notices, 200001… community posts (Global's series; JP's are all in-game news).
const idSeries = (id: number): string => (id > 200000 ? 'community' : id > 100000 ? 'notice' : 'news');
// A line giving a date: Global's "(UTC)", JP's "12/29 12:00".
const DATED: Record<Server, RegExp> = { gl: /\(UTC\)/, jp: /\d{1,2}\/\d{1,2}\s*\d{1,2}:\d{2}/ };

function features(post: NewsPost, server: Server, others: Map<number, Twin>, gold: Map<number, GoldLabel>) {
  const lang = lexicon(server);
  const rules = ruleLabel(post, server);
  const twin = others.get(post.announce_id);
  const label = gold.get(post.announce_id);
  const cut = units(post, server);
  const title = plain(post.title);
  const opening = cut.flatMap(blockLines)[0] ?? '';
  const body = cut.flatMap(blockLines).join('\n');
  return {
    id: post.announce_id,
    posted: post.post_at,
    title,
    opening,
    body,
    art: series(post.image_big.match(lang.artId)?.slice(1).find(Boolean)),
    arts: cut.filter((u) => u.art).length,
    idSeries: idSeries(post.announce_id),
    stale: label !== undefined && stale(label, post),
    signals: postSignals(post, lang),
    rules: { category: rules.category, kind: rules.kind, phase: rules.phase },
    twin: twin ? { category: twin.category, kind: twin.kind } : null,
    units: cut.map((unit, i) => ({
      opening: unit.intro[0] ?? unit.sections[0]?.lines[0] ?? '',
      headings: unit.sections.map((s) => s.heading),
      body: blockLines(unit).join('\n'),
      art: series(unit.artId),
      dated: blockLines(unit).some((line) => DATED[server].test(line)),
      empty: blockLines(unit).length === 0,
      // (the rules cut only event posts into parts)
      rules: rules.units[i] ? { role: rules.units[i].role, kind: rules.units[i].kind } : null,
    })),
  };
}
export type PostFeatures = ReturnType<typeof features>;

export function writeFeatures(server: Server = 'gl'): number {
  const others = twins(server);
  const gold = new Map(readGold(server).map((l) => [l.id, l]));
  const all = [...loadPosts(server).values()].map((post) => features(post, server, others, gold));
  writeFileSync(featuresFile(server), `${JSON.stringify(all)}\n`);
  return all.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = serverArg();
  console.log(`${writeFeatures(server)} posts → ${featuresFile(server).replace(GENERATED_DIR, 'generated/')}`);
}
