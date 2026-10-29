// Global's in-game events from the official news alone (data/news/gl/posts.json), rebuilt into data/global_events.json
// by `pnpm update-global`. Pure, except the readers and writers at the bottom. Each event is one Timeline bar: everything
// in the news with dates of its own. Shape: shared/schemas/event.ts.
//
// From posts to events (buildEvents):
//   1. An event post is cut into blocks at its header art (eventBlocks()); a post about one event stays one event
//      whatever art it shows. A celebration's later blocks with dates of their own are sub-events; blocks without dates
//      (a new song, stamps) belong to the block before. "Ending soon" reminders are skipped.
//   2. Each mission set an event lists is a bar of its own under it (missionBars()). Other dates inside an event (Champions
//      Meeting rounds, reward collection) stay in its bar. An event spans its parts.
//   3. Posts about the same event are merged: same kind and name, overlapping dates (a post without dates joins the latest
//      such event that started before it, within GROUP_DAYS). Dates and links come from the most advanced post; items take
//      the largest count any post gives (posts repeat lists); cards and titles are combined.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DATA_DIR, newsDir } from './paths.ts';
import { DAY, apiDate, newsUrl } from './news-text.ts';
import { en } from './news-lang/en.ts';
import { blockLines, eventBlocks, joinBlocks } from './event-blocks.ts';
import { blockRaces } from './event-races.ts';
import { cardIndex, cardsIn, copiesDoubt, itemDoubt, itemsIn, missionsIn, norm, titlesIn } from './event-rewards.ts';
import { SUB_EVENT_KINDS, UNNAMED_KINDS, applyAnswer } from './event-questions.ts';
import { type ScoutWindow, bannerOf, scoutWindows } from './free-scouts.ts';
import { categorize, plain } from './post-categories.ts';
import { EVENT_KINDS } from '../../shared/schemas/event.ts';
import type { BannerFile } from '../../shared/schemas/banner.ts';
import type { CmRewardsFile, EventCard, EventItem, EventsFile, GameEvent, Race } from '../../shared/schemas/event.ts';
import { dated } from '../../shared/schemas/common.ts';
import type { AiAnswersFile, NewsPost, PostCategory } from '../../shared/schemas/news.ts';
import type { Block, DateRef, Lexicon } from './news-lang/index.ts';
import type { Server } from './news-text.ts';

type Dates = { start: string | null; end: string | null };
// A phase as a post gives it (`output()` dates it as the news').
type PostPhase = { key: string; start: string; end: string | null };
// One event as one post describes it, before posts about the same event are merged (`GameEvent` plus what merging and
// the model's questions need; `output()` keeps only the schema's fields).
export type Fragment = {
  id: string;
  kind: string;
  name: string | null;
  parent: string | null;
  start: string | null;
  end: string | null;
  cards: EventCard[];
  items: EventItem[];
  titles: string[];
  phases?: PostPhase[];
  races?: Race[];
  news_url: string;
  image: string | null;
  source: 'news';
  posted: string;
  phase: string | null;
  // Announced without dates: joins the event when its dated post comes.
  undated?: boolean;
  // What the rules aren't sure of, { field: why }; the event's text and its key for a stored model answer.
  doubts: Record<string, string>;
  text: string;
  aiKey: string;
  // Lines elsewhere in the post about its cards.
  context?: string[];
  // Mission sets it lists (taken out into bars of their own by missionBars()).
  missions?: { name: string; start: string; end: string | null }[];
  // A daily free scout campaign's windows (free-scouts.ts).
  scouts?: ScoutWindow[];
};
// part: the sub-event's id suffix, null for the celebration itself.
// (kind: the classified unit's, ml/categorize.py; else the rules decide it.)
type Group = {
  part: string | null;
  first: Block;
  blocks: Block[];
  period: Dates | null;
  headed: boolean;
  kind?: string | null;
};
type Schedule = [string, RegExp][];
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
export type Merge = { from: string; into: string; how: 'overlap' | 'same dates' | 'undated' | 'ended' | 'dropped' };

export const EVENTS_FILE = `${DATA_DIR}global_events.json`;
export const eventsFile = (server: Server = 'gl'): string =>
  server === 'gl' ? EVENTS_FILE : `${DATA_DIR}${server}_events.json`;
export const CM_REWARDS_FILE = `${DATA_DIR}champions_meeting_rewards.json`;
// A model's answers about what the rules doubted, by event aiKey.
export const answersFile = (server: Server = 'gl'): string => `${newsDir(server)}ai_answers.json`;

export { EVENT_KINDS };

const GROUP_DAYS = 14;
// An event announced without dates comes within this many days ("coming in early February", posted Jan 9; a cup's
// name comes back months later). (JP: `lang.sameEventDays(kind)`, cups announced two months ahead.)
const SAME_EVENT_DAYS = 45;
// How far along a post is: dates from a later stage win.
const STAGE: Record<string, number> = { announced: 1, league_selection: 2, started: 3 };

// The wording of periods, sub-events and schedules is the lexicon's (scripts/lib/news-lang/): every function below
// takes `lang`, English by default.

function span(dates: Dates[]): Dates | null {
  const starts = dates.map((d) => d.start).filter((d): d is string => !!d);
  if (!starts.length) return null;
  const ends = dates.map((d) => d.end).filter((d): d is string => !!d);
  return { start: starts.sort()[0], end: ends.sort().at(-1) ?? null };
}

// A block's dates from its period headings (the main ones when it has any; a Champions Meeting's league selection
// counts), or null.
function headingPeriod(block: Block, year: DateRef, lang: Lexicon): Dates | null {
  const own = block.sections.filter((s) => lang.period.test(s.heading) && !lang.notOwn.test(s.heading));
  // A "Gift Timing" list is moments, not periods: from the first to the last.
  const parse = (sections: Block['sections']): Dates | null =>
    span(
      sections.flatMap((s): Dates[] => {
        const dates = s.lines.filter(lang.periodLine).map((line) => lang.parsePeriod(line, year));
        const moments = dates
          .map((d) => d.start)
          .filter((d): d is string => !!d)
          .sort();
        return lang.timing.test(s.heading) && moments.length > 1
          ? [{ start: moments[0], end: moments.at(-1) ?? null }]
          : dates;
      })
    );
  const main = own.filter((s) => lang.main.test(s.heading));
  return (main.length && parse(main)) || parse(own) || null;
}

// The start a block's opening sentences give ("As of 10:00 p.m., Oct 7, 2026 (UTC), …"), or null.
function openingPeriod(block: Block, year: DateRef, lang: Lexicon): Dates | null {
  const opening = block.intro.find((line) => lang.starts.test(line) && lang.opening(line));
  return opening ? { start: lang.parsePeriod(opening, year).start, end: null } : null;
}

// An event's schedule, from its post's phase headings: [{ key, start, end }] in order (a Champions Meeting's: CM_PHASES).
// Its keys are the same in every lexicon (the app's list: src/timeline/events.js).
export const CM_PHASES = en.cmPhases;
export function cmPhases(
  block: Block,
  year: DateRef,
  lang: Lexicon = en,
  schedule: Schedule = lang.cmPhases
): PostPhase[] {
  // (A "coming soon" post lists them as lines instead: "League Selection: From 10:00 p.m., Oct 27, 2026 (UTC)".)
  const labelled = block.sections
    .flatMap((s) => s.lines)
    .map((l) => l.match(/^(.+?)[:：]\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m);
  return schedule.flatMap(([key, re]) => {
    const section = block.sections.find((s) => re.test(s.heading));
    const line =
      section?.lines.find((l) => lang.periodLine(l) && lang.parsePeriod(l, year).start) ??
      labelled.find(
        ([, label, rest]) => (re.test(label) || re.test(`${label} period`)) && lang.parsePeriod(rest, year).start
      )?.[2];
    if (!line) return [];
    const { start, end } = lang.parsePeriod(line, year);
    // TODO(ts): the line was picked for having a start, which the compiler can't follow
    return [{ key, start: start as string, end }];
  });
}

// The name in a sub-event's opening sentence ("the Sparkly Magic Show Holiday Present event is underway!" → "Sparkly
// Magic Show Holiday Present"), or null.
function sentenceName(block: Block, lang: Lexicon): string | null {
  for (const line of block.intro) {
    const sentence = line.replace(lang.subOpening, '');
    // (JP: `lang.subName(sentence)` picks among the names a sentence quotes.)
    const named = lang.subName?.(sentence);
    if (named) return lang.cleanName(named);
    for (const re of lang.subNames) {
      const m = sentence.match(re);
      if (m) return lang.cleanName(m[1]);
    }
  }
  return null;
}

// A sub-event's name from its opening sentences, else its first heading that isn't a period, else null.
function subEventName(block: Block, lang: Lexicon): string | null {
  const named = sentenceName(block, lang) ?? lang.blockName?.(block);
  if (named) return named;
  const heading = block.sections.find((s) => !lang.period.test(s.heading) && !lang.notNameHeading.test(s.heading));
  return heading ? heading.heading : null;
}

// A sub-event's kind, or null when nothing in it says (it's then a campaign).
function matchedKind(name: string | null, block: Block, lang: Lexicon): string | null {
  const opening = [name ?? '', block.intro[0] ?? ''].join(' ');
  const headings = block.sections.map((s) => s.heading).join(' ');
  for (const text of [opening, headings]) {
    const kind = lang.subKinds.find(([, re]) => re.test(text))?.[0];
    if (kind) return kind;
  }
  return null;
}
const subEventKind = (name: string | null, block: Block, lang: Lexicon): string =>
  matchedKind(name, block, lang) ?? 'campaign';
// (A lexicon's subKinds and 'campaign' are SUB_EVENT_KINDS, the kinds a model may answer.)
if (en.subKinds.some(([kind]) => !SUB_EVENT_KINDS.includes(kind))) throw new Error('subKinds outside SUB_EVENT_KINDS');

// What the rules aren't sure of in an event, { field: why }: the fields a model is asked about (its answers fill them in
// at build time, applyAnswer()). Fields: items, cards (copies), name, kind, dates.

// FNV-1a: an event's text in a short key, so a stored answer is reused until the post changes.
const hash = (text: string): string => {
  let h = 0x811c9dc5;
  for (const ch of text) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  return h.toString(36);
};

function withDoubts(
  event: Omit<Fragment, 'doubts' | 'text' | 'aiKey'>,
  lines: string[],
  lang: Lexicon,
  more: Record<string, string | null | false> = {}
): Fragment {
  const found = { items: itemDoubt(lines, event.items, lang), cards: copiesDoubt(lines, event.cards, lang), ...more };
  const doubts = Object.fromEntries(Object.entries(found).filter((entry): entry is [string, string] => !!entry[1]));
  const text = lines.join('\n');
  return { ...event, doubts, text, aiKey: `${event.id}:${hash(text)}` };
}

// Why an event's dates may be wrong, or null (`headed`: they come from period headings).
function datesDoubt(
  blocks: Block[],
  period: Dates | null,
  headed: boolean | Dates | null,
  lang: Lexicon
): string | null {
  if (!period) return null;
  if (blocks.some((b) => b.sections.some((s) => lang.timing.test(s.heading)))) return 'dates from a list of moments';
  return headed ? null : 'dates from a sentence, not a period heading';
}

function rewards(lines: string[], index: ReturnType<typeof cardIndex>, year: DateRef, lang: Lexicon) {
  const free = scoutWindows(lines, year, lang);
  return {
    cards: cardsIn(lines, index, lang),
    items: itemsIn(lines, lang),
    titles: titlesIn(lines, lang),
    missions: missionsIn(lines, year, lang),
    ...(free && { scouts: free.scouts }),
  };
}
const scoutsDoubt = (lines: string[], year: DateRef, lang: Lexicon): string | null =>
  scoutWindows(lines, year, lang)?.doubt ?? null;

// An event post as fragments: one per event it describes, before posts about the same event are merged.
export function postEvents(
  post: NewsPost,
  index: ReturnType<typeof cardIndex> = new Map(),
  lang: Lexicon = en,
  names: Map<string, string> = new Map(),
  classified?: PostCategory
): Fragment[] {
  const rules = categorize(post, lang);
  // (A gold name, else the rules': the classifiers name nothing.)
  const c = classified
    ? {
        ...rules,
        category: classified.category,
        kind: classified.kind,
        phase: classified.phase,
        name: classified.name ?? rules.name,
      }
    : rules;
  if (c.category !== 'event' || c.phase === 'ending') return [];
  // TODO(ts): a stored post always has a time
  const posted = new Date(apiDate(post.post_at, lang.server) as string).toISOString();
  // TODO(ts): an event post always has a kind
  const kind = c.kind as string;
  const year = lang.dateRef(posted);
  const title = lang.titleName(plain(post.title));
  const base = { posted, phase: c.phase, news_url: newsUrl(c.id, lang.server), source: 'news' as const };
  // "has ended" posts only confirm the event; their dates are the reward collection's.
  const dated = (period: Dates | null): Dates | null => (c.phase === 'ended' ? null : period);
  const blocks = eventBlocks(post, lang);

  // A schedule of phases: a Champions Meeting's (JP: also a League of Heroes'), else any event's that gives more than
  // its period (a story event's reward collection).
  const own = kind === 'champions_meeting' ? lang.cmPhases : lang.schedules?.[kind];
  const schedule = own ?? lang.eventPhases;
  // (JP: a gift without an end of its own runs until the deadline of who gets it, `lang.deadline`.)
  const withEnd = (period: Dates | null, block: Block): Dates | null =>
    period && !period.end && lang.deadline ? { ...period, end: lang.deadline(block, year) } : period;

  if (kind !== 'celebration') {
    const whole = joinBlocks(blocks);
    const lines = blockLines(whole);
    const headed = headingPeriod(whole, year, lang);
    const races = blockRaces(whole, lang, names);
    const phases = c.phase === 'ended' ? null : cmPhases(whole, year, lang, schedule);
    // (JP: a gift sent without a period runs from when it was posted to the deadline of who gets it.)
    const sent = lang.deadline && kind === 'gift' ? { start: posted, end: null } : null;
    const period = dated(withEnd(headed ?? openingPeriod(whole, year, lang) ?? sent, whole));
    const event = {
      ...base,
      id: String(c.id),
      kind: kind,
      name: c.name ?? (UNNAMED_KINDS.includes(kind) ? null : title),
      parent: null,
      start: period?.start ?? (c.phase === 'ended' ? null : posted),
      // Announced without dates ("coming in late November"): joins the event when its dated post comes. (Not a gift:
      // it's sent when posted.)
      undated: !period && c.phase !== 'ended' && kind !== 'gift',
      end: period?.end ?? null,
      image: post.image_big || blocks.find((b) => b.art)?.art || null,
      ...rewards(lines, index, year, lang),
      ...(phases && (own || phases.length > 1) && { phases }),
      ...(races.length && { races }),
    };
    return [
      withDoubts(event, lines, lang, {
        scouts: scoutsDoubt(lines, year, lang),
        dates:
          c.phase === 'ended'
            ? null
            : !period
              ? 'no dates found: it starts when posted'
              : datesDoubt(blocks, period, headed, lang),
      }),
    ];
  }

  // A celebration: its first block, then a sub-event per later block with dates of its own. (JP: a block can be no
  // part at all, `lang.blockRole`: a scout's, or a summary of what other parts give.) A first block that goes on to
  // open an included event ("As of …, Part 2 of the … Login Bonus has begun!", "The in-game collaboration event …, Sparkly
  // Magic Show, is set to kick off at …") gives that event its period and contents: a sub-event of its own (id -0).
  const groups: Group[] = [];
  const postLines = lang.partCopies ? blocks.flatMap(blockLines) : [];
  // Classified: the post cut into units as the gold set is (the intro a unit of its own), each unit's role
  // deciding: the celebration's own text, a part of its kind, more of the group before, or left out.
  const units = classified?.units.length ? eventBlocks(post, { ...lang, introBlock: true }) : [];
  if (classified && units.length === classified.units.length) {
    units.forEach((block, n) => {
      const { role, kind: partKind } = classified.units[n];
      if (role === 'none') return;
      if (role === 'part') {
        const headed = headingPeriod(block, year, lang);
        const period = withEnd(headed ?? openingPeriod(block, year, lang) ?? { start: posted, end: null }, block);
        groups.push({ part: String(n), first: block, blocks: [block], period, headed: !!headed, kind: partKind });
      } else if (role === 'continues' && groups.length) groups.at(-1)?.blocks.push(block);
      else if (groups[0]?.part === null) groups[0].blocks.push(block);
      else groups.unshift({ part: null, first: block, blocks: [block], period: null, headed: false });
    });
    if (groups[0]?.part !== null)
      groups.unshift({ part: null, first: units[0], blocks: [], period: null, headed: false });
    // (Its own period: a heading of its own text, never a part's.)
    const own = groups[0].blocks.length ? headingPeriod(joinBlocks(groups[0].blocks), year, lang) : null;
    Object.assign(groups[0], { period: withEnd(own, groups[0].first), headed: !!own });
  }
  const [first, ...rest] = groups.length ? [] : blocks;
  // (Only when the block's period is that event's: it starts with the later sentence, not the celebration's.)
  const startOf = (line: string | undefined) =>
    line && lang.starts.test(line) && lang.opening(line) ? lang.parsePeriod(line, year).start : null;
  const firstPeriod = first && headingPeriod(first, year, lang);
  const opens =
    first && firstPeriod?.start && startOf(first.intro[0]) && startOf(first.intro[0]) !== firstPeriod.start
      ? first.intro.findIndex((line, n) => n > 0 && startOf(line) === firstPeriod.start)
      : -1;
  const parts: [string | null, Block][] =
    opens > 0
      ? [
          [null, { ...first, intro: first.intro.slice(0, opens), sections: [] }],
          ['0', { ...first, art: null, artId: null, intro: first.intro.slice(opens) }],
        ]
      : first
        ? [[null, first]]
        : [];
  parts.push(...rest.map((block, n): [string, Block] => [String(n + 1), block]));
  for (const [part, block] of groups.length ? [] : parts) {
    if (part !== null && lang.blockRole?.(block)) continue;
    // A sub-event has a period heading or gift/reward contents of its own (a gift sent once has no period: it starts
    // when its sentence says, else when posted); a dated sentence alone ("a new song has been added as of …") is news
    // within the celebration.
    const gives = block.sections.some((s) => lang.gives.test(s.heading));
    const headed = headingPeriod(block, year, lang);
    const period = withEnd(
      headed ??
        (part === null
          ? opens > 0
            ? openingPeriod(block, year, lang)
            : null
          : gives
            ? (openingPeriod(block, year, lang) ?? { start: posted, end: null })
            : null),
      block
    );
    if (part === null || period) groups.push({ part, first: block, blocks: [block], period, headed: !!headed });
    else groups.at(-1)?.blocks.push(block);
  }
  const id = String(c.id);
  const events = groups.map(({ part, first, blocks: own, period, headed, kind: partKind }) => {
    const inGame = part !== null ? first.intro[0]?.match(lang.inGameEvent ?? /$^/) : null;
    const name = part === null ? c.name : (inGame?.[1] ?? subEventName(first, lang));
    const lines = own.flatMap(blockLines);
    const event = {
      ...base,
      id: part === null ? id : `${id}-${part}`,
      // (An in-game event's sentence is unmistakable, more so than the unit model's kind.)
      kind: part === null ? 'celebration' : inGame ? 'special' : (partKind ?? subEventKind(name, first, lang)),
      name: name ?? c.name,
      parent: part === null ? null : id,
      start: dated(period)?.start ?? null,
      end: dated(period)?.end ?? null,
      image: part === null ? post.image_big || first.art || null : first.art,
      ...rewards(lines, index, year, lang),
    };
    // (JP: copies of a card given in several parts are often counted per part elsewhere in the post: "「…ログインボーナス」
    // で最大2枚、「…ミッション第2弾」で最大3枚".)
    if (lang.partCopies && part !== null)
      event.cards = event.cards.map((card) =>
        card.copies == null ? { ...card, copies: lang.partCopies?.(postLines, event.name, card) ?? null } : card
      );
    const sub = part !== null;
    return withDoubts(event, lines, lang, {
      name:
        sub &&
        !inGame &&
        !sentenceName(first, lang) &&
        "the name is a heading or the celebration's, not from a sentence",
      kind: sub && !partKind && !inGame && !matchedKind(name, first, lang) && 'nothing says what kind it is',
      dates: sub && c.phase !== 'ended' && datesDoubt(own, period, headed, lang),
      scouts: scoutsDoubt(lines, year, lang),
    });
  });
  // Lines elsewhere in the post about an event's cards ("up to three times in the Missions" in the gift's section):
  // the model sees them to give this event's share (scripts/lib/event-questions.js).
  groups.forEach((group, n) => {
    const event = events[n];
    if (!event.cards.length) return;
    const titles = event.cards.map((c) => norm(c.title));
    const elsewhere = groups.filter((g) => g !== group).flatMap((g) => g.blocks.flatMap(blockLines));
    // A line naming the card, and the next one when it goes on about copies ("It can be obtained up to two times…").
    const context = [
      ...new Set(
        elsewhere.flatMap((line, i) =>
          titles.some((t) => norm(line).includes(t))
            ? [line, ...(lang.copiesNext.test(elsewhere[i + 1] ?? '') ? [elsewhere[i + 1]] : [])]
            : []
        )
      ),
    ];
    if (!context.length) return;
    events[n] = { ...event, context, aiKey: `${event.id}:${hash(`${event.text}\n${context.join('\n')}`)}` };
  });
  // A celebration without a period of its own: from its opening sentence (else its first sub-event) to its last
  // sub-event's end.
  const [overview, ...subs] = events;
  if (!overview.start && c.phase !== 'ended') {
    const all = span(subs.filter((e) => !lang.notSpanning?.(e)));
    overview.start = openingPeriod(blocks[0], year, lang)?.start ?? all?.start ?? posted;
    overview.end = all?.end ?? null;
  }
  return events;
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
        aiKey: `${id}:${hash(`${set.name}\n${f.text}`)}`,
      };
    }),
  ];
}

// (An event without a start, an "ended" post's, never matches: NaN.)
const ms = (date: string | null): number => Date.parse(date ?? '');
const endOf = (e: Dates): number => ms(e.end ?? e.start) || ms(e.start) + DAY;
const overlap = (a: Dates, b: Dates): boolean => ms(a.start) <= endOf(b) && ms(b.start) <= endOf(a);
// One race weekend's post inside a G1 celebration's part for all of them (JP's weekly 「育成報酬」ピース追加キャンペーン
// under the part listing every race's window): less than half its length, within it.
const windowOf = (part: Dates, post: Dates): boolean =>
  endOf(post) - ms(post.start) < (endOf(part) - ms(part.start)) / 2 &&
  ms(post.start) >= ms(part.start) - DAY &&
  endOf(post) <= endOf(part) + DAY;
const sameKey = (e: { kind: string; name: string | null }): string => `${e.kind}|${norm(e.name)}`;

function mergeItems(a: EventItem[], b: EventItem[]): EventItem[] {
  const items = new Map<string, EventItem>(a.map((i) => [norm(i.name), i]));
  for (const item of b) {
    const old = items.get(norm(item.name));
    if (!old || (item.count != null && (old.count == null || item.count > old.count))) items.set(norm(item.name), item);
  }
  return [...items.values()];
}

// A later post's races, with what it leaves out ("Outer → Inner / Rain / Heavy", no season) from an earlier post's same
// races.
function laterRaces(old: Race[] = [], next: Race[]): Race[] {
  if (old.length !== next.length || old.some((race, i) => race.track !== next[i].track)) return next;
  return next.map((race, i) => {
    const filled = { ...race };
    for (const [key, value] of Object.entries(old[i]) as [keyof Race, Race[keyof Race]][])
      if (filled[key] == null) Object.assign(filled, { [key]: value });
    return filled;
  });
}

function merge(event: Fragment, next: Fragment, lang: Lexicon = en): Fragment {
  const later = (STAGE[next.phase ?? ''] ?? 0) >= (STAGE[event.phase ?? ''] ?? 0) && next.start;
  // (JP: posts at the same stage each give some of an event's windows, `lang.unionDates`: one race weekend's piece
  // campaign in its own post, all of them in a celebration's.)
  const union = lang.unionDates && later && event.start && next.phase === event.phase;
  const cards = new Map(event.cards.map((card) => [card.id, card]));
  for (const card of next.cards)
    cards.set(card.id, { ...card, copies: Math.max(card.copies ?? 0, cards.get(card.id)?.copies ?? 0) || null });
  return {
    ...event,
    // A cup's schedule from the latest post that has one ("coming soon" posts give only rough starts).
    ...(next.phases?.length && { phases: next.phases }),
    // Race conditions too (a cup's can change after it's announced).
    ...(next.races?.length && { races: laterRaces(event.races, next.races) }),
    ...(later && {
      // (Both begun: the first post's start stands; a story's later episodes don't move it.)
      start: next.phase === 'started' && event.phase === 'started' && event.start ? event.start : next.start,
      end: next.end ?? event.end,
      phase: next.phase,
      news_url: next.news_url,
    }),
    ...(union && span([event, next])),
    // An event with a post of its own that a celebration's post lists too is that celebration's part.
    parent: event.parent ?? next.parent,
    image: event.image ?? next.image,
    cards: [...cards.values()],
    items: mergeItems(event.items, next.items),
    titles: [...new Set([...event.titles, ...next.titles])],
    // (A celebration lists the same windows as the campaign's own post: the later post's.)
    ...((next.scouts ?? event.scouts) && { scouts: next.scouts?.length ? next.scouts : event.scouts }),
  };
}

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

const FIELDS = ['id', 'kind', 'name', 'parent', 'start', 'end', 'cards', 'items', 'titles', 'phases', 'races'] as const;
const output = (e: Fragment, banners: BuildOptions['banners']): GameEvent => ({
  // TODO(ts): fromEntries() loses the keys; FIELDS are GameEvent's, and the merged fragments have them all (dated, kind known)
  ...(Object.fromEntries(FIELDS.map((f) => [f, e[f]])) as Omit<
    Pick<GameEvent, (typeof FIELDS)[number]>,
    'start' | 'end' | 'phases'
  >),
  // TODO(ts): the merged fragments are dated (undated ones are dropped or joined)
  start: dated(e.start as string, 'news'),
  end: e.end ? dated(e.end, 'news') : null,
  ...(e.phases && {
    phases: e.phases.map((p) => ({ ...p, start: dated(p.start, 'news'), end: p.end ? dated(p.end, 'news') : null })),
  }),
  // What a sale lists is bought, not given (a JP pack with a support card in it).
  cards: e.kind === 'sale' ? [] : e.cards,
  items: e.kind === 'sale' ? [] : e.items,
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

// Every event fragment the news describes (one per event per post, mission sets included), with its doubts, text
// and aiKey, before posts about the same event are merged: what the model is asked about (news:ai).
export function eventFragments(
  posts: NewsPost[],
  cards: BuildOptions['cards'] = {},
  lang: Lexicon = en,
  categories: BuildOptions['categories'] = new Map()
): Fragment[] {
  const index = cardIndex(cards, lang);
  // (JP: a Legend Race's opponents by Global's name for them, where a card of theirs has one.)
  const names = new Map(
    Object.values(cards).flatMap((card) =>
      card.name?.jp && card.name.en && lang.cardLang !== 'en' ? [[card.name.jp, card.name.en] as const] : []
    )
  );
  return posts
    .flatMap((post) => postEvents(post, index, lang, names, categories.get(post.announce_id)))
    .flatMap((f) => missionBars(f, lang));
}

// Every event the news describes, newest first. `answers` fill in the fields the rules doubted or left empty
// (applyAnswer()).
export function buildEvents(
  posts: NewsPost[],
  { cmTable = [], cards = {}, answers = {}, lang = en, categories = new Map(), merges = [], banners }: BuildOptions = {}
): GameEvent[] {
  const fragments = eventFragments(posts, cards, lang, categories)
    .map((f) => (answers[f.aiKey] ? applyAnswer(f, answers[f.aiKey].answer, { lang }) : f))
    .sort((a, b) => a.posted.localeCompare(b.posted) || a.id.localeCompare(b.id));
  let events: Fragment[] = [];
  const byKey = new Map<string, Fragment[]>();
  const alias = new Map<string, string>(); // a merged fragment's id → its event's (sub-events point at their post's celebration)
  const byFragmentId = new Map(fragments.map((f) => [f.id, f]));
  const series = (part: Fragment) =>
    norm(byFragmentId.get(part.parent ?? '')?.name?.replace(/\s*(?:part \d+|第\d+弾)$/i, '') ?? null);
  // (the celebration a part belongs to, after its posts merged)
  const owner = (part: Fragment) => part.parent && (alias.get(part.parent) ?? part.parent);
  for (const f of fragments) {
    const key = sameKey(f);
    const same = byKey.get(key) ?? [];
    // (Parts of two celebration posts are one event only within one series, and only a shop re-listed with new items
    // or a part with the very same start (a re-listing): New Beginnings' Star Pieces aren't Fall G1's, a Part 3's
    // "Discounted Carats" or "Daily Free Scout" isn't Part 2's, though they overlap.)
    const relisted = (e: Fragment) =>
      series(e) === series(f) && (owner(e) === owner(f) || f.kind === 'shop' || e.start === f.start);
    // (A standalone post and a part are one event, unless the post is one window of the part's: its own bar.)
    const joins = (e: Fragment) =>
      e.parent && f.parent ? relisted(e) : e.parent ? !windowOf(e, f) : f.parent ? !windowOf(f, e) : true;
    const match = f.start
      ? same.find((e) => overlap(e, f) && joins(e))
      : same
          .filter((e) => ms(e.start) <= Date.parse(f.posted))
          .find((e) => Date.parse(f.posted) - endOf(e) <= GROUP_DAYS * DAY);
    // (JP: a typo in one post's name. The same kind with the very same dates is the same event, `lang.sameDates`; the
    // later post's name wins.)
    const twin =
      !match &&
      f.start &&
      !f.parent &&
      lang.sameDates?.includes(f.kind) &&
      events.find((e) => !e.parent && e.kind === f.kind && e.start === f.start && e.end === f.end);
    if (match) {
      Object.assign(match, merge(match, f, lang));
      alias.set(f.id, match.id);
      merges.push({ from: f.id, into: match.id, how: f.start ? 'overlap' : f.phase === 'ended' ? 'ended' : 'undated' });
    } else if (twin) {
      Object.assign(twin, merge(twin, f, lang), { name: f.name });
      alias.set(f.id, twin.id);
      byKey.set(key, [...same, twin]);
      merges.push({ from: f.id, into: twin.id, how: 'same dates' });
    } else if (f.start) {
      events.push(f);
      byKey.set(key, [...same, f]);
    } else merges.push({ from: f.id, into: '', how: 'dropped' });
  }
  // An event announced without dates is the same-named one starting within SAME_EVENT_DAYS after the post (its own
  // "starts when posted" bar is dropped), else it stays (announced, not scheduled yet).
  const dropped = new Set<Fragment>();
  for (const f of events.filter((e) => e.undated)) {
    const days = lang.sameEventDays?.(f.kind) ?? SAME_EVENT_DAYS;
    const later = byKey
      .get(sameKey(f))
      ?.find(
        (e) => !e.undated && ms(e.start) >= Date.parse(f.posted) && ms(e.start) - Date.parse(f.posted) <= days * DAY
      );
    if (!later) continue;
    // One event, under the first post's id, with the dated post's dates.
    merges.push({ from: later.id, into: f.id, how: 'undated' });
    Object.assign(later, merge({ ...f, start: null }, later, lang), { id: f.id, start: later.start, end: later.end });
    alias.set(later.id, f.id);
    dropped.add(f);
  }
  events = events.filter((e) => !dropped.has(e));
  for (const e of events) {
    const parent = e.parent && alias.get(e.parent);
    if (parent) e.parent = parent;
  }
  // An event spans its parts (a celebration dated from its first section, a 3-day collab, runs as long as its login
  // bonus and gifts).
  // (lang.notSpanning: parts that don't stretch their event; JP: sales, a pack on sale for a year or more after it.)
  const parts = Map.groupBy(
    events.filter((e) => e.parent && !lang.notSpanning?.(e)),
    (e) => e.parent
  );
  for (const e of events) if (parts.has(e.id)) Object.assign(e, span([e, ...(parts.get(e.id) ?? [])]));
  for (const e of events) if (e.kind === 'champions_meeting') e.items = mergeItems(e.items, cmItems(cmTable, e.start));

  const byId = new Map(events.map((e) => [e.id, e]));
  return events
    .map((e) => (!e.image && e.parent ? { ...e, image: byId.get(e.parent)?.image ?? null } : e))
    .map((e) => output(e, banners))
    .sort((a, b) => b.start.date.localeCompare(a.start.date) || b.id.localeCompare(a.id));
}

export const readEvents = (server: Server = 'gl'): EventsFile =>
  existsSync(eventsFile(server)) ? JSON.parse(readFileSync(eventsFile(server), 'utf8')) : [];
export const readAnswers = (server: Server = 'gl'): AiAnswersFile =>
  existsSync(answersFile(server)) ? JSON.parse(readFileSync(answersFile(server), 'utf8')) : {};
// One answer per line, sorted by key, so commits diff per answer.
export function writeAnswers(answers: AiAnswersFile, server: Server = 'gl'): void {
  const keys = Object.keys(answers).sort();
  writeFileSync(
    answersFile(server),
    `{\n${keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(answers[k])}`).join(',\n')}\n}\n`
  );
}
export const readCmTable = (): CmRewardsFile =>
  existsSync(CM_REWARDS_FILE) ? JSON.parse(readFileSync(CM_REWARDS_FILE, 'utf8')) : [];

// One event per line, so commits diff per event (excluded from Biome, see biome.json).
const lines = (events: GameEvent[]): string => `[\n${events.map((e) => JSON.stringify(e)).join(',\n')}\n]\n`;
export const writeEvents = (events: GameEvent[], server: Server = 'gl'): void =>
  writeFileSync(eventsFile(server), lines(events));
