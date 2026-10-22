// Usage: pnpm news:merges [--server jp]   (every post that joined another post's event, by kind of merge; nothing written)
//
// A post's event joins another when they're one event (buildEvents(): same kind + name and overlapping dates, a
// "coming soon" post its dated one…). Grouped so the unusual ones stand out: a standalone post joining a celebration's
// part, parts of two celebration posts, posts whose own dates are far from the event's, and posts that were dropped.

import { existsSync, readFileSync } from 'node:fs';
import type { CardsFile } from '../shared/schemas/card.ts';
import { readCategories } from './lib/categories.ts';
import { type Merge, buildEvents, eventFragments, readAnswers, readCmTable } from './lib/events.ts';
import { loadPosts, serverArg } from './lib/news-api.ts';
import { lexicon } from './lib/news-lang/index.ts';
import { GENERATED_DIR } from './lib/paths.ts';

const FAR_DAYS = 7;

const cardsFile = `${GENERATED_DIR}cards.json`;
// TODO(ts): JSON.parse's any: cards.json is written by build-cards in CardsFile's shape (test/schemas.test.ts)
const cards = existsSync(cardsFile) ? (JSON.parse(readFileSync(cardsFile, 'utf8')) as CardsFile) : {};
const server = serverArg();
const lang = lexicon(server);
const posts = [...loadPosts(server).values()];
const categories = readCategories(server);
const merges: Merge[] = [];
const events = buildEvents(posts, {
  cmTable: server === 'gl' ? readCmTable() : [],
  cards,
  answers: readAnswers(server),
  lang,
  categories,
  merges,
});
const fragments = new Map(eventFragments(posts, cards, lang, categories).map((f) => [f.id, f]));
const byId = new Map(events.map((e) => [e.id, e]));
const titles = new Map(posts.map((p) => [String(p.announce_id), p.title]));

// A merge's event as it ended up (an event that joined a later one carries on under that one's id).
const into = new Map(merges.map((m) => [m.from, m.into]));
const final = (id: string): string => (into.has(id) && into.get(id) !== id ? final(into.get(id) ?? id) : id);

const day = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '…');
const post = (id: string): string => id.split('-')[0];
const groups = new Map<string, string[]>();
for (const m of merges) {
  if (/-m\d+$/.test(m.from)) continue;
  const f = fragments.get(m.from);
  const e = byId.get(final(m.into));
  const from = `${m.from} "${f?.name ?? '—'}" (${f?.kind}, ${day(f?.start)} → ${day(f?.end)}) — ${titles.get(post(m.from))}`;
  if (m.how === 'dropped' || !e) {
    (
      groups.get('dropped (no event to join)') ??
      groups.set('dropped (no event to join)', []).get('dropped (no event to join)')
    )?.push(from);
    continue;
  }
  const to = `${e.id} "${e.name ?? e.kind}" (${day(e.start.date)} → ${day(e.end?.date)})`;
  const far = f?.start && Math.abs(Date.parse(f.start) - Date.parse(e.start.date)) > FAR_DAYS * 86400000;
  const group =
    f?.parent && e.parent && post(f.parent) !== post(e.parent)
      ? 'parts of two celebration posts'
      : !f?.parent !== !e.parent
        ? 'a standalone post and a celebration part'
        : m.how !== 'overlap'
          ? `joined as ${m.how}`
          : far
            ? `starts more than ${FAR_DAYS} days apart`
            : 'routine (the same event, another post)';
  (groups.get(group) ?? groups.set(group, []).get(group))?.push(`${from}\n    → ${to}`);
}
for (const [group, list] of [...groups].sort(([a], [b]) =>
  a.startsWith('routine') ? 1 : b.startsWith('routine') ? -1 : 0
)) {
  console.log(`\n## ${group} (${list.length})\n`);
  if (group.startsWith('routine')) console.log('  (listed with --all)');
  if (!group.startsWith('routine') || process.argv.includes('--all')) for (const line of list) console.log(`- ${line}`);
}
