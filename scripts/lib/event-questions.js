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
//
// Per language (`lang`, the posts' lexicon from scripts/lib/news-lang/, English by default; QUESTIONS): the system
// prompt, each field's question and its worked examples, the kinds a sub-event can be, and how an answer is checked.
// JP posts are Japanese with times in JST and years mostly left out: the model gets the post date, answers dates in
// JST as the post writes them, and the code converts them to UTC with the year nearest the post (as parsePeriodJa()
// does); names stay as the text writes them (itemName() maps currencies to Global's names, the Japanese kept as
// `local`); copies are digits before 枚 / 回.

import { itemName, norm, numberWord } from './event-rewards.js';
import { DAY } from './news-text.js';
import { en } from './news-lang/en.js';

// Each question's version: bump one when its wording or examples change, so only stored answers to it are asked
// again (an answer stored with one `version` for every field, before these, counts as version 1 of each).
export const FIELD_VERSIONS = { items: 2, cards: 2, name: 1, kind: 1, dates: 1 };

// A stored answer's question versions per field.
const versionsOf = (stored) =>
  stored?.versions ?? (stored ? Object.fromEntries(Object.keys(FIELD_VERSIONS).map((f) => [f, 1])) : {});

// The asked fields whose stored answer (data/news/gl/ai_answers.json) is missing or for an older question.
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
export const UNNAMED_KINDS = ['legend_race', 'transfer_requests', 'league_of_heroes'];
// JP's sub-events can also be in-game events of their own (news-lang/ja.js subKinds).
const KINDS_JA = [...SUB_EVENT_KINDS, 'special'];
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

// (An example with a post date, [text, answer, posted]: JP's, whose dates leave the year out.)
const examplesFor = (fields, examples = EXAMPLES) =>
  fields.flatMap((f) =>
    examples[f].map(
      ([text, answer, posted]) =>
        `${posted ? `Posted: ${posted}\n` : ''}Text: ${JSON.stringify(text)}\nAnswer: ${JSON.stringify(answer)}`
    )
  );

// --- Japanese (JP's posts) -----------------------------------------------------------------------------------------

const SYSTEM_JA = [
  'You read official Japanese news posts of the game ウマ娘 プリティーダービー (Umamusume: Pretty Derby) and extract facts about one in-game event.',
  'Answer only from the text given. When the text does not say, answer null.',
  'Never guess, assume a default (like 1 copy) or work a value out from other events: null is better than a wrong answer.',
  'Times in the posts are Japan time (JST), like "9/30 12:00 ～ 10/13 11:59"; years are mostly left out (take them from the post date).',
  'Write names as the text writes them, in Japanese.',
  'Reply with one JSON object matching the schema, nothing else.',
].join(' ');

const FIELDS_JA = {
  items: {
    ask: [
      'items: every reward this event gives one player. For each:',
      '  name: the item as the text writes it, in Japanese, without 「」 or its amount (e.g. "ジュエル", "マニー", "サポートPt");',
      '  each: the amount given each time (each day, each login, each window, each episode), or the whole amount if it is given once;',
      '  times: how many times one player can get it (number of days, logins, windows or episodes), 1 if given once, null if the text does not say; when the text lists the days, windows or episodes, count the list (counting what is written is not guessing);',
      '  total: the total the text itself states ("最大3900個", "合計5640個"), else null.',
      '  Do not add amounts up yourself. Support cards and titles (称号) are not items, nor is anything bought or paid for (有償ジュエル, 購入, 販売).',
    ].join('\n'),
    schema: FIELDS.items.schema,
  },
  cards: {
    ask: (e) =>
      `cards: for each of these support cards, how many copies (枚) one player can get from THIS event itself (adding up its own parts): ${e.cards.map((c) => `「[${c.title}]${c.name}」`).join('、')}. title: the card's title, the part in [ ]. When the text gives copies for several events (「…ログインボーナス」で最大2枚、「…ミッション」で最大3枚), give only this event's share. copies is null if no number of copies is given for this event: naming the card is not "1".`,
    schema: FIELDS.cards.schema,
  },
  name: {
    ask: 'name: the event\'s own name as the text gives it, in Japanese, without 「」 and short (no "M/D H:MMから" part; null if the text only says what kind of event it is, like "レジェンドレース", or names none).',
    schema: FIELDS.name.schema,
  },
  kind: {
    ask: `kind: what this event is, one of ${KINDS_JA.join(', ')} (campaign: a limited-time bonus, e.g. free scouts, halved costs, extra rentals; special: an in-game event or race mode to take part in; gift: something sent to every player once).`,
    schema: { type: ['string', 'null'], enum: [...KINDS_JA, null] },
  },
  dates: {
    ask: 'start and end: when this event itself runs, as "YYYY-MM-DD HH:MM" in Japan time (JST), the time as the text writes it and the year from the post date (an event can run into the next year). If it has several windows, the start of the first and the end of the last. Not a deadline for starting the game (対象のトレーナー), qualifying or claiming rewards (受け取り期限, 報酬受け取り期間): a gift usually has no end, null. null if the text gives no day and time (a rough "9月下旬" is not one).',
    schema: null, // start + end
  },
};

// Made-up posts in the JP news' style (not real ones), [text, answer, posted?].
const CARD = '[ためしの一枚]サンプルウマ娘';
const EXAMPLES_JA = {
  items: [
    [
      '開催期間中にログインすると、1日1回ジュエル50個をプレゼントします！\n※最大10日間報酬を獲得できます。',
      { items: [{ name: 'ジュエル', each: 50, times: 10, total: null }] },
    ],
    [
      'ログイン1日目：ジュエル×100\nログイン2～6日目：サポートPt×500\nログイン7日目：目覚まし時計×3',
      {
        items: [
          { name: 'ジュエル', each: 100, times: 1, total: null },
          { name: 'サポートPt', each: 500, times: 5, total: null },
          { name: '目覚まし時計', each: 3, times: 1, total: null },
        ],
      },
    ],
    [
      '各期間中に1回、ジュエル100個をプレゼントします！\n第1弾\n1/5 12:00 ～ 1/12 4:59\n第2弾\n1/12 5:00 ～ 1/19 4:59\n第3弾\n1/19 5:00 ～ 1/26 4:59',
      { items: [{ name: 'ジュエル', each: 100, times: 3, total: null }] },
    ],
    [
      '毎日ログインするとマニー300をプレゼント！合計で最大3000マニーを獲得できます。',
      { items: [{ name: 'マニー', each: 300, times: null, total: 3000 }] },
    ],
    [
      'ミッションをクリアすることで「ジュエル」や「虹の結晶片」などの報酬を獲得できます！',
      {
        items: [
          { name: 'ジュエル', each: null, times: null, total: null },
          { name: '虹の結晶片', each: null, times: null, total: null },
        ],
      },
    ],
    ['期間中、有償ジュエル1200個で「お得なパック」を1回だけ購入できます！', { items: [] }],
  ],
  cards: [
    [
      `(プレゼント) SSRサポートカード「${CARD}」は、ログインボーナスで最大1枚、ミッションで最大2枚、合計3枚獲得できます！`,
      { cards: [{ title: 'ためしの一枚', copies: 3 }] },
    ],
    [
      `(ミッション) 期間限定ミッションをクリアすると、ジュエルやSSR「${CARD}」などの報酬を獲得できます！ / Elsewhere in the same post: 「${CARD}」は「記念ログインボーナス」で最大1枚、「記念ミッション」で最大4枚獲得できます。`,
      { cards: [{ title: 'ためしの一枚', copies: 4 }] },
    ],
    [
      `(ストーリーイベント) イベントPtを集めると、イベント限定SSRサポートカード「${CARD}」を獲得できます！`,
      { cards: [{ title: 'ためしの一枚', copies: null }] },
    ],
  ],
  name: [
    ['1/5 12:00から「冬のおでかけログインボーナス」を開催中です！', { name: '冬のおでかけログインボーナス' }],
    ['レジェンドレースが開催中です！レジェンドウマ娘に挑戦して報酬を獲得しよう！', { name: null }],
    ['本キャンペーンの開催を記念して、トレーナーの皆さまにプレゼントをお贈りいたします！', { name: null }],
  ],
  kind: [
    ['開催期間中は、育成開始時に消費するTPが半分になります！', { kind: 'campaign' }],
    ['期間限定ショップで、イベントコインを使って衣装やスタンプと交換できます！', { kind: 'shop' }],
    ['いつもプレイいただきありがとうございます。新しい機能をお楽しみください。', { kind: null }],
  ],
  dates: [
    ['開催期間\n12/26 12:00 ～ 1/9 4:59', { start: '2025-12-26 12:00', end: '2026-01-09 04:59' }, '2025-12-20'],
    [
      '開催期間\n第1弾\n2/1 12:00 ～ 2/8 4:59\n第2弾\n2/8 5:00 ～ 2/15 4:59',
      { start: '2026-02-01 12:00', end: '2026-02-15 04:59' },
      '2026-01-28',
    ],
    [
      '5/3 13:00に、トレーナーの皆さまにジュエル1000個をお贈りいたしました！\n対象のトレーナー\n6/3 23:59までにゲームを開始したトレーナーの皆さま\n受け取り期限\nプレゼントにお贈りしてから30日間です。',
      { start: '2026-05-03 13:00', end: null },
      '2026-05-03',
    ],
    [
      'チャンピオンズミーティングの開催が決定しました！\n開催予定時期\n9月下旬\n正式な開催時期は決まり次第お知らせいたします。',
      { start: null, end: null },
      '2026-08-10',
    ],
  ],
};

// --- per language --------------------------------------------------------------------------------------------------

// A name the text has (singular or plural: "150-carat gifts" has Carats).
const inText = (event, name) =>
  typeof name === 'string' && name.length <= 80 && norm(event.text).includes(norm(name).replace(/s$/, ''));
const valid = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s);
const isoOf = (s, event) => {
  if (!valid(s)) return null;
  const date = new Date(`${s.replace(' ', 'T')}:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.abs(date - Date.parse(event.posted)) < 200 * DAY ? date.toISOString() : null; // a year's slip is out
};

// JP: a JST time, in the year nearest the post (an end before the start: the next year), as ISO UTC.
const JST = 9 * 3600 * 1000;
const jst = (iso) => new Date(Date.parse(iso) + JST).toISOString().slice(0, 16).replace('T', ' ');
function isoOfJst(s, event, after) {
  if (!valid(s)) return null;
  const [mo, d, h, mi] = s.slice(5).split(/[- :]/).map(Number);
  const posted = Date.parse(event.posted);
  const at = (y) => Date.UTC(y, mo - 1, d, h, mi) - JST;
  const day = new Date(at(2000) + JST); // (2000: a leap year)
  if (h > 23 || mi > 59 || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return null;
  const ref = new Date(posted + JST).getUTCFullYear();
  let year = [ref - 1, ref + 1].reduce(
    (best, y) => (Math.abs(at(y) - posted) < Math.abs(at(best) - posted) ? y : best),
    ref
  );
  if (after && at(year) <= Date.parse(after)) year++;
  return Math.abs(at(year) - posted) < 200 * DAY ? new Date(at(year)).toISOString() : null;
}

// A kind's generic name ("A Legend Race", "Transfer Requests") isn't an event's name.
const GENERIC =
  /^(?:an? |the )?(?:new )?(?:legend race|transfer requests?|champions meeting|story event|event|login bonus|campaign|missions?|gift|celebration|sale|shop)s?$/i;
const GENERIC_JA =
  /^[「『]?(?:レジェンドレース|特別移籍|チャンピオンズミーティング|リーグ オブ ヒーローズ|ストーリーイベント|イベント|ログインボーナス|キャンペーン|ミッション|プレゼント|セール|ショップ)[」』]?$/;

const isMissionSet = (event) => /-m\d+$/.test(event.id);

// Per server (the lexicon's `server`): what's asked and how answers are checked.
const QUESTIONS = {
  gl: {
    system: SYSTEM,
    fields: FIELDS,
    examples: EXAMPLES,
    kinds: KINDS,
    // Kinds are a celebration's sub-events' (the others come from the post's title).
    kindAsked: (event) => KINDS.includes(event.kind),
    kindTaken: (event) => event.kind !== 'celebration',
    header: (event) => {
      const when = event.start
        ? `${event.start.slice(0, 16).replace('T', ' ')} to ${event.end?.slice(0, 16).replace('T', ' ') ?? '?'} UTC`
        : 'unknown dates';
      return [`Event: ${event.kind.replace('_', ' ')} "${event.name ?? '?'}" (${when}, as read so far).`];
    },
    // An item's name from an answer (as we show it, and as the post writes it), or null when it isn't one the text has.
    item: (event, raw) => {
      if (/\[|support card/i.test(raw)) return null;
      const shown = itemName(raw);
      return shown && inText(event, shown) ? { name: shown } : null;
    },
    copiesLine: /\bcop(?:y|ies)\b|\btimes\b/i,
    numberWord,
    generic: GENERIC,
    isoOf,
  },
  jp: {
    system: SYSTEM_JA,
    fields: FIELDS_JA,
    examples: EXAMPLES_JA,
    kinds: KINDS_JA,
    // (JP's top-level events can be `special` too: only a celebration's sub-events, not mission sets.)
    kindAsked: (event) => !!event.parent && !isMissionSet(event) && KINDS_JA.includes(event.kind),
    kindTaken: (event) => !!event.parent && !isMissionSet(event) && event.kind !== 'celebration',
    header: (event) => {
      const when = event.start ? `${jst(event.start)} to ${event.end ? jst(event.end) : '?'} JST` : 'unknown dates';
      return [
        `Event: ${event.kind.replace('_', ' ')} "${event.name ?? '?'}" (${when}, as read so far).`,
        `Posted: ${jst(event.posted).slice(0, 10)}`,
      ];
    },
    // ("「ジュエル」3000個" → ジュエル, shown as Carats with the Japanese kept as `local`; not what's bought or a title.)
    item: (event, raw, lang) => {
      if (/\[|サポートカード|support card/i.test(raw) || lang.notReward.test(raw)) return null;
      const written = lang.showItem(raw);
      const shown = itemName(written, lang);
      if (!shown || !(inText(event, written) || inText(event, shown))) return null;
      const local = lang.localName?.(written, shown);
      return local ? { name: shown, local } : { name: shown };
    },
    copiesLine: /枚|回/,
    numberWord: () => null,
    generic: GENERIC_JA,
    isoOf: isoOfJst,
  },
};
const questionsOf = (lang = en) => {
  const q = QUESTIONS[lang.server];
  if (!q) throw new Error(`no questions for ${lang.server}`);
  return q;
};

// Asked only where the post may hold an answer the rules couldn't read: an item named without an amount ("rewards
// like carats") or a Legend Race / Transfer Request without a name has none, so they aren't asked.
export function askedFields(event) {
  const empty = {
    cards: event.cards.some((c) => c.copies == null),
    name: !event.name && !UNNAMED_KINDS.includes(event.kind),
  };
  return Object.keys(FIELDS).filter((f) => f in event.doubts || empty[f]);
}

export function question(event, { all = false, fields: only, lang = en } = {}) {
  const q = questionsOf(lang);
  // Copies need cards; kinds are asked where a model may correct one.
  const askable = (f) => (f !== 'cards' || event.cards.length) && (f !== 'kind' || q.kindAsked(event));
  const fields = all ? Object.keys(q.fields).filter(askable) : (only ?? askedFields(event));
  const properties = {};
  for (const f of fields) {
    if (f === 'dates') Object.assign(properties, { start: DATE, end: DATE });
    else properties[f] = q.fields[f].schema;
  }
  const asks = fields.map((f) => (typeof q.fields[f].ask === 'function' ? q.fields[f].ask(event) : q.fields[f].ask));
  const user = [
    ...q.header(event),
    'Answer these:',
    ...asks.map((a) => `- ${a}`),
    '',
    'Examples from other posts (answer only about the post below):',
    ...examplesFor(fields, q.examples),
    '',
    'Post text:',
    event.text,
    ...(event.context?.length
      ? ['', "Elsewhere in the same post (about other events, for this event's share):", ...event.context]
      : []),
  ].join('\n');
  return {
    system: q.system,
    user,
    schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  };
}

// --- checking answers ----------------------------------------------------------------------------------------------

const count = (n, max) => Number.isInteger(n) && n > 0 && n <= max;

// A number of copies the post gives for a card: in a line that names the card or talks of copies / times, as a digit
// or a word ("up to three times"); a "1." list number elsewhere doesn't count. (JP: a digit, in a line naming the card
// or with 枚 / 回.)
function copiesGiven(event, card, n, q) {
  const lines = [...event.text.split('\n'), ...(event.context ?? [])];
  const said = new RegExp(`(^|[^\\d.\\w])${n}(?![\\d.\\w])|\\b${q.numberWord(n) ?? '\\0'}\\b`, 'i'); // not "1st"
  return lines.some((line) => (norm(line).includes(norm(card.title)) || q.copiesLine.test(line)) && said.test(line));
}

// An item's amount: the total the text states, else each × times.
const amountOf = (a) =>
  count(a.total, 10_000_000) ? a.total : count(a.each, 10_000_000) && count(a.times, 1000) ? a.each * a.times : null;

export function applyAnswer(event, raw, { trustModel = false, lang = en } = {}) {
  const q = questionsOf(lang);
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
    const amount = isMissionSet(event) ? null : amountOf(a);
    const item = card ? null : q.item(event, a.name, lang);
    if (card) {
      if (!cards.some((c) => typeof c?.title === 'string' && norm(c.title).includes(norm(card.title))))
        cards.push({ title: card.title, copies: amount });
    } else if (item) {
      // A number that doesn't check out drops the item; an amount the text leaves open (each, but not how many
      // times) lists it without one.
      const invalid = (n) => n != null && !count(n, 10_000_000);
      if (amount != null || !(invalid(a.each) || invalid(a.total) || invalid(a.times)))
        items.push({ ...item, count: amount });
    }
  }

  if (items.length) {
    // Both named by itemName(): the same item, singular or plural ("Alarm Clock" / "Alarm Clocks").
    const keyOf = (name) => norm(name).replace(/s$/, '');
    const byName = new Map(next.items.map((i) => [keyOf(i.name), i]));
    for (const a of items) {
      const key = keyOf(a.name);
      const old = byName.get(key);
      if (old ? take('items', old.count == null) && a.count != null : take('items', true)) {
        const local = old?.local ?? a.local;
        byName.set(key, { name: old?.name ?? a.name, count: a.count ?? old?.count ?? null, ...(local && { local }) });
      }
    }
    next.items = [...byName.values()];
  }
  if (cards.length)
    next.cards = next.cards.map((c) => {
      // Models write the title as they like ("SSR Support Card [U & Me] Mihono Bourbon", "Winning Dream Silence
      // Suzuka"): it matches a card whose title it contains.
      const a = cards.find((x) => typeof x?.title === 'string' && norm(x.title).includes(norm(c.title)));
      return a && count(a.copies, 20) && copiesGiven(event, c, a.copies, q) && take('cards', c.copies == null)
        ? { ...c, copies: a.copies }
        : c;
    });
  if (inText(event, answer.name) && !q.generic.test(answer.name.trim()) && take('name', !next.name))
    next.name = answer.name;
  if (q.kinds.includes(answer.kind) && q.kindTaken(event) && take('kind', false)) next.kind = answer.kind;
  const start = q.isoOf(answer.start, event);
  const end = q.isoOf(answer.end, event, start);
  if (start && (!end || start < end)) {
    if (take('dates', !next.start)) next.start = start;
    if (end && take('dates', !next.end)) next.end = end;
  }
  return next;
}
