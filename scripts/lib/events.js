// Global's in-game events, from the official news alone (data/news/posts.json), into data/global_events.json
// (committed, rebuilt from every post by `pnpm update-global`). Pure, except the reader/writer at the bottom.
//
// An event is one bar on the Timeline: everything in the news with dates of its own is one.
//   { id, kind, name, parent, start, end, cards, items, titles, news_url, image, source }
//   kind      story | champions_meeting | legend_race | transfer_requests | uma_outing | special | celebration |
//             campaign | gift | login_bonus | missions | shop | sale (EVENT_KINDS)
//   name      as the news names it, or null (Legend Races, Transfer Requests: the kind says it)
//   parent    the event it's part of (a celebration's sub-event, an event's mission set), else null
//   cards     support cards it gives [{ id, rarity, title, name, copies }] (scripts/lib/event-rewards.js), the main
//             thing; items [{ name, count }] everything else it gives (count: a number, { min, max } for a Champions
//             Meeting from the hand table, null when the post doesn't say); titles: player titles by name
//   phases    a Champions Meeting's schedule [{ key, start, end }]: league_selection, round_1, round_2,
//             final_registration, final_matching, final_race (CM_PHASES); other events have none
//   news_url  the post that announced it as running (else the first), image: its art (the Timeline's bar; a part
//             without art of its own shows its parent's)
//   source    'news'
//
// From posts to events (buildEvents):
//   1. Each event post (categorize(): category 'event'; "ending soon" reminders skipped) is cut into blocks at its
//      header art (eventBlocks()). A post about one event (story, Champions Meeting…) stays one event whatever
//      art it shows. A celebration post is several: its first block is the celebration itself, every later block
//      with dates of its own is a sub-event (kind and name from its opening sentence), and blocks without dates (a
//      new song, stamps) belong to the block before them. A celebration without dates of its own spans its
//      sub-events.
//   2. Every mission set an event lists ("Sprinters Stakes Missions" + its period) is a bar of its own under it
//      (missionBars()). Other dates inside an event (Champions Meeting rounds, reward collection, repeated windows)
//      stay in its bar.
//      An event spans its parts.
//   3. Posts about the same event ("coming soon", "is here", "has ended", league selection) are merged: same kind
//      and name, and overlapping dates (a post without dates joins the latest such event that started before it,
//      within GROUP_DAYS). Dates and links come from the most advanced post (running > announced); items take the
//      largest count any post gives (posts repeat lists); cards and titles are combined.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DATA_DIR } from './paths.js';
import { DAY, apiDate, newsUrl, parsePeriod } from './news-text.js';
import { blockLines, eventBlocks, joinBlocks } from './event-blocks.js';
import { cardIndex, cardsIn, copiesDoubt, itemDoubt, itemsIn, missionsIn, norm, titlesIn } from './event-rewards.js';
import { SUB_EVENT_KINDS, UNNAMED_KINDS, applyAnswer } from './event-questions.js';
import { categorize, plain } from './post-categories.js';

export const EVENTS_FILE = `${DATA_DIR}global_events.json`;
export const CM_REWARDS_FILE = `${DATA_DIR}champions_meeting_rewards.json`;
// A model's answers about what the rules doubted (scripts/ai-events.js), by event aiKey.
export const ANSWERS_FILE = `${DATA_DIR}news/ai_answers.json`;

export const EVENT_KINDS = [
  'story',
  'champions_meeting',
  'legend_race',
  'transfer_requests',
  'uma_outing',
  'special',
  'celebration',
  'campaign',
  'gift',
  'login_bonus',
  'missions',
  'shop',
  'sale',
];

const GROUP_DAYS = 14;
// An event announced without dates comes within this many days ("coming in early February", posted Jan 9; a cup's
// name comes back months later).
const SAME_EVENT_DAYS = 45;
// How far along a post is: dates from a later stage win.
const STAGE = { announced: 1, league_selection: 2, started: 3 };

// --- dates ---------------------------------------------------------------------------------------------------------

// Headings that hold an event's own period (not when rewards can be collected, gifts expire, a final round runs…).
const PERIOD = /period|timing/i;
const NOT_OWN = /reward collection|expiry|registration|matching|sneak peek|ranking|exchange/i;
// A Champions Meeting starts with its league selection (before the post's "Event Availability Period", round 1 on).
const MAIN = /availability period|event period|sale period|league selection period/i;
// "As of 10:00 p.m., Oct 7, 2026 (UTC), …", "From 3:00 p.m., Oct 8, 2026 (UTC), we're kicking off …",
// "… has begun as of 10:00 p.m., Jul 22, 2026 (UTC)!", "… is set to begin at 3:00 p.m., Jul 23, 2026 (UTC)!"
const STARTS = /\b(?:as of|from|starting)\b|^at\b|set to begin at|will begin at/i;

// A period line: short, not a bullet point (bullets in period sections are fine print with other dates).
const periodLine = (line) => line.length < 90 && !/^[•・*]/.test(line);

function span(dates) {
  const starts = dates.map((d) => d.start).filter(Boolean);
  if (!starts.length) return null;
  const ends = dates.map((d) => d.end).filter(Boolean);
  return { start: starts.sort()[0], end: ends.sort().at(-1) ?? null };
}

// A block's dates from its period headings (the main ones when it has any; a Champions Meeting's league selection
// counts), or null.
function headingPeriod(block, year) {
  const own = block.sections.filter((s) => PERIOD.test(s.heading) && !NOT_OWN.test(s.heading));
  // A "Gift Timing" list is moments, not periods: from the first to the last.
  const parse = (sections) =>
    span(
      sections.flatMap((s) => {
        const dates = s.lines.filter(periodLine).map((line) => parsePeriod(line, year));
        const moments = dates
          .map((d) => d.start)
          .filter(Boolean)
          .sort();
        return /timing/i.test(s.heading) && moments.length > 1 ? [{ start: moments[0], end: moments.at(-1) }] : dates;
      })
    );
  const main = own.filter((s) => MAIN.test(s.heading));
  return (main.length && parse(main)) || parse(own) || null;
}

// The start a block's opening sentences give ("As of 10:00 p.m., Oct 7, 2026 (UTC), …"), or null.
function openingPeriod(block, year) {
  const opening = block.intro.find((line) => STARTS.test(line) && /\(UTC\)/.test(line));
  return opening ? { start: parsePeriod(opening, year).start, end: null } : null;
}

// A Champions Meeting's schedule, from its post's phase headings: [{ key, start, end }] in order (CM_PHASES).
export const CM_PHASES = [
  ['league_selection', /^league selection period$/i],
  ['round_1', /^round 1$/i],
  ['round_2', /^round 2$/i],
  ['final_registration', /^final round: registration period$/i],
  ['final_matching', /^final round: matching period$/i],
  ['final_race', /^final round: race period$/i],
];
export function cmPhases(block, year) {
  return CM_PHASES.flatMap(([key, re]) => {
    const section = block.sections.find((s) => re.test(s.heading));
    const line = section?.lines.find((l) => periodLine(l) && parsePeriod(l, year).start);
    if (!line) return [];
    const { start, end } = parsePeriod(line, year);
    return [{ key, start, end }];
  });
}

// --- celebration sub-events ----------------------------------------------------------------------------------------

const capital = (s) => s.replace(/^./, (c) => c.toUpperCase());
const OPENING = /^(?:As of|From|At|Starting(?: from)?)\s.*?\(UTC\),\s*/i;
const NAMES = [
  /(?:Missions|event) "([^"]+)"/i,
  /available in the (.+?) under/i,
  /added to the (.+?)[!.](?:\s|$)/i,
  /kicking off an? (.+?)(?: event)?!/i,
  /sending (?:another |a )?(?:set of )?(.+?) gifts/i,
  /sent (a gift of .+?) to all/i,
  /gifted with the (.+?)!(?:\s|$)/i,
  /adding (bonus .+?) to/i,
  /^(?:the |an? )?(?!following|new items)(.+?)(?: event)? (?:has begun|have begun|is (?:now )?underway|is now live|(?:is|are) (?:now )?available|will appear|is set to begin)/i,
];

// The name in a sub-event's opening sentence ("the Sparkly Magic Show Holiday Present event is underway!" → "Sparkly
// Magic Show Holiday Present"), or null.
function sentenceName(block) {
  for (const line of block.intro) {
    const sentence = line.replace(OPENING, '');
    for (const re of NAMES) {
      const m = sentence.match(re);
      if (m) return capital(m[1].replace(/["“”]/g, '').trim());
    }
  }
  return null;
}

// A sub-event's name from its opening sentences, else its first heading that isn't a period, else null.
function subEventName(block) {
  const named = sentenceName(block);
  if (named) return named;
  const heading = block.sections.find((s) => !PERIOD.test(s.heading) && !/important|details|contents/i.test(s.heading));
  return heading ? heading.heading : null;
}

// [kind, pattern] in order; a sub-event's name and opening sentence decide first, its headings only when they don't.
const SUB_KINDS = [
  ['login_bonus', /login bonus/i],
  ['missions', /missions\b/i],
  ['sale', /sale period|sale details|discounted|paid carats/i],
  ['shop', /shop|exchange|daily sale/i],
  ['gift', /gift|present|giveaway/i],
];

// A sub-event's kind, or null when nothing in it says (it's then a campaign).
function matchedKind(name, block) {
  const opening = [name ?? '', block.intro[0] ?? ''].join(' ');
  const headings = block.sections.map((s) => s.heading).join(' ');
  for (const text of [opening, headings]) {
    const kind = SUB_KINDS.find(([, re]) => re.test(text))?.[0];
    if (kind) return kind;
  }
  return null;
}
const subEventKind = (name, block) => matchedKind(name, block) ?? 'campaign';
// (SUB_KINDS' kinds and 'campaign' are SUB_EVENT_KINDS, the kinds a model may answer.)
if (SUB_KINDS.some(([kind]) => !SUB_EVENT_KINDS.includes(kind))) throw new Error('SUB_KINDS outside SUB_EVENT_KINDS');

// --- doubts --------------------------------------------------------------------------------------------------------
// What the rules aren't sure of in an event, { field: why }: the fields a model is asked about (scripts/ai-events.js;
// its answers, data/news/ai_answers.json, fill them in at build time). Fields: items, cards (copies), name, kind,
// dates.

// FNV-1a: an event's text in a short key, so a stored answer is reused until the post changes.
const hash = (text) => {
  let h = 0x811c9dc5;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
  return h.toString(36);
};

function withDoubts(event, lines, more = {}) {
  const found = { items: itemDoubt(lines, event.items), cards: copiesDoubt(lines, event.cards), ...more };
  const doubts = Object.fromEntries(Object.entries(found).filter(([, why]) => why));
  const text = lines.join('\n');
  return { ...event, doubts, text, aiKey: `${event.id}:${hash(text)}` };
}

// Why an event's dates may be wrong, or null (`headed`: they come from period headings).
function datesDoubt(blocks, period, headed) {
  if (!period) return null;
  if (blocks.some((b) => b.sections.some((s) => /timing/i.test(s.heading)))) return 'dates from a list of moments';
  return headed ? null : 'dates from a sentence, not a period heading';
}

// --- posts → fragments ---------------------------------------------------------------------------------------------

function rewards(lines, index, year) {
  return {
    cards: cardsIn(lines, index),
    items: itemsIn(lines),
    titles: titlesIn(lines),
    missions: missionsIn(lines, year),
  };
}

// An event post as fragments: one per event it describes, before posts about the same event are merged.
export function postEvents(post, index = new Map()) {
  const c = categorize(post);
  if (c.category !== 'event' || c.phase === 'ending') return [];
  const posted = new Date(apiDate(post.post_at)).toISOString();
  const year = new Date(posted).getUTCFullYear();
  const title = plain(post.title).replace(/!$/, '');
  const base = { posted, phase: c.phase, news_url: newsUrl(c.id), source: 'news' };
  // "has ended" posts only confirm the event; their dates are the reward collection's.
  const dated = (period) => (c.phase === 'ended' ? null : period);
  const blocks = eventBlocks(post);

  if (c.kind !== 'celebration') {
    const whole = joinBlocks(blocks);
    const lines = blockLines(whole);
    const headed = headingPeriod(whole, year);
    const period = dated(headed ?? openingPeriod(whole, year));
    const event = {
      ...base,
      id: String(c.id),
      kind: c.kind,
      name: c.name ?? (UNNAMED_KINDS.includes(c.kind) ? null : title),
      parent: null,
      start: period?.start ?? (c.phase === 'ended' ? null : posted),
      // Announced without dates ("coming in late November"): joins the event when its dated post comes.
      undated: !period && c.phase !== 'ended',
      end: period?.end ?? null,
      image: post.image_big || blocks.find((b) => b.art)?.art || null,
      ...rewards(lines, index, year),
      ...(c.kind === 'champions_meeting' && c.phase !== 'ended' && { phases: cmPhases(whole, year) }),
    };
    return [
      withDoubts(event, lines, {
        dates:
          c.phase === 'ended'
            ? null
            : !period
              ? 'no dates found: it starts when posted'
              : datesDoubt(blocks, period, headed),
      }),
    ];
  }

  // A celebration: its first block, then a sub-event per later block with dates of its own.
  const groups = [];
  blocks.forEach((block, i) => {
    // A sub-event has a period heading or gift/reward contents of its own (a gift sent once has no period: it starts
    // when its sentence says, else when posted); a dated sentence alone ("a new song has been added as of …") is news
    // within the celebration.
    const gives = block.sections.some((s) => /gift contents|reward contents/i.test(s.heading));
    const headed = headingPeriod(block, year);
    const period = headed ?? (i > 0 && gives ? (openingPeriod(block, year) ?? { start: posted, end: null }) : null);
    if (i === 0 || period) groups.push({ i, first: block, blocks: [block], period, headed: !!headed });
    else groups.at(-1).blocks.push(block);
  });
  const id = String(c.id);
  const events = groups.map(({ i, first, blocks: own, period, headed }) => {
    const name = i === 0 ? c.name : subEventName(first);
    const lines = own.flatMap(blockLines);
    const event = {
      ...base,
      id: i === 0 ? id : `${id}-${i}`,
      kind: i === 0 ? 'celebration' : subEventKind(name, first),
      name: name ?? c.name,
      parent: i === 0 ? null : id,
      start: dated(period)?.start ?? null,
      end: dated(period)?.end ?? null,
      image: i === 0 ? post.image_big || first.art || null : first.art,
      ...rewards(lines, index, year),
    };
    const sub = i > 0;
    return withDoubts(event, lines, {
      name: sub && !sentenceName(first) && "the name is a heading or the celebration's, not from a sentence",
      kind: sub && !matchedKind(name, first) && 'nothing says what kind it is',
      dates: sub && c.phase !== 'ended' && datesDoubt(own, period, headed),
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
            ? [line, ...(/\bcop(?:y|ies)\b|\btimes\b/i.test(elsewhere[i + 1] ?? '') ? [elsewhere[i + 1]] : [])]
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
    const all = span(subs);
    overview.start = openingPeriod(blocks[0], year)?.start ?? all?.start ?? posted;
    overview.end = all?.end ?? null;
  }
  return events;
}

// Every mission set an event lists ("Sprinters Stakes Missions" + its period) is a bar of its own under it (kind
// missions, id `<event>-m<n>`).
function missionBars(f) {
  const { missions, ...event } = f;
  if (!event.start) return [event]; // an "ended" post: its sets are the event's, already listed
  // What a set gives is only named in the post's sentence about its missions ("By completing these missions, you can
  // earn rewards including carats, monies and Support Points!"); posts never give per-set amounts.
  const about = f.text.split('\n').filter((line) => /missions/i.test(line) && /rewards?/i.test(line));
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
        items: itemsIn(about),
        titles: [],
        image: null,
        doubts: {},
        aiKey: `${id}:${hash(`${set.name}\n${f.text}`)}`,
      };
    }),
  ];
}

// --- merging -------------------------------------------------------------------------------------------------------

const endOf = (e) => Date.parse(e.end ?? e.start) || Date.parse(e.start) + DAY;
const overlap = (a, b) => Date.parse(a.start) <= endOf(b) && Date.parse(b.start) <= endOf(a);
// Posts about the same event have the same kind and name.
const sameKey = (e) => `${e.kind}|${norm(e.name)}`;

function mergeItems(a, b) {
  const items = new Map(a.map((i) => [norm(i.name), i]));
  for (const item of b) {
    const old = items.get(norm(item.name));
    if (!old || (item.count != null && (old.count == null || item.count > old.count))) items.set(norm(item.name), item);
  }
  return [...items.values()];
}

function merge(event, next) {
  const later = (STAGE[next.phase] ?? 0) >= (STAGE[event.phase] ?? 0) && next.start;
  const cards = new Map(event.cards.map((card) => [card.id, card]));
  for (const card of next.cards)
    cards.set(card.id, { ...card, copies: Math.max(card.copies ?? 0, cards.get(card.id)?.copies ?? 0) || null });
  return {
    ...event,
    // A cup's schedule from the latest post that has one ("coming soon" posts give only rough starts).
    ...(next.phases?.length && { phases: next.phases }),
    ...(later && {
      start: next.start,
      end: next.end ?? event.end,
      phase: next.phase,
      news_url: next.news_url,
    }),
    image: event.image ?? next.image,
    cards: [...cards.values()],
    items: mergeItems(event.items, next.items),
    titles: [...new Set([...event.titles, ...next.titles])],
  };
}

// The Champions Meeting reward range for a cup starting at `start`: the newest table block whose `since` is on or
// before it, min/max per item over its rows (rows not filled in yet are skipped).
const CM_ITEMS = {
  carats: 'Carats',
  monies: 'Monies',
  ticket_support: 'Support Card Scout Tickets',
  ticket_trainee: 'Trainee Scout Tickets',
};
export function cmItems(table, start) {
  const block = table
    .filter((b) => b.since <= (start ?? '').slice(0, 10))
    .sort((a, b) => b.since.localeCompare(a.since))[0];
  if (!block) return [];
  return Object.entries(CM_ITEMS).flatMap(([key, name]) => {
    const values = block.final.map((row) => row[key]).filter((v) => typeof v === 'number');
    return values.length ? [{ name, count: { min: Math.min(...values), max: Math.max(...values) } }] : [];
  });
}

const FIELDS = ['id', 'kind', 'name', 'parent', 'start', 'end', 'cards', 'items', 'titles', 'phases'];
const output = (e) => ({
  ...Object.fromEntries(FIELDS.map((f) => [f, e[f]])),
  items: e.kind === 'sale' ? [] : e.items, // what a sale lists is bought, not given
  news_url: e.news_url ?? null,
  image: e.image ?? null,
  source: e.source,
});

// Every event fragment the news describes (one per event per post, mission sets included), with its doubts, text
// and aiKey, before posts about the same event are merged: what scripts/ai-events.js asks a model about.
export function eventFragments(posts, cards = {}) {
  const index = cardIndex(cards);
  return posts.flatMap((post) => postEvents(post, index)).flatMap(missionBars);
}

// Every event the news describes, newest first. `answers` (data/news/ai_answers.json) fill in the fields the rules
// doubted or left empty (applyAnswer()).
//   posts    data/news/posts.json's posts
//   cmTable  data/champions_meeting_rewards.json
//   cards    generated/cards.json (card ids by English title + name)
export function buildEvents(posts, { cmTable = [], cards = {}, answers = {} } = {}) {
  const fragments = eventFragments(posts, cards)
    .map((f) => (answers[f.aiKey] ? applyAnswer(f, answers[f.aiKey].answer) : f))
    .sort((a, b) => a.posted.localeCompare(b.posted) || a.id.localeCompare(b.id));
  let events = [];
  const byKey = new Map(); // sameKey → the events so far with it
  const alias = new Map(); // a merged fragment's id → its event's (sub-events point at their post's celebration)
  for (const f of fragments) {
    const key = sameKey(f);
    const same = byKey.get(key) ?? [];
    const match = f.start
      ? same.find((e) => overlap(e, f))
      : same
          .filter((e) => Date.parse(e.start) <= Date.parse(f.posted))
          .find((e) => Date.parse(f.posted) - endOf(e) <= GROUP_DAYS * DAY);
    if (match) {
      Object.assign(match, merge(match, f));
      alias.set(f.id, match.id);
    } else if (f.start) {
      events.push(f);
      byKey.set(key, [...same, f]);
    }
  }
  // An event announced without dates is the same-named one starting within SAME_EVENT_DAYS after the post (its own
  // "starts when posted" bar is dropped), else it stays (announced, not scheduled yet).
  const dropped = new Set();
  for (const f of events.filter((e) => e.undated)) {
    const later = byKey
      .get(sameKey(f))
      .find(
        (e) =>
          !e.undated &&
          Date.parse(e.start) >= Date.parse(f.posted) &&
          Date.parse(e.start) - Date.parse(f.posted) <= SAME_EVENT_DAYS * DAY
      );
    if (!later) continue;
    // One event, under the first post's id, with the dated post's dates.
    Object.assign(later, merge({ ...f, start: null }, later), { id: f.id, start: later.start, end: later.end });
    alias.set(later.id, f.id);
    dropped.add(f);
  }
  events = events.filter((e) => !dropped.has(e));
  for (const e of events) if (alias.has(e.parent)) e.parent = alias.get(e.parent);
  // An event spans its parts (a celebration dated from its first section, a 3-day collab, runs as long as its login
  // bonus and gifts).
  const parts = Map.groupBy(
    events.filter((e) => e.parent),
    (e) => e.parent
  );
  for (const e of events) if (parts.has(e.id)) Object.assign(e, span([e, ...parts.get(e.id)]));
  for (const e of events) if (e.kind === 'champions_meeting') e.items = mergeItems(e.items, cmItems(cmTable, e.start));

  // A sub-event without art of its own shows its celebration's.
  const byId = new Map(events.map((e) => [e.id, e]));
  return events
    .map((e) => (!e.image && e.parent ? { ...e, image: byId.get(e.parent)?.image ?? null } : e))
    .map(output)
    .sort((a, b) => b.start.localeCompare(a.start) || b.id.localeCompare(a.id));
}

// --- files ---------------------------------------------------------------------------------------------------------

export const readEvents = () => (existsSync(EVENTS_FILE) ? JSON.parse(readFileSync(EVENTS_FILE, 'utf8')) : []);
export const readAnswers = () => (existsSync(ANSWERS_FILE) ? JSON.parse(readFileSync(ANSWERS_FILE, 'utf8')) : {});
// One answer per line, sorted by key, so commits diff per answer.
export function writeAnswers(answers) {
  const keys = Object.keys(answers).sort();
  writeFileSync(
    ANSWERS_FILE,
    `{\n${keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(answers[k])}`).join(',\n')}\n}\n`
  );
}
export const readCmTable = () => (existsSync(CM_REWARDS_FILE) ? JSON.parse(readFileSync(CM_REWARDS_FILE, 'utf8')) : []);

// One event per line, so commits diff per event (excluded from Biome like the other data/global_*.json).
const lines = (events) => `[\n${events.map((e) => JSON.stringify(e)).join(',\n')}\n]\n`;
export const writeEvents = (events) => writeFileSync(EVENTS_FILE, lines(events));
