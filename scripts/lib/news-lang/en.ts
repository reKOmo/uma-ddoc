// The English news' wording (Global, umamusume.com): every pattern the news parsers read a post with. The parsers
// (post-categories.js, banner-posts.js, event-blocks.js, event-rewards.js, events.js) are shared by both servers and
// take a lexicon like this one (news-lang/index.js: one per server). Keep the wording here and the structure there.

import { parsePeriod } from '../news-text.ts';
import type { Lexicon } from './index.ts';

// --- titles (post-categories.js) ----------------------------------------------------------------------------------

const PHASE_WORDS =
  /\s*(?:is here|are here|is coming.*|coming soon|(?:is )?now (?:available|underway)|out now|has begun|has ended|ending soon|added)!?$/i;

// A celebration's or campaign's name: the title without its phase, a leading "A special" or tagline ("Up to 100 free scouts! …"),
// a trailing "event" or "!".
const campaignName = (title: string) =>
  title
    .replace(PHASE_WORDS, '')
    .replace(/^.*!\s+(?=\S)/, '')
    .replace(/^(?:An?|The) (?:special )?/i, '')
    .replace(/\s+event$|!$/i, '')
    .replace(/^"(.*)"$/, '$1');

export const en: Lexicon = {
  server: 'gl',
  // The field of generated/cards.json' names and titles the posts use.
  cardLang: 'en',
  // Dates: parsePeriod(text, dateRef(posted)) (the post's UTC year fills a missing one).
  // (dateRef gives a year here; Number() only tells the type checker.)
  parsePeriod: (text, ref) => parsePeriod(text, Number(ref)),
  dateRef: (posted) => new Date(posted).getUTCFullYear(),
  // A post's HTML before any parser reads it (nothing to fix in English posts).
  clean: (html) => html,

  // Posts that are never in-game news: the community id series (200001…: X giveaways, letters, guidelines).
  community: (post) => Number(post.announce_id) > 200000,

  phases: [
    [/league selection period/i, 'league_selection'],
    [/coming soon|is coming/i, 'announced'],
    [/ending soon/i, 'ending'],
    [/has ended/i, 'ended'],
    [/is here|are here|now available|out now|has begun|available!|underway/i, 'started'],
  ],

  // [title pattern, category, kind, name]: the first match wins. name is a capture group's index or a function of the
  // match.
  rules: [
    [/^Check out all the latest updates/i, 'other', 'roundup'],
    [/^Main Story|Uncaps?\b|^Changes to/i, 'other', 'update'],
    [/\bissues?\b|Error Code/i, 'other', 'issue'],
    [/Champions Meeting: (.+? Cup)/i, 'event', 'champions_meeting', 1],
    [/story event "?(.+?)"? (?:is here|is coming|has ended)/i, 'event', 'story', 1],
    [/Legend Race/i, 'event', 'legend_race'],
    [/Transfer Requests/i, 'event', 'transfer_requests'],
    [/Uma Outing/i, 'event', 'uma_outing', () => 'Uma Outing'],
    [/^The event "?(.+?)"? (?:is here|is coming|has ended)/i, 'event', 'special', 1],
    [/^An? (.+?) event (?:is here|is coming)/i, 'event', 'special', 1],
    [/Showtime/i, 'event', 'special', (m) => campaignName(m.input)],
    [/new Career scenario "(.+?)"/i, 'other', 'scenario', 1],
    [/WebStore|Starter Packs/i, 'other', 'sale'],
    [/Gift to Celebrate|Release Celebration Event|song present|outfits!$/i, 'event', 'gift'],
    [/Giveaway|present\b|Giving Thanks|Free .*Crystals|\bGift$/i, 'event', 'gift', (m) => campaignName(m.input)],
    [/login bonus/i, 'event', 'login_bonus', (m) => campaignName(m.input)],
    [/missions\b/i, 'event', 'missions', (m) => m.input.match(/"([^"]+)"/)?.[1] ?? campaignName(m.input)],
    [/Celebration/i, 'event', 'celebration', (m) => campaignName(m.input)],
    [
      /Bonus Star Piece|Daily Race (?:Tickets|attempts)|Free 10[x-] ?Scout|Free Retries|Commemoration/i,
      'event',
      'campaign',
      (m) => campaignName(m.input),
    ],
    [/Maintenance/i, 'other', 'maintenance'],
    [
      /Update|Introducing|^New .*(?:added|coming soon|now available)|Adjustment|Recommended Devices|Timing of Addition/i,
      'other',
      'update',
    ],
  ],

  // An event's name when the title gives none: the title without its "!".
  titleName: (title) => title.replace(/!$/, ''),

  // --- scouts (banner-posts.js) -----------------------------------------------------------------------------------

  // A banner's art (<img …gacha_banner_<id>_….png>): split on (the capture keeps it), and its URL + gacha id.
  bannerArt: /(<img[^>]*\ssrc="[^"]*gacha_banner_\d+_[^"]*"[^>]*>)/,
  bannerArtSrc: /src="([^"]*gacha_banner_(\d+)_[^"]*)"/,
  bannerCard: /^(?:[•・■]\s*)?(SSR|SR|R)\s+\[([^\]]+)\]\s+(.+)$/,
  bannerTrainee: /^(★{1,3})\s+\[([^\]]+)\]\s+(.+)$/,
  // "Trainee Umamusume" (older posts: "Umamusume") → character, "Support Cards" → support.
  bannerType: (heading) =>
    /Trainee|^Umamusume$/i.test(heading) ? 'character' : /Support Card/i.test(heading) ? 'support' : null,
  // Period headings, and the scout period's among them.
  bannerPeriod: /period$/i,
  scoutPeriod: /scout.*period$/i,
  // The post's scouts cost paid carats.
  paidPost: /paid carats/i,

  // --- blocks (event-blocks.js) -----------------------------------------------------------------------------------

  // Header art (<figure><img …></figure>) starts a block; scout art doesn't.
  blockArt: /<figure>\s*<img[^>]*\ssrc="([^"]+)"[^>]*>\s*<\/figure>/gi,
  notBlockArt: /gacha_banner_/,
  artId: /_(\d{8})(?:_|\.)/,

  // --- rewards (event-rewards.js) ---------------------------------------------------------------------------------

  numbers: { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
  // Same item, other spelling → the name we show (keyed without a trailing "gift(s)": "150-carat gifts" are Carats).
  aliases: {
    carat: 'Carats',
    carats: 'Carats',
    monies: 'Monies',
    supportpt: 'Support Points',
    supportpoints: 'Support Points',
    friendpt: 'Friend Points',
  },
  // An item's name: no leading amount ("300 carats", "150-carat gifts"; not the "1.5" of "1.5-Year…"), capitalised;
  // what has no letter isn't one.
  itemAmountPrefix: /^\d[\d,]*(?=[\s-])[\s-]+/,
  itemNameChar: /[a-z]/i,
  aliasKey: (key) => key.replace(/gifts?$/, ''),
  showItem: (name) => name.replace(/^./, (c) => c.toUpperCase()),
  // Prices, fees and purchases aren't rewards (a sale's "Paid Carats × 1,500", a "30 carats" entry fee).
  notReward: /\b(?:fees?|costs?|prices?|purchases?|discount(?:ed)?|paid|limited supply|times only)\b/i,
  // Lines that talk about cards that only boost an event (story events' bonus cards, rankings), not ones it gives.
  notGiven: /bonus card|event bonus|boost|most frequently|ranking|perk|unique|issue/i,
  copies: /(?:a total of|up to)\s+(\w+)\s+(?:copies|copy)|(?:obtained|received)\s+up to\s+(\w+)\s+times/i,
  // "[Title] Name"
  cardMention: /\[([^\]]+)\]\s*([^\],.!?"”()]+)/g,
  login: /^login days?\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*:\s*/i,
  // "10:00 p.m., Oct 7, 2026 (UTC) – Item × 3" or, without "(UTC)", "10:00 p.m., Nov 25 – Item × 3"
  dated:
    /^.*?(?:\(UTC\)|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(?:, \d{4})?)\s*[–-]\s*/i,
  item: /^(?:[•・■*-]\s*)?(.+?)\s*[×x]\s*([\d,]+)\s*$/,
  itemBullet: /^[•・■*-]\s*/,
  // A list line that is a sentence isn't an item.
  sentenceEnd: /[.!?]$/,
  // "we've sent a gift of 3,000 carats", "you can obtain 500 carats as a holiday gift" (not entry fees or prices);
  // "a gift of 564 carats, up to a total maximum of 5,640!" counts the total
  proseTotal: /up to a total (?:maximum )?of (\d[\d,]*)/i,
  proseAmount: /\b(\d[\d,]*)\s+carats\b/i,
  proseItem: /carat/i,
  proseGift: /gift|sent|receive|obtain|earn/i,
  proseName: 'Carats',
  // "Main Rewards" bullets name rewards without amounts; so do "rewards like/including …" sentences.
  mainRewards: /^main rewards$/i,
  bullet: /^[•・]\s*/,
  rewardsLike: /rewards?,? (?:like|including|such as)/i,
  // Rewards worth naming even when the post gives no amount.
  mentioned: [
    ['Carats', /\bcarats\b/i],
    ['Monies', /\bmonies\b/i],
    ['Support Points', /\bsupport points?\b/i],
    ['Rainbow Crystal Shards', /rainbow crystal shards?/i],
    ['Support Card Scout Tickets', /support card scout tickets?/i],
    ['Trainee Scout Tickets', /trainee scout tickets?/i],
    // A voucher lets you pick a card (or trainee): named as the post names it ("1.5-Year Anniversary SSR Voucher").
    [null, /(?:[A-Z0-9][\w.-]* ){0,4}SSR (?:Support Card )?Vouchers?/],
  ],
  mentionedName: (s) => s.replace(/s$/, ''),
  // Player titles: "Event-Exclusive Title: X", or the bullets under "Event-Exclusive Titles".
  title: /Event-Exclusive Title:\s*(.+)$/i,
  titleList: /Event-Exclusive Titles$/i,
  // A mission set: a line "X Missions" (not a sentence) followed by its period.
  missionSet: (name) => /Missions$/.test(name) && name.split(' ').length <= 8,
  missionBullet: /^[•・■]\s*/,

  // doubts: "150-carat gifts", "500 carats", "50,000 Monies" in a sentence (not an "Item × N" list line)
  amount:
    /(\d[\d,]*)[\s-]+(carats?|monies|support (?:points?|pt)|friend (?:points?|pt)|(?:rainbow |gold )?crystal shards?|scout tickets?|star pieces?)\b/i,
  amountWord: (word) => word.replace(/s$/, '').slice(0, 6),
  per: /\b(?:each|every|per)\s+(?:day|login|period|availability period|week)\b|\bseries of\b|\bdaily\b/i,
  // "up to two times in the Login Bonus, and up to three times in the Missions, for a maximum of five times"
  copiesCount: /\b\w+\s+(?:copies|times)\b/gi,
  copiesTalk: /\bcop(?:y|ies)\b|\b\w+ times\b/i,
  // A line after one naming a card that goes on about copies ("It can be obtained up to two times…").
  copiesNext: /\bcop(?:y|ies)\b|\btimes\b/i,

  // --- events (events.js) -----------------------------------------------------------------------------------------

  // Headings that hold an event's own period (not when rewards can be collected, gifts expire, a final round runs…).
  period: /period|timing/i,
  notOwn: /reward collection|expiry|registration|matching|sneak peek|ranking|exchange/i,
  // A Champions Meeting starts with its league selection (before the post's "Event Availability Period", round 1 on).
  main: /availability period|event period|sale period|league selection period/i,
  // A "Gift Timing" list is moments, not periods: from the first to the last.
  timing: /timing/i,
  // "As of 10:00 p.m., Oct 7, 2026 (UTC), …", "From 3:00 p.m., Oct 8, 2026 (UTC), we're kicking off …",
  // "… has begun as of 10:00 p.m., Jul 22, 2026 (UTC)!", "… is set to begin at 3:00 p.m., Jul 23, 2026 (UTC)!"
  starts: /\b(?:as of|from|starting)\b|^at\b|set to begin at|will begin at/i,
  opening: (line) => /\(UTC\)/.test(line),
  // A period line: short, not a bullet point (bullets in period sections are fine print with other dates).
  periodLine: (line) => line.length < 90 && !/^[•・*]/.test(line),
  // A Champions Meeting's schedule headings (keys: CM_PHASES in events.js).
  cmPhases: [
    ['league_selection', /^league selection period$/i],
    ['round_1', /^round 1$/i],
    ['round_2', /^round 2$/i],
    ['final_registration', /^final round: registration period$/i],
    ['final_matching', /^final round: matching period$/i],
    ['final_race', /^final round: race period$/i],
  ],
  // A celebration's sub-event: its opening sentence without its date, the names in it, else a heading that names it.
  subOpening: /^(?:As of|From|At|Starting(?: from)?)\s.*?\(UTC\),\s*/i,
  subNames: [
    /(?:Missions|event) "([^"]+)"/i,
    /available in the (.+?) under/i,
    /added to the (.+?)[!.](?:\s|$)/i,
    /kicking off an? (.+?)(?: event)?!/i,
    /sending (?:another |a )?(?:set of )?(.+?) gifts/i,
    /sent (a gift of .+?) to all/i,
    /gifted with the (.+?)!(?:\s|$)/i,
    /adding (bonus .+?) to/i,
    /^(?:the |an? )?(?!following|new items)(.+?)(?: event)? (?:has begun|have begun|is (?:now )?underway|is now live|(?:is|are) (?:now )?available|will appear|is set to begin)/i,
  ],
  cleanName: (s) =>
    s
      .replace(/["“”]/g, '')
      .trim()
      .replace(/^./, (c) => c.toUpperCase()),
  notNameHeading: /important|details|contents/i,
  // [kind, pattern] in order; a sub-event's name and opening sentence decide first, its headings only when they don't.
  subKinds: [
    ['login_bonus', /login bonus/i],
    ['missions', /missions\b/i],
    ['sale', /sale period|sale details|discounted|paid carats/i],
    ['shop', /shop|exchange|daily sale/i],
    ['gift', /gift|present|giveaway/i],
  ],
  // A block with gift/reward contents gives something (a sub-event even without a period).
  gives: /gift contents|reward contents/i,
  // The post's sentence about its mission sets' rewards ("By completing these missions, you can earn rewards
  // including carats, monies and Support Points!").
  missionRewards: (line) => /missions/i.test(line) && /rewards?/i.test(line),
};
