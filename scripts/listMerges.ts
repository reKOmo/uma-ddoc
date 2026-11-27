// Usage: pnpm news:merges [--server jp]   (every post that joined another post's event, by kind of merge; nothing written)
//
// A post's event joins another when they're one event (buildEvents(): same kind + name and overlapping dates, a
// "coming soon" post its dated one…). Grouped so the unusual ones stand out: a standalone post joining a celebration's
// part, parts of two celebration posts, posts whose own dates are far from the event's, and posts that were dropped.

import { parseArgs } from 'node:util';
import type { Merge } from './lib/events/merge.ts';
import { serverArg } from './lib/news/api.ts';
import { DAY } from './lib/news/text.ts';
import { newsContext } from './lib/events/context.ts';

const FAR_DAYS = 7;

// strict: false: pnpm passes flags through that this script doesn't read.
const { values: flags } = parseArgs({ options: { all: { type: 'boolean' } }, strict: false });
const news = newsContext(serverArg());
const merges: Merge[] = [];
const events = news.events(merges);
const fragments = new Map(news.fragments().map((f) => [f.id, f]));
const byId = new Map(events.map((e) => [e.id, e]));
const titles = new Map(news.posts.map((p) => [String(p.announce_id), p.title]));

// A merge's event as it ended up (an event that joined a later one carries on under that one's id).
const into = new Map(merges.map((m) => [m.from, m.into]));
const final = (id: string): string => (into.has(id) && into.get(id) !== id ? final(into.get(id) ?? id) : id);

const day = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '…');
const post = (id: string): string => id.split('-')[0];
const entries = merges
  .filter((m) => !/-m\d+$/.test(m.from))
  .map((m): [group: string, line: string] => {
    const f = fragments.get(m.from);
    const e = byId.get(final(m.into));
    const from = `${m.from} "${f?.name ?? '—'}" (${f?.kind}, ${day(f?.start)} → ${day(f?.end)}) — ${titles.get(post(m.from))}`;
    if (m.how === 'dropped' || !e) return ['dropped (no event to join)', from];
    const to = `${e.id} "${e.name ?? e.kind}" (${day(e.start.date)} → ${day(e.end?.date)})`;
    const far = f?.start && Math.abs(Date.parse(f.start) - Date.parse(e.start.date)) > FAR_DAYS * DAY;
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
    return [group, `${from}\n    → ${to}`];
  });
const groups = Map.groupBy(entries, ([group]) => group);
for (const [group, list] of [...groups].sort(([a], [b]) =>
  a.startsWith('routine') ? 1 : b.startsWith('routine') ? -1 : 0
)) {
  console.log(`\n## ${group} (${list.length})\n`);
  if (group.startsWith('routine')) console.log('  (listed with --all)');
  if (!group.startsWith('routine') || flags.all) for (const [, line] of list) console.log(`- ${line}`);
}
