// A celebration post as fragments: the celebration itself, then a sub-event per later block with dates of its own.

import type { Block, DateRef, Lexicon } from '../news/lang/index.ts';
import type { NewsPost, PostCategory } from '../../../shared/schemas/news.ts';
import { blockLines, eventBlocks, joinBlocks } from './blocks.ts';
import { type Dates, datesDoubt, headingPeriod, openingPeriod, span } from './dates.ts';
import { aiKey, type Fragment, rewards, withDoubts } from './doubts.ts';
import { matchedKind, sentenceName, subEventKind, subEventName } from './names.ts';
import type { cardIndex } from './rewards.ts';
import { norm } from '../news/text.ts';

// What every event of a post is built from (postEvents()).
export type PostContext = {
  post: NewsPost;
  lang: Lexicon;
  index: ReturnType<typeof cardIndex>;
  names: Map<string, string>;
  id: string;
  name: string | null;
  ended: boolean;
  posted: string;
  year: DateRef;
  base: Pick<Fragment, 'posted' | 'phase' | 'news_url' | 'source'>;
  blocks: Block[];
  // "has ended" posts only confirm the event; their dates are the reward collection's.
  unlessEnded: (period: Dates | null) => Dates | null;
  // (JP: a gift without an end of its own runs until the deadline of who gets it, `lang.deadline`.)
  withEnd: (period: Dates | null, block: Block) => Dates | null;
};

// part: the sub-event's id suffix, null for the celebration itself.
// (kind: the classified unit's, ml/categorize.py; else the rules decide it.)
type Group = {
  part: string | null;
  head: Block;
  blocks: Block[];
  period: Dates | null;
  headed: boolean;
  kind?: string | null;
};

// The celebration's first block, then a sub-event per later block with dates of its own. (JP: a block can be no part at
// all, `lang.blockRole`: a scout's, or a summary of what other parts give.) A first block that goes on to open an
// included event ("As of …, Part 2 of the … Login Bonus has begun!", "The in-game collaboration event …, Sparkly Magic
// Show, is set to kick off at …") gives that event its period and contents: a sub-event of its own (id -0).
export function celebrationEvents(ctx: PostContext, classified?: PostCategory): Fragment[] {
  const { post, lang, blocks } = ctx;
  // Classified: the post cut into units as the gold set is (the intro a unit of its own), each unit's role
  // deciding: the celebration's own text, a part of its kind, more of the group before, or left out.
  const units = classified?.units.length ? eventBlocks(post, { ...lang, introBlock: true }) : [];
  const groups =
    classified && units.length === classified.units.length
      ? groupsFromUnits(ctx, classified, units)
      : groupsFromRules(ctx);
  const postLines = lang.partCopies ? blocks.flatMap(blockLines) : [];
  const events = withCardContext(
    groups.map((group) => groupFragment(ctx, group, postLines)),
    groups,
    lang
  );
  spanOverview(ctx, events);
  return events;
}

function groupsFromUnits(
  { lang, year, posted, withEnd }: PostContext,
  classified: PostCategory,
  units: Block[]
): Group[] {
  const groups: Group[] = [];
  units.forEach((block, n) => {
    const { role, kind } = classified.units[n];
    if (role === 'none') return;
    if (role === 'part') {
      const headed = headingPeriod(block, year, lang);
      const period = withEnd(headed ?? openingPeriod(block, year, lang) ?? { start: posted, end: null }, block);
      groups.push({ part: String(n), head: block, blocks: [block], period, headed: !!headed, kind });
    } else if (role === 'continues' && groups.length) groups.at(-1)?.blocks.push(block);
    else if (groups[0]?.part === null) groups[0].blocks.push(block);
    else groups.unshift({ part: null, head: block, blocks: [block], period: null, headed: false });
  });
  if (groups[0]?.part !== null) groups.unshift({ part: null, head: units[0], blocks: [], period: null, headed: false });
  // (Its own period: a heading of its own text, never a part's.)
  const ownPeriod = groups[0].blocks.length ? headingPeriod(joinBlocks(groups[0].blocks), year, lang) : null;
  Object.assign(groups[0], { period: withEnd(ownPeriod, groups[0].head), headed: !!ownPeriod });
  return groups;
}

function groupsFromRules(ctx: PostContext): Group[] {
  const { lang, year, blocks, withEnd } = ctx;
  const [first, ...rest] = blocks;
  const opening = splitOpening(first, year, lang);
  const parts = [...opening.parts, ...rest.map((block, n): [string, Block] => [String(n + 1), block])];
  const groups: Group[] = [];
  for (const [part, block] of parts) {
    if (part !== null && lang.blockRole?.(block)) continue;
    const headed = headingPeriod(block, year, lang);
    const period = withEnd(headed ?? partPeriod(ctx, part, block, opening.opensInIntro), block);
    if (part === null || period) groups.push({ part, head: block, blocks: [block], period, headed: !!headed });
    else groups.at(-1)?.blocks.push(block);
  }
  return groups;
}

// A sub-event has a period heading or gift/reward contents of its own (a gift sent once has no period: it starts when
// its sentence says, else when posted); a dated sentence alone ("a new song has been added as of …") is news within
// the celebration.
function partPeriod({ lang, year, posted }: PostContext, part: string | null, block: Block, opensInIntro: boolean) {
  if (part === null) return opensInIntro ? openingPeriod(block, year, lang) : null;
  if (!block.sections.some((s) => lang.gives.test(s.heading))) return null;
  return openingPeriod(block, year, lang) ?? { start: posted, end: null };
}

// The celebration's first block as [part, block]s: itself, or itself cut where it goes on to open an included event
// (that one part '0'). `opensInIntro`: it opens it in its intro, so the celebration's own period is the opening
// sentence's.
function splitOpening(
  first: Block | undefined,
  year: DateRef,
  lang: Lexicon
): { parts: [string | null, Block][]; opensInIntro: boolean } {
  if (!first) return { parts: [], opensInIntro: false };
  // (Only when the block's period is that event's: it starts with the later sentence, not the celebration's.)
  const startOf = (line: string | undefined) =>
    line && lang.starts.test(line) && lang.opening(line) ? lang.parsePeriod(line, year).start : null;
  const firstPeriod = headingPeriod(first, year, lang);
  // (Starting with the celebration, only a sentence naming an event of its own: 653's "As of …, an Increased Bond
  // Points event is underway!" after "As of …, our White Day Celebration has begun!", at the same time.)
  const opensOwn = (line: string) =>
    startOf(line) === firstPeriod?.start &&
    !lang.contentSentence?.test(line) &&
    sentenceName({ ...first, intro: [line] }, lang) !== null;
  const opens =
    firstPeriod?.start && startOf(first.intro[0])
      ? first.intro.findIndex(
          (line, n) =>
            n > 0 &&
            startOf(line) === firstPeriod.start &&
            (startOf(first.intro[0]) !== firstPeriod.start || opensOwn(line))
        )
      : -1;
  if (opens > 0)
    return {
      parts: [
        [null, { ...first, intro: first.intro.slice(0, opens), sections: [] }],
        ['0', { ...first, art: null, artId: null, intro: first.intro.slice(opens) }],
      ],
      opensInIntro: true,
    };
  // (Or its first section goes on to: 1155's "Event Details: See below … / As of …, the Unity Cup Halved TP Costs event
  // has begun!" over the Halved TP Costs' own period.)
  const firstSectionLines = first.sections[0]?.lines ?? [];
  const opensIn = firstSectionLines.findIndex(opensOwn);
  if (opensIn >= 0)
    return {
      parts: [
        [null, { ...first, sections: [] }],
        [
          '0',
          {
            ...first,
            art: null,
            artId: null,
            intro: firstSectionLines.slice(opensIn),
            sections: first.sections.slice(1),
          },
        ],
      ],
      opensInIntro: false,
    };
  return { parts: [[null, first]], opensInIntro: false };
}

function groupFragment(
  ctx: PostContext,
  { part, head, blocks: groupBlocks, period, headed, kind: partKind }: Group,
  postLines: string[]
): Fragment {
  const { post, lang, index, year, id, base, ended, unlessEnded } = ctx;
  const sub = part !== null;
  const inGame = sub ? head.intro[0]?.match(lang.inGameEvent ?? /$^/) : null;
  const name = sub ? (inGame?.[1] ?? subEventName(head, lang)) : ctx.name;
  const groupLines = groupBlocks.flatMap(blockLines);
  const { fields, scoutsDoubt } = rewards(groupLines, index, year, lang);
  const event = {
    ...base,
    id: sub ? `${id}-${part}` : id,
    // (An in-game event's sentence is unmistakable, more so than the unit model's kind.)
    kind: !sub ? 'celebration' : inGame ? 'special' : (partKind ?? subEventKind(name, head, lang)),
    name: name ?? ctx.name,
    parent: sub ? id : null,
    start: unlessEnded(period)?.start ?? null,
    end: unlessEnded(period)?.end ?? null,
    // (A classified celebration's head can be the post's intro, which has no art: the post's first art is its.)
    image: sub ? head.art : post.image_big || head.art || ctx.blocks.find((b) => b.art)?.art || null,
    ...fields,
  };
  // (JP: copies of a card given in several parts are often counted per part elsewhere in the post: "「…ログインボーナス」
  // で最大2枚、「…ミッション第2弾」で最大3枚".)
  if (lang.partCopies && sub)
    event.cards = event.cards.map((card) =>
      card.copies == null ? { ...card, copies: lang.partCopies?.(postLines, event.name, card) ?? null } : card
    );
  return withDoubts(event, groupLines, lang, {
    name:
      sub && !inGame && !sentenceName(head, lang) && "the name is a heading or the celebration's, not from a sentence",
    kind: sub && !partKind && !inGame && !matchedKind(name, head, lang) && 'nothing says what kind it is',
    dates: sub && !ended && datesDoubt(groupBlocks, period, headed, lang),
    scouts: scoutsDoubt,
  });
}

// Lines elsewhere in the post about an event's cards ("up to three times in the Missions" in the gift's section):
// the model sees them to give this event's share (scripts/lib/ai/questions.ts).
function withCardContext(events: Fragment[], groups: Group[], lang: Lexicon): Fragment[] {
  return events.map((event, n) => {
    if (!event.cards.length) return event;
    const titles = event.cards.map((card) => norm(card.title));
    const elsewhere = groups.filter((_, g) => g !== n).flatMap((g) => g.blocks.flatMap(blockLines));
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
    return context.length
      ? { ...event, context, aiKey: aiKey(event.id, `${event.text}\n${context.join('\n')}`) }
      : event;
  });
}

// A celebration without a period of its own: from its opening sentence (else its first sub-event) to its last
// sub-event's end.
function spanOverview({ lang, year, posted, blocks, ended }: PostContext, events: Fragment[]): void {
  const [overview, ...subs] = events;
  if (overview.start || ended) return;
  const all = span(subs.filter((e) => !lang.notSpanning?.(e)));
  overview.start = openingPeriod(blocks[0], year, lang)?.start ?? all?.start ?? posted;
  overview.end = all?.end ?? null;
}
