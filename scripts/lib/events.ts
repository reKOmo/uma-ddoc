// Global's in-game events from the official news alone (data/news/gl/posts.json), rebuilt into data/global_events.json
// by `pnpm update-global`. Pure, except the readers and writers in events-files.ts. Each event is one Timeline bar: everything
// in the news with dates of its own. Shape: shared/schemas/event.ts.
//
// From posts to events (buildEvents):
//   1. Posts become fragments (event-fragments.ts' postEvents()). An event post is cut into blocks at its header art
//      (eventBlocks()); a post about one event stays one event whatever art it shows. A celebration's later blocks with
//      dates of their own are sub-events; blocks without dates (a new song, stamps) belong to the block before. "Ending
//      soon" reminders are skipped.
//   2. Each mission set an event lists is a bar of its own under it (event-fragments.ts' missionBars()). Other dates inside
//      an event (Champions Meeting rounds, reward collection) stay in its bar.
//   3. Posts about the same event are merged (event-merge.ts: mergePosts(), joinUndated(), resolveParents(), spanParts()):
//      same kind and name, overlapping dates (a post without dates joins the latest such event that started before it,
//      within GROUP_DAYS). Dates and links come from the most advanced post; items take the largest count any post gives
//      (posts repeat lists); cards and titles are combined. An event spans its parts.

import { en } from './news-lang/en.ts';
import type { Lexicon } from './news-lang/index.ts';
import type { BannerFile } from '../../shared/schemas/banner.ts';
import { EVENT_KINDS } from '../../shared/schemas/event.ts';
import type { CmRewardsFile, EventItem, GameEvent } from '../../shared/schemas/event.ts';
import { dated } from '../../shared/schemas/common.ts';
import type { AiAnswersFile, NewsPost, PostCategory } from '../../shared/schemas/news.ts';
import { type Fragment, eventFragments } from './event-fragments.ts';
import { type Merge, joinUndated, mergeItems, mergePosts, resolveParents, spanParts } from './event-merge.ts';
import type { cardIndex } from './event-rewards.ts';
import { applyAnswer } from './event-answers.ts';
import { bannerOf } from './free-scouts.ts';

export type BuildOptions = {
  cmTable?: CmRewardsFile;
  cards?: Parameters<typeof cardIndex>[0];
  answers?: AiAnswersFile;
  lang?: Lexicon;
  // What ml/categorize.py makes of each post (categories.ts), over the title rules.
  categories?: Map<number, PostCategory>;
  // Filled with every post's fragment that joined another event, and how (`pnpm news:merges` lists them).
  merges?: Merge[];
  // The server's banners: each free scout window's (bannerOf()); without them, windows have none.
  banners?: Pick<BannerFile, 'characters' | 'cards'>;
};

export { EVENT_KINDS };

// The Champions Meeting reward range for a cup starting at `start`: the newest table block whose `since` is on or
// before it, min/max per item over its rows (rows not filled in yet are skipped).
const CM_ITEMS: Record<'carats' | 'monies' | 'ticket_support' | 'ticket_trainee', string> = {
  carats: 'Carats',
  monies: 'Monies',
  ticket_support: 'Support Card Scout Tickets',
  ticket_trainee: 'Trainee Scout Tickets',
};
export function cmItems(table: CmRewardsFile, start: string | null): EventItem[] {
  const block = table
    .filter((b) => b.since <= (start ?? '').slice(0, 10))
    .sort((a, b) => b.since.localeCompare(a.since))[0];
  if (!block) return [];
  // TODO(ts): Object.entries() types the keys as string
  return (Object.entries(CM_ITEMS) as [keyof typeof CM_ITEMS, string][]).flatMap(([key, name]) => {
    const values = block.final.map((row) => row[key]).filter((v): v is number => typeof v === 'number');
    return values.length ? [{ name, count: { min: Math.min(...values), max: Math.max(...values) } }] : [];
  });
}

const output = (e: Fragment, banners: BuildOptions['banners']): GameEvent => ({
  id: e.id,
  // TODO(ts): the fragment's kind is a string; the rules only make EVENT_KINDS
  kind: e.kind as GameEvent['kind'],
  name: e.name,
  parent: e.parent,
  // TODO(ts): the merged fragments are dated (undated ones are dropped or joined)
  start: dated(e.start as string, 'news'),
  end: e.end ? dated(e.end, 'news') : null,
  // What a sale lists is bought, not given (a JP pack with a support card in it).
  cards: e.kind === 'sale' ? [] : e.cards,
  items: e.kind === 'sale' ? [] : e.items,
  titles: e.titles,
  phases: e.phases?.map((p) => ({ ...p, start: dated(p.start, 'news'), end: p.end ? dated(p.end, 'news') : null })),
  races: e.races,
  ...(e.scouts?.length && {
    scouts: e.scouts.map(({ scout, type, start, end, size, scouts }) => ({
      scout,
      type,
      banner: banners ? bannerOf({ scout, type, start, end, size, scouts }, banners) : null,
      start,
      end,
      size,
      scouts,
    })),
  }),
  news_url: e.news_url ?? null,
  image: e.image ?? null,
  source: e.source,
});

// Every event the news describes, newest first. `answers` fill in the fields the rules doubted or left empty
// (applyAnswer()).
export function buildEvents(
  posts: NewsPost[],
  { cmTable = [], cards = {}, answers = {}, lang = en, categories = new Map(), merges = [], banners }: BuildOptions = {}
): GameEvent[] {
  const fragments = eventFragments(posts, cards, lang, categories)
    .map((f) => (answers[f.aiKey] ? applyAnswer(f, answers[f.aiKey].answer, { lang }) : f))
    .sort((a, b) => a.posted.localeCompare(b.posted) || a.id.localeCompare(b.id));
  const joined = mergePosts(fragments, lang, merges);
  const events = joinUndated(joined, merges, lang);
  resolveParents(events, joined.alias);
  spanParts(events, lang);
  for (const e of events) if (e.kind === 'champions_meeting') e.items = mergeItems(e.items, cmItems(cmTable, e.start));

  const byId = new Map(events.map((e) => [e.id, e]));
  return events
    .map((e) => (!e.image && e.parent ? { ...e, image: byId.get(e.parent)?.image ?? null } : e))
    .map((e) => (e.name && lang.displayName ? { ...e, name: lang.displayName(e.name) } : e))
    .map((e) => output(e, banners))
    .sort((a, b) => b.start.date.localeCompare(a.start.date) || b.id.localeCompare(a.id));
}
