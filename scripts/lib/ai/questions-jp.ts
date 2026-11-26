// JP's (Japanese) questions, as ai/questions-en.ts: Japanese prompts and examples, and JST dates converted to UTC.

import { itemName } from '../events/rewards.ts';
import { DAY, JST, minuteText, nearestYear } from '../news/text.ts';
import type { EventCard } from '../../../shared/schemas/event.ts';
import { FIELDS } from './questions-en.ts';
import {
  type AskedEvent,
  type Examples,
  type Field,
  type FieldSpec,
  type Questions,
  SCOUTS,
  SUB_EVENT_KINDS,
  inText,
  isMissionSet,
  shownName,
  valid,
} from './questions-spec.ts';

const SYSTEM_JP = [
  'You read official Japanese news posts of the game ウマ娘 プリティーダービー (Umamusume: Pretty Derby) and extract facts about one in-game event.',
  'Answer only from the text given. When the text does not say, answer null.',
  'Never guess, assume a default (like 1 copy) or work a value out from other events: null is better than a wrong answer.',
  'Times in the posts are Japan time (JST), like "9/30 12:00 ～ 10/13 11:59"; years are mostly left out (take them from the post date).',
  'Write names as the text writes them, in Japanese.',
  'Reply with one JSON object matching the schema, nothing else.',
].join(' ');

// JP's sub-events can also be in-game events of their own (news/lang/jp.ts' subKinds).
const KINDS_JP = [...SUB_EVENT_KINDS, 'special'];

const FIELDS_JP: Record<Field, FieldSpec> = {
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
    ask: (e: AskedEvent) =>
      `cards: for each of these support cards, how many copies (枚) one player can get from THIS event itself (adding up its own parts): ${e.cards.map((c: EventCard) => `「[${c.title}]${c.name}」`).join('、')}. title: the card's title, the part in [ ]. When the text gives copies for several events (「…ログインボーナス」で最大2枚、「…ミッション」で最大3枚), give only this event's share. copies is null if no number of copies is given for this event: naming the card is not "1".`,
    schema: FIELDS.cards.schema,
  },
  name: {
    ask: 'name: the event\'s own name as the text gives it, in Japanese, without 「」 and short (no "M/D H:MMから" part; null if the text only says what kind of event it is, like "レジェンドレース", or names none).',
    schema: FIELDS.name.schema,
  },
  kind: {
    ask: `kind: what this event is, one of ${KINDS_JP.join(', ')} (campaign: a limited-time bonus, e.g. free scouts, halved costs, extra rentals; special: an in-game event or race mode to take part in; gift: something sent to every player once).`,
    schema: { type: ['string', 'null'], enum: [...KINDS_JP, null] },
  },
  dates: {
    ask: 'start and end: when this event itself runs, as "YYYY-MM-DD HH:MM" in Japan time (JST), the time as the text writes it and the year from the post date (an event can run into the next year). If it has several windows, the start of the first and the end of the last. Not a deadline for starting the game (対象のトレーナー), qualifying or claiming rewards (受け取り期限, 報酬受け取り期間): a gift usually has no end, null. null if the text gives no day and time (a rough "9月下旬" is not one).',
    schema: null, // start + end
  },
  scouts: {
    ask: 'scouts: the daily free scout (無料で引ける[10回引く!] / [1回引く!]). windows: one per eligible scout (対象ガチャ), in order: scout: its name as the text writes it ("2nd Anniversary サポートカードガチャ"); start and end: when it is eligible, as "YYYY-MM-DD HH:MM" in JST, the year from the post date; days: the days the text states for that window ("（2日分）"), else null. Scouts listed under one shared period (開催期間) each get that period. total: the most free scouts in all the text states ("最大12回まで"), else null.',
    schema: SCOUTS,
  },
};

// Made-up posts in the JP news' style (not real ones), [text, answer, posted?].
const CARD = '[ためしの一枚]サンプルウマ娘';
const EXAMPLES_JP: Examples = {
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
  scouts: [
    [
      '期間中に毎日ログインすると、開催中のガチャの[10回引く!]を最大8回まで1日1回無料で引けます。\n開催期間\n1/5 12:00 ～ 1/13 4:59\n対象ガチャ\n・ためし サポートカードガチャ',
      {
        scouts: {
          windows: [
            { scout: 'ためし サポートカードガチャ', start: '2026-01-05 12:00', end: '2026-01-13 04:59', days: null },
          ],
          total: 8,
        },
      },
      '2026-01-05',
    ],
    [
      '開催中のガチャの[1回引く!]を1日1回無料で引けます。\n開催期間\n・ためし プリティーダービーガチャ\n2/1 12:00 ～ 2/3 4:59（2日分）',
      {
        scouts: {
          windows: [
            { scout: 'ためし プリティーダービーガチャ', start: '2026-02-01 12:00', end: '2026-02-03 04:59', days: 2 },
          ],
          total: null,
        },
      },
      '2026-01-30',
    ],
  ],
};

// JP posts are Japanese, with times in JST and years mostly left out: the model answers dates as the post writes them
// and the code converts them to UTC with the year nearest the post (as parsePeriodJp() does).
// JP: a JST time, in the year nearest the post (an end before the start: the next year), as ISO UTC.
const jst = (iso: string) => minuteText(new Date(Date.parse(iso) + JST).toISOString());
function isoOfJst(s: unknown, event: AskedEvent, after?: string | null): string | null {
  if (!valid(s)) return null;
  const [mo, d, h, mi] = s.slice(5).split(/[- :]/).map(Number);
  const posted = Date.parse(event.posted);
  const at = (y: number) => Date.UTC(y, mo - 1, d, h, mi) - JST;
  const day = new Date(at(2000) + JST); // (2000: a leap year)
  if (h > 23 || mi > 59 || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return null;
  let year = nearestYear(at, posted);
  if (after && at(year) <= Date.parse(after)) year++;
  return Math.abs(at(year) - posted) < 200 * DAY ? new Date(at(year)).toISOString() : null;
}

const GENERIC_JP =
  /^[「『]?(?:レジェンドレース|特別移籍|チャンピオンズミーティング|リーグ オブ ヒーローズ|ストーリーイベント|イベント|ログインボーナス|キャンペーン|ミッション|プレゼント|セール|ショップ)[」』]?$/;

export const questionsJp: Questions = {
  system: SYSTEM_JP,
  fields: FIELDS_JP,
  examples: EXAMPLES_JP,
  kinds: KINDS_JP,
  // (JP's top-level events can be `special` too: only a celebration's sub-events, not mission sets.)
  kindAsked: (event) => !!event.parent && !isMissionSet(event) && KINDS_JP.includes(event.kind),
  kindTaken: (event) => !!event.parent && !isMissionSet(event) && event.kind !== 'celebration',
  header: (event) => {
    const when = event.start ? `${jst(event.start)} to ${event.end ? jst(event.end) : '?'} JST` : 'unknown dates';
    return [
      `Event: ${event.kind.replace('_', ' ')} "${shownName(event)}" (${when}, as read so far).`,
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
  generic: GENERIC_JP,
  isoOf: isoOfJst,
};
