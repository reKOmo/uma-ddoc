import { en } from './en.ts';
import { ja } from './ja.ts';

export type PostLike = { announce_id: number; announce_label: number; message?: string };
// A post cut at its header art (event-blocks.ts' eventBlocks()): intro lines + headed sections.
export type Block = {
  art: string | null;
  artId: string | null;
  intro: string[];
  sections: { heading: string; lines: string[] }[];
};
// A `title.match(re)` that matched (its `input` is the title).
export type Match = RegExpMatchArray & { input: string };
// What `dateRef(posted)` gives the period parser: Global's the post's UTC year, JP's the post's time (ISO).
export type DateRef = number | string;
export type Period = { start: string | null; end: string | null };
export type BannerType = 'character' | 'support';
// A title rule: [title pattern, category, kind, name]: the first match wins. kind is a function of the post where it
// depends on it; name is a capture group's index or a function of the match.
export type Rule = [
  RegExp,
  'banner' | 'event' | 'other',
  string | ((post: PostLike) => string),
  (number | ((m: Match) => string | null))?,
];

// Every pattern and hook the news parsers (post-categories, banner-posts, event-blocks, event-rewards, events,
// jp-cards) read a post with. Required keys are what Global's English lexicon (en.ts) has; the optional ones are
// behaviour only JP's sets (JapaneseLexicon makes the ones jp-cards.ts needs required).
export type Lexicon = {
  server: 'gl' | 'jp';
  // The field of generated/cards.json' names and titles the posts use.
  cardLang: 'en' | 'jp';
  // Dates: parsePeriod(text, dateRef(posted)).
  parsePeriod: (text: string, ref: DateRef) => Period;
  dateRef: (posted: string) => DateRef;
  clean: (html: string) => string;
  // Posts that are never in-game news (post-categories).
  community: (post: PostLike) => boolean;
  // [title pattern, phase], the first match wins (post-categories).
  phases: [RegExp, string][];
  rules: Rule[];
  // An event's name when the title gives none.
  titleName: (title: string) => string;

  // A banner's art: split on (the capture keeps it), and its URL + gacha id.
  bannerArt: RegExp;
  bannerArtSrc: RegExp;
  // A featured card / trainee line: (rarity | stars), title, name.
  bannerCard: RegExp;
  bannerTrainee: RegExp;
  // The heading the art sits under → the banners' type.
  bannerType: (heading: string) => BannerType | null;
  // Period headings, and the scout period's among them.
  bannerPeriod: RegExp;
  scoutPeriod: RegExp;
  paidPost: RegExp;
  // JP: paid is per banner (gacha id → paid?): each banner gets `paid`.
  paidBanner?: (gachaId: number) => boolean;
  // JP: only a banner's first list after its art counts; listPlaceholder: lines that don't end it.
  firstList?: boolean;
  listPlaceholder?: RegExp;
  // JP: a period section may hold labelled windows: label → the banner type the window is for.
  periodLabel?: (label: string) => BannerType | null;
  // JP: the heading of a re-run's period (a scout re-held after an issue).
  rerunPeriod?: RegExp;
  // JP: a banner's own name (heading it sits under, the post's text, its type, the names used already).
  bannerName?: (heading: string, text: string, type: string | null, named: Set<string>) => string | null;
  // JP: a banner without a featured list gets `note`: the post's first line after its art.
  bannerNote?: boolean;

  // Header art starts a block (global flag); scout art doesn't; the art's id.
  blockArt: RegExp;
  notBlockArt: RegExp;
  artId: RegExp;
  // JP: the post's intro is a block of its own when text comes before the first art.
  introBlock?: boolean;

  numbers: Record<string, number>;
  // Same item, other spelling → the name we show (keyed by aliasKey(norm(name))).
  aliases: Record<string, string>;
  // An item's name: no leading amount, capitalised; what has no letter isn't one.
  itemAmountPrefix: RegExp;
  itemNameChar: RegExp;
  aliasKey: (key: string) => string;
  showItem: (name: string) => string;
  // JP: the Japanese name of an item shown by Global's name, or null.
  localName?: (raw: string, shown: string) => string | null;
  // JP: one line listing several items → one line per item.
  splitItems?: (line: string) => string[];
  // Prices, fees and purchases aren't rewards.
  notReward: RegExp;
  // Lines about cards that only boost an event, not ones it gives.
  notGiven: RegExp;
  // JP: a list of cards that aren't given: the bullets after such a line.
  notGivenList?: RegExp;
  // JP: a post may cut a card's title short.
  titlePrefix?: boolean;
  copies: RegExp;
  // "[Title] Name" (global flag)
  cardMention: RegExp;
  login: RegExp;
  dated: RegExp;
  item: RegExp;
  itemBullet: RegExp;
  // A list line that is a sentence isn't an item.
  sentenceEnd: RegExp;
  // A gift of carats told in prose.
  proseTotal: RegExp;
  proseAmount: RegExp;
  proseItem: RegExp;
  proseGift: RegExp;
  proseName: string;
  // "Main Rewards" bullets name rewards without amounts; so do "rewards like/including …" sentences.
  mainRewards: RegExp;
  bullet: RegExp;
  rewardsLike: RegExp;
  // Rewards worth naming even when the post gives no amount: [name | null (as the post names it), pattern].
  mentioned: [string | null, RegExp][];
  mentionedName: (s: string) => string;
  // Player titles; JP: placeholders that aren't titles.
  title: RegExp;
  titleList: RegExp;
  notTitle?: RegExp;
  // A mission set: a line "X Missions" (not a sentence) followed by its period.
  missionSet: (name: string) => boolean;
  missionBullet: RegExp;
  // JP (jp-cards.ts, never cardsIn()): a story event's own SSR, a card given on a line that says so
  // (newCardGiven, not notGiven); global flags.
  eventCard?: RegExp;
  giftCard?: RegExp;
  newCardGiven?: RegExp;

  amount: RegExp;
  amountWord: (word: string) => string;
  per: RegExp;
  copiesCount: RegExp;
  copiesTalk: RegExp;
  copiesNext: RegExp;

  // Headings that hold an event's own period, those that don't, and the main ones.
  period: RegExp;
  notOwn: RegExp;
  main: RegExp;
  // A "Gift Timing" list is moments, not periods: from the first to the last.
  timing: RegExp;
  // An opening sentence that gives a start, and whether a line is one.
  starts: RegExp;
  opening: (line: string) => boolean;
  // A period line: short, not fine print.
  periodLine: (line: string) => boolean;
  // A Champions Meeting's schedule headings: [phase key (CM_PHASES), heading].
  cmPhases: [string, RegExp][];
  // JP: other kinds' schedules (League of Heroes), by event kind.
  schedules?: Record<string, [string, RegExp][]>;
  // A celebration's sub-event: its opening sentence without its date, the names in it.
  subOpening: RegExp;
  subNames: RegExp[];
  // JP: picks among the names a sentence quotes.
  subName?: (sentence: string) => string | null;
  cleanName: (s: string) => string;
  notNameHeading: RegExp;
  // [kind, pattern] in order: a sub-event's name and opening sentence decide first, its headings only when they don't.
  subKinds: [string, RegExp][];
  // A block with gift/reward contents gives something (a sub-event even without a period).
  gives: RegExp;
  // The post's sentence about its mission sets' rewards.
  missionRewards: (line: string) => boolean;
  // JP: a gift without an end of its own runs until the deadline of who gets it (ISO, or null).
  deadline?: (block: Block, ref: DateRef) => string | null;
  // JP: a celebration's part that is no event of its own (a scout's, a summary, a feature): its role, else null.
  blockRole?: (block: Block) => string | null;
  // JP: copies one part of a celebration gives, from the post's summary of them (lines, the part's name).
  partCopies?: (lines: string[], part: string | null, card?: unknown) => number | null;
  // JP: a sub-event's name when its sentence has none.
  blockName?: (block: Block) => string | null;
  // JP: kinds whose events with the very same dates are one event (a typo in one post's name).
  sameDates?: string[];
  // JP: posts at the same stage about one event each give some of its windows: their dates add up.
  unionDates?: boolean;
  // JP: days within which a post announcing an event without dates joins the event (default 45).
  sameEventDays?: (kind: string) => number;
  // JP: parts that don't stretch their celebration.
  notSpanning?: (event: { kind: string }) => boolean;
};

// The Japanese lexicon: the JP-only hooks jp-cards.ts reads are always there.
export type JapaneseLexicon = Lexicon & Required<Pick<Lexicon, 'eventCard' | 'giftCard' | 'newCardGiven'>>;

export const LEXICONS: { gl: Lexicon; jp: JapaneseLexicon } = { gl: en, jp: ja };
export const lexicon = (server: 'gl' | 'jp' = 'gl'): Lexicon => {
  const lang = LEXICONS[server];
  if (!lang) throw new Error(`no news lexicon for ${server}`);
  return lang;
};
export { en, ja };
