// A post's events as fragments (one per event it describes, mission sets included), before posts about the same event
// are merged; a celebration's are cut by events/celebration.ts.

import { en } from '../news/lang/en.ts';
import type { Block, Lexicon } from '../news/lang/index.ts';
import type { NewsPost, PostCategory } from '../../../shared/schemas/news.ts';
import { blockLines, eventBlocks, joinBlocks } from './blocks.ts';
import { type PostContext, celebrationEvents } from './celebration.ts';
import { type Dates, cmPhases, datesDoubt, headingPeriod, openingPeriod } from './dates.ts';
import { type Fragment, aiKey, rewards, withDoubts } from './doubts.ts';
import { blockRaces } from './races.ts';
import { cardIndex, itemsIn } from './rewards.ts';
import { UNNAMED_KINDS } from '../ai/questions.ts';
import { categorize, plain } from '../news/categorize.ts';
import { apiDate, newsUrl } from '../news/text.ts';

export type { Fragment };

type PostOptions = {
  index?: ReturnType<typeof cardIndex>;
  lang?: Lexicon;
  names?: Map<string, string>;
  classified?: PostCategory;
};

// An event post as fragments: one per event it describes, before posts about the same event are merged.
export function postEvents(
  post: NewsPost,
  { index = new Map(), lang = en, names = new Map(), classified }: PostOptions = {}
): Fragment[] {
  const rules = categorize(post, lang);
  // (A gold name, else the rules': the classifiers name nothing.)
  const label = classified
    ? {
        ...rules,
        category: classified.category,
        kind: classified.kind,
        phase: classified.phase,
        name: classified.name ?? rules.name,
      }
    : rules;
  if (label.category !== 'event' || label.phase === 'ending') return [];
  // TODO(ts): a stored post always has a time
  const posted = new Date(apiDate(post.post_at, lang.server) as string).toISOString();
  // TODO(ts): an event post always has a kind
  const kind = label.kind as string;
  const year = lang.dateRef(posted);
  const ended = label.phase === 'ended';
  const ctx: PostContext = {
    post,
    lang,
    index,
    names,
    id: String(label.id),
    name: label.name,
    ended,
    posted,
    year,
    base: { posted, phase: label.phase, news_url: newsUrl(label.id, lang.server), source: 'news' },
    blocks: eventBlocks(post, lang),
    // "has ended" posts only confirm the event; their dates are the reward collection's.
    unlessEnded: (period) => (ended ? null : period),
    withEnd: (period, block: Block) =>
      period && !period.end && lang.deadline ? { ...period, end: lang.deadline(block, year) } : period,
  };
  return kind === 'celebration' ? celebrationEvents(ctx, classified) : singleEvent(ctx, kind);
}

function singleEvent(ctx: PostContext, kind: string): Fragment[] {
  const { post, lang, index, names, year, posted, ended, base, blocks, unlessEnded, withEnd } = ctx;
  // A schedule of phases: a Champions Meeting's (JP: also a League of Heroes'), else any event's that gives more than
  // its period (a story event's reward collection).
  const kindSchedule = kind === 'champions_meeting' ? lang.cmPhases : lang.schedules?.[kind];
  const schedule = kindSchedule ?? lang.eventPhases;
  const whole = joinBlocks(blocks);
  const lines = blockLines(whole);
  const headed = headingPeriod(whole, year, lang);
  const races = blockRaces(whole, lang, names);
  const phases = ended ? null : cmPhases(whole, year, lang, schedule);
  // (JP: a gift sent without a period runs from when it was posted to the deadline of who gets it.)
  const sent = lang.deadline && kind === 'gift' ? { start: posted, end: null } : null;
  const period = unlessEnded(withEnd(headed ?? openingPeriod(whole, year, lang) ?? sent, whole));
  const { fields, scoutsDoubt } = rewards(lines, index, year, lang);
  const event = {
    ...base,
    id: ctx.id,
    kind: kind,
    name: ctx.name ?? (UNNAMED_KINDS.includes(kind) ? null : lang.titleName(plain(post.title))),
    parent: null,
    start: period?.start ?? (ended ? null : posted),
    // Announced without dates ("coming in late November"): joins the event when its dated post comes. (Not a gift:
    // it's sent when posted.)
    undated: !period && !ended && kind !== 'gift',
    end: period?.end ?? null,
    image: post.image_big || blocks.find((b) => b.art)?.art || null,
    ...fields,
    ...(phases && (kindSchedule || phases.length > 1) && { phases }),
    ...(races.length && { races }),
  };
  return [withDoubts(event, lines, lang, { scouts: scoutsDoubt, dates: singleDatesDoubt(ctx, period, headed) })];
}

function singleDatesDoubt({ ended, blocks, lang }: PostContext, period: Dates | null, headed: Dates | null) {
  if (ended) return null;
  if (!period) return 'no dates found: it starts when posted';
  return datesDoubt(blocks, period, headed, lang);
}

// Every mission set an event lists ("Sprinters Stakes Missions" + its period) is a bar of its own under it (kind
// missions, id `<event>-m<n>`).
function missionBars(f: Fragment, lang: Lexicon): Fragment[] {
  const { missions = [], ...event } = f;
  if (!event.start) return [event]; // an "ended" post: its sets are the event's, already listed
  // What a set gives is only named in the post's sentence about its missions ("By completing these missions, you can
  // earn rewards including carats, monies and Support Points!"); posts never give per-set amounts.
  const about = f.text.split('\n').filter(lang.missionRewards);
  return [
    event,
    ...missions.map((set, i) => {
      const id = `${f.id}-m${i + 1}`;
      return {
        ...event,
        id,
        kind: 'missions',
        name: set.name,
        parent: f.id,
        start: set.start,
        end: set.end,
        cards: [],
        items: itemsIn(about, lang),
        titles: [],
        image: null,
        doubts: {},
        aiKey: aiKey(id, `${set.name}\n${f.text}`),
      };
    }),
  ];
}

// Every event fragment the news describes (one per event per post, mission sets included), with its doubts, text
// and aiKey, before posts about the same event are merged: what the model is asked about (news:ai).
export function eventFragments(
  posts: NewsPost[],
  cards: Parameters<typeof cardIndex>[0] = {},
  lang: Lexicon = en,
  categories: Map<number, PostCategory> = new Map()
): Fragment[] {
  const index = cardIndex(cards, lang);
  // (JP: a Legend Race's opponents by Global's name for them, where a card of theirs has one.)
  const names = new Map(
    Object.values(cards).flatMap((card) =>
      card.name?.jp && card.name.en && lang.cardLang !== 'en' ? [[card.name.jp, card.name.en] as const] : []
    )
  );
  return posts
    .flatMap((post) => postEvents(post, { index, lang, names, classified: categories.get(post.announce_id) }))
    .flatMap((f) => missionBars(f, lang));
}
