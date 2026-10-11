// Questions for a language model about the fields of an event the rules aren't sure of (its `doubts`, from
// scripts/lib/events.js) or left empty, and how its answers fill them in. Pure: scripts/ai-events.js asks,
// buildEvents() applies the stored answers.
//
// askedFields(event) → the fields to ask about: the doubted ones, plus empty ones (an item without an amount, a card
//   without copies, a Legend Race without a name).
// question(event, { all }) → { system, user, schema }: those fields (`all`: every field, for comparing a model with the
//   rules), with worked examples for each (EXAMPLES: made-up posts), about the event's own text. Amounts are asked in parts (each time × how many times, or a total the text
//   states): small models read numbers well but multiply badly, so the code does the arithmetic.
// applyAnswer(event, answer, { trustModel }) → the event with the answer's valid parts applied. Rules come first: a
//   doubted or empty field takes the model's answer, a value the rules are sure of is never touched (`trustModel`:
//   the answer wins wherever it's valid, for comparing a model with the rules).
//   An answer is used only if it checks out: item and event names that appear in the text (not a kind's generic name,
//   like "Legend Race"), whole amounts up to 10 million, copies of a card the rules found (1–20) that the post gives
//   (copiesGiven()), a known kind, dates
//   as "YYYY-MM-DD HH:MM" in order and within ~200 days of the post.

import { itemName, norm, numberWord } from './event-rewards.js';
import { DAY } from './news-text.js';

// Each question's version: bump one when its wording or examples change, so only stored answers to it are asked
// again (an answer stored with one `version` for every field, before these, counts as version 1 of each).
export const FIELD_VERSIONS = { items: 2, cards: 2, name: 1, kind: 1, dates: 1 };

// A stored answer's question versions per field.
const versionsOf = (stored) =>
  stored?.versions ?? (stored ? Object.fromEntries(Object.keys(FIELD_VERSIONS).map((f) => [f, 1])) : {});

// The asked fields whose stored answer (data/news/ai_answers.json) is missing or for an older question.
export function staleFields(event, stored) {
  const versions = versionsOf(stored);
  return askedFields(event).filter((f) => versions[f] !== FIELD_VERSIONS[f]);
}

// A stored answer with a newer answer about `fields` merged in.
export function mergeAnswer(stored, fields, answer, model) {
  const keys = (f) => (f === 'dates' ? ['start', 'end'] : [f]);
  const old = stored?.answer ?? {};
  return {
    model,
    at: new Date().toISOString(),
    versions: { ...versionsOf(stored), ...Object.fromEntries(fields.map((f) => [f, FIELD_VERSIONS[f]])) },
    answer: { ...old, ...Object.fromEntries(fields.flatMap(keys).map((k) => [k, answer[k] ?? null])) },
  };
}

const SYSTEM = [
  'You read official news posts of the game Umamusume: Pretty Derby and extract facts about one in-game event.',
  'Answer only from the text given. When the text does not say, answer null.',
  'Never guess, assume a default (like 1 copy) or work a value out from other events: null is better than a wrong answer.',
  'Times in the posts are UTC, like "10:00 p.m., Oct 7, 2026 (UTC)".',
  'Reply with one JSON object matching the schema, nothing else.',
].join(' ');

// A celebration's sub-event kinds (scripts/lib/events.js reads them from the post; a model may correct one).
export const SUB_EVENT_KINDS = ['login_bonus', 'missions', 'sale', 'shop', 'gift', 'campaign'];
const KINDS = SUB_EVENT_KINDS;
// Kinds whose posts never name the event (the kind says what it is).
export const UNNAMED_KINDS = ['legend_race', 'transfer_requests'];
const nullable = (type) => ({ type: [type, 'null'] });

const FIELDS = {
  items: {
    ask: [
      'items: every reward this event gives one player. For each:',
      '  name: the item as the text names it (e.g. "Carats", "Monies", "Support Points");',
      '  each: the amount given each time (each day, each login, each window), or the whole amount if it is given once;',
      '  times: how many times one player can get it (number of days, logins or windows), 1 if given once, null if the text does not say; when the text lists the days or windows, count the list (counting what is written is not guessing);',
      '  total: the total the text itself states ("up to a total of 5,640"), else null.',
      '  Do not add amounts up yourself. Support cards are not items.',
    ].join('\n'),
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          each: nullable('integer'),
          times: nullable('integer'),
          total: nullable('integer'),
        },
        required: ['name', 'each', 'times', 'total'],
        additionalProperties: false,
      },
    },
  },
  cards: {
    ask: (e) =>
      `cards: for each of these support cards, how many copies one player can get from THIS event itself (adding up its own parts): ${e.cards.map((c) => `[${c.title}] ${c.name}`).join('; ')}. When the text gives copies for several events ("up to two times in the Login Bonus and up to three times in the Missions"), give only this event's share. copies is null if no number of copies is given for this event: naming the card is not "1".`,
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, copies: nullable('integer') },
        required: ['title', 'copies'],
        additionalProperties: false,
      },
    },
  },
  name: {
    ask: 'name: the event\'s own name as the text gives it, short (no "As of …" clause; null if the text only says what kind of event it is, like "a Legend Race").',
    schema: nullable('string'),
  },
  kind: {
    ask: `kind: what this event is, one of ${KINDS.join(', ')} (campaign: a limited-time bonus, e.g. free scouts, halved costs, extra tickets).`,
    schema: { type: ['string', 'null'], enum: [...KINDS, null] },
  },
  dates: {
    ask: 'start and end: when this event itself runs, as "YYYY-MM-DD HH:MM" in UTC. If it has several windows, the start of the first and the end of the last. Not a deadline for starting the game, qualifying or claiming gifts (a gift usually has no end: null). null if the text does not say.',
    schema: null, // start + end
  },
};

const DATE = { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$' };

// Worked examples per field, from made-up posts in the news' style (not real ones, so the model learns the pattern,
// not answers): [text, the part of the answer it gives].
const EXAMPLES = {
  items: [
    [
      'Each day you log in during the event period, you will receive a gift of 50 carats! This login bonus can be received up to 10 times.',
      { items: [{ name: 'Carats', each: 50, times: 10, total: null }] },
    ],
    [
      'Login Day 1: Carats × 100\nLogin Days 2-6: Support Points × 500\nLogin Day 7: Alarm Clock × 3',
      {
        items: [
          { name: 'Carats', each: 100, times: 1, total: null },
          { name: 'Support Points', each: 500, times: 5, total: null },
          { name: 'Alarm Clock', each: 3, times: 1, total: null },
        ],
      },
    ],
    [
      'Receive a 100-carat gift once in each of these periods:\n10:00 p.m., Jan 5 - 2:59 p.m., Jan 12, 2026 (UTC)\n3:00 p.m., Jan 12 - 2:59 p.m., Jan 19, 2026 (UTC)\n3:00 p.m., Jan 19 - 2:59 p.m., Jan 26, 2026 (UTC)',
      { items: [{ name: 'Carats', each: 100, times: 3, total: null }] },
    ],
    [
      'Every day you log in you will receive a gift of 300 Monies, up to a total maximum of 3,000 Monies!',
      { items: [{ name: 'Monies', each: 300, times: null, total: 3000 }] },
    ],
    [
      'Complete these missions to earn rewards like carats and Rainbow Crystal Shards!',
      {
        items: [
          { name: 'Carats', each: null, times: null, total: null },
          { name: 'Rainbow Crystal Shards', each: null, times: null, total: null },
        ],
      },
    ],
  ],
  cards: [
    [
      '(a gift) The SSR Support Card [Example Title] Example Name can be obtained up to one time from the login bonus and up to two times from the missions, three times in all!',
      { cards: [{ title: 'Example Title', copies: 3 }] },
    ],
    [
      '(the missions) Clear the special missions to earn rewards like carats and SSR [Example Title] Example Name! / Elsewhere in the same post: It can be obtained once from the login bonus and up to four times from the special missions.',
      { cards: [{ title: 'Example Title', copies: 4 }] },
    ],
    [
      '(the missions) Clear the special missions to earn rewards like carats and SSR [Example Title] Example Name!',
      { cards: [{ title: 'Example Title', copies: null }] },
    ],
  ],
  name: [
    [
      'As of 10:00 p.m., Jan 5, 2026 (UTC), the Winter Festival Login Bonus has begun!',
      { name: 'Winter Festival Login Bonus' },
    ],
    ['A Legend Race is here! Challenge Legend Umamusume to obtain a variety of rewards.', { name: null }],
  ],
  kind: [
    ['During this event, the TP cost of starting a Career is halved!', { kind: 'campaign' }],
    ['New outfits and stamps can be bought with Event Coins in a limited-time store!', { kind: 'shop' }],
    ['Thank you for playing! We hope you enjoy the new features.', { kind: null }],
  ],
  dates: [
    [
      'Availability Period\n10:00 p.m., Jan 5 - 2:59 p.m., Jan 12, 2026 (UTC)',
      { start: '2026-01-05 22:00', end: '2026-01-12 14:59' },
    ],
    [
      "As of 4:00 a.m., May 3, 2026 (UTC), we've sent a gift of 1,000 carats to all trainers! All trainers who start the game before 11:59 p.m., Jun 3, 2026 (UTC) are eligible. Gifts expire 30 days after they are sent.",
      { start: '2026-05-03 04:00', end: null },
    ],
    ['A new campaign is coming soon! Details will be announced at a later date.', { start: null, end: null }],
  ],
};

const examplesFor = (fields) =>
  fields.flatMap((f) =>
    EXAMPLES[f].map(([text, answer]) => `Text: ${JSON.stringify(text)}\nAnswer: ${JSON.stringify(answer)}`)
  );

// Asked only where the post may hold an answer the rules couldn't read: an item named without an amount ("rewards
// like carats") or a Legend Race / Transfer Request without a name has none, so they aren't asked.
export function askedFields(event) {
  const empty = {
    cards: event.cards.some((c) => c.copies == null),
    name: !event.name && !UNNAMED_KINDS.includes(event.kind),
  };
  return Object.keys(FIELDS).filter((f) => f in event.doubts || empty[f]);
}

export function question(event, { all = false, fields: only } = {}) {
  // Kinds are a celebration's sub-events' (the others come from the post's title); copies need cards.
  const askable = (f) => (f !== 'cards' || event.cards.length) && (f !== 'kind' || KINDS.includes(event.kind));
  const fields = all ? Object.keys(FIELDS).filter(askable) : (only ?? askedFields(event));
  const properties = {};
  for (const f of fields) {
    if (f === 'dates') Object.assign(properties, { start: DATE, end: DATE });
    else properties[f] = FIELDS[f].schema;
  }
  const asks = fields.map((f) => (typeof FIELDS[f].ask === 'function' ? FIELDS[f].ask(event) : FIELDS[f].ask));
  const when = event.start
    ? `${event.start.slice(0, 16).replace('T', ' ')} to ${event.end?.slice(0, 16).replace('T', ' ') ?? '?'} UTC`
    : 'unknown dates';
  const user = [
    `Event: ${event.kind.replace('_', ' ')} "${event.name ?? '?'}" (${when}, as read so far).`,
    'Answer these:',
    ...asks.map((a) => `- ${a}`),
    '',
    'Examples from other posts (answer only about the post below):',
    ...examplesFor(fields),
    '',
    'Post text:',
    event.text,
    ...(event.context?.length
      ? ['', "Elsewhere in the same post (about other events, for this event's share):", ...event.context]
      : []),
  ].join('\n');
  return {
    system: SYSTEM,
    user,
    schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  };
}

// --- checking answers ----------------------------------------------------------------------------------------------

// A name the text has (singular or plural: "150-carat gifts" has Carats).
const inText = (event, name) =>
  typeof name === 'string' && name.length <= 80 && norm(event.text).includes(norm(name).replace(/s$/, ''));
const count = (n, max) => Number.isInteger(n) && n > 0 && n <= max;
const isoOf = (s, event) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return null;
  const date = new Date(`${s.replace(' ', 'T')}:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.abs(date - Date.parse(event.posted)) < 200 * DAY ? date.toISOString() : null; // a year's slip is out
};

// A kind's generic name ("A Legend Race", "Transfer Requests") isn't an event's name.
const GENERIC =
  /^(?:an? |the )?(?:new )?(?:legend race|transfer requests?|champions meeting|story event|event|login bonus|campaign|missions?|gift|celebration|sale|shop)s?$/i;

// A number of copies the post gives for a card: in a line that names the card or talks of copies / times, as a digit
// or a word ("up to three times"); a "1." list number elsewhere doesn't count.
function copiesGiven(event, card, n) {
  const lines = [...event.text.split('\n'), ...(event.context ?? [])];
  const said = new RegExp(`(^|[^\\d.\\w])${n}(?![\\d.\\w])|\\b${numberWord(n) ?? '\\0'}\\b`, 'i'); // not "1st"
  return lines.some(
    (line) => (norm(line).includes(norm(card.title)) || /\bcop(?:y|ies)\b|\btimes\b/i.test(line)) && said.test(line)
  );
}

// An item's amount: the total the text states, else each × times.
const amountOf = (a) =>
  count(a.total, 10_000_000) ? a.total : count(a.each, 10_000_000) && count(a.times, 1000) ? a.each * a.times : null;

export function applyAnswer(event, raw, { trustModel = false } = {}) {
  const answer = raw ?? {};
  const take = (field, empty) => trustModel || field in event.doubts || empty;
  const next = { ...event };

  // Small models put card copies among the items ("SSR Support Card [U & Me] Mihono Bourbon"): an item naming one of
  // the event's cards is its copies.
  const cardOf = (name) => event.cards.find((c) => norm(name).includes(norm(c.title)));
  const cards = [...(Array.isArray(answer.cards) ? answer.cards : [])];
  const items = [];
  for (const a of Array.isArray(answer.items) ? answer.items : []) {
    if (typeof a?.name !== 'string') continue;
    const card = cardOf(a.name);
    // A mission set (<event>-m<n>) takes names only: its post's amounts are other things'.
    const amount = /-m\d+$/.test(event.id) ? null : amountOf(a);
    if (card) {
      if (!cards.some((c) => typeof c?.title === 'string' && norm(c.title).includes(norm(card.title))))
        cards.push({ title: card.title, copies: amount });
    } else if (!/\[|support card/i.test(a.name) && itemName(a.name) && inText(event, itemName(a.name))) {
      // A number that doesn't check out drops the item; an amount the text leaves open (each, but not how many
      // times) lists it without one.
      const invalid = (n) => n != null && !count(n, 10_000_000);
      if (amount != null || !(invalid(a.each) || invalid(a.total) || invalid(a.times)))
        items.push({ name: itemName(a.name), count: amount });
    }
  }

  if (items.length) {
    // Both named by itemName(): the same item, singular or plural ("Alarm Clock" / "Alarm Clocks").
    const keyOf = (name) => norm(name).replace(/s$/, '');
    const byName = new Map(next.items.map((i) => [keyOf(i.name), i]));
    for (const a of items) {
      const key = keyOf(a.name);
      const old = byName.get(key);
      if (old ? take('items', old.count == null) && a.count != null : take('items', true))
        byName.set(key, { name: old?.name ?? a.name, count: a.count ?? old?.count ?? null });
    }
    next.items = [...byName.values()];
  }
  if (cards.length)
    next.cards = next.cards.map((c) => {
      // Models write the title as they like ("SSR Support Card [U & Me] Mihono Bourbon", "Winning Dream Silence
      // Suzuka"): it matches a card whose title it contains.
      const a = cards.find((x) => typeof x?.title === 'string' && norm(x.title).includes(norm(c.title)));
      return a && count(a.copies, 20) && copiesGiven(event, c, a.copies) && take('cards', c.copies == null)
        ? { ...c, copies: a.copies }
        : c;
    });
  if (inText(event, answer.name) && !GENERIC.test(answer.name.trim()) && take('name', !next.name))
    next.name = answer.name;
  if (KINDS.includes(answer.kind) && event.kind !== 'celebration' && take('kind', false)) next.kind = answer.kind;
  const [start, end] = [isoOf(answer.start, event), isoOf(answer.end, event)];
  if (start && (!end || start < end)) {
    if (take('dates', !next.start)) next.start = start;
    if (end && take('dates', !next.end)) next.end = end;
  }
  return next;
}
