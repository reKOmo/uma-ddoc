// What a news post (data/news/posts.json, as the API sends it) is about: a scout banner, an in-game event (and which
// kind), or something else. Pure; reads the title, the id series and, for banners, the body.
//
// categorize(post) → { id, category, kind, phase, name, banners }
//   category  'banner' | 'event' | 'other'
//   kind      events: 'story' | 'champions_meeting' | 'legend_race' | 'transfer_requests' | 'uma_outing' |
//             'special' (named one-offs: "Trainer Aptitude Test", "Aim for the Stars! Dream Team") |
//             'celebration' (multi-part celebrations: anniversaries, holidays, Fall G1, Umayuru) |
//             'campaign' (single bonuses: Star Pieces in Career, extra race tickets, free scouts) |
//             'gift' (presents for all) | 'login_bonus' | 'missions' (limited-time mission sets)
//             other: 'scenario' | 'update' | 'issue' | 'maintenance' | 'sale' | 'roundup' | 'community' | 'misc'
//             banners: null
//   phase     'announced' (coming soon) | 'league_selection' (Champions Meeting) | 'started' | 'ending' | 'ended' |
//             null (the title doesn't say)
//   name      the event's name where the title gives one ("Hark Back, Run Forward", "Sagittarius Cup"), else null
//   banners   [{ gachaId, type: 'character' | 'support' | null }]: every scout banner the post shows
//             (scripts/lib/banner-posts.js reads the rest of them)
//
// Post ids come in series: 1… in-game news, 100001… notices (issues, maintenance, store), 200001… community posts
// (X giveaways, letters, guidelines), never in-game events.

import { bannerPost } from './banner-posts.js';
import { decodeEntities } from './news-text.js';

// Plain text: tags dropped, entities decoded, whitespace collapsed.
export function plain(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const PHASES = [
  [/league selection period/i, 'league_selection'],
  [/coming soon|is coming/i, 'announced'],
  [/ending soon/i, 'ending'],
  [/has ended/i, 'ended'],
  [/is here|are here|now available|out now|has begun|available!|underway/i, 'started'],
];

const PHASE_WORDS =
  /\s*(?:is here|are here|is coming.*|coming soon|(?:is )?now (?:available|underway)|out now|has begun|has ended|ending soon|added)!?$/i;

// A celebration's or campaign's name: the title without its phase, a leading "A special" or tagline ("Up to 100 free scouts! …"),
// a trailing "event" or "!".
const campaignName = (title) =>
  title
    .replace(PHASE_WORDS, '')
    .replace(/^.*!\s+(?=\S)/, '')
    .replace(/^(?:An?|The) (?:special )?/i, '')
    .replace(/\s+event$|!$/i, '')
    .replace(/^"(.*)"$/, '$1');

// [title pattern, category, kind, name]: the first match wins. name is a capture group's index or a function of the
// match.
const RULES = [
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
];

export function categorize(post) {
  const id = Number(post.announce_id);
  const title = plain(post.title);
  const phase = PHASES.find(([re]) => re.test(title))?.[1] ?? null;
  const result = { id, category: 'other', kind: 'misc', phase, name: null, banners: [] };

  if (id > 200000) return { ...result, kind: 'community' };
  const banners = bannerPost(post)?.banners.map(({ gachaId, type }) => ({ gachaId, type }));
  if (banners?.length) return { ...result, category: 'banner', kind: null, banners };

  for (const [re, category, kind, name] of RULES) {
    const m = title.match(re);
    if (!m) continue;
    const named = typeof name === 'function' ? name(m) : name ? m[name] : null;
    return { ...result, category, kind, name: named };
  }
  return result;
}
