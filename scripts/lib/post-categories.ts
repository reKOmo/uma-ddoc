// What a news post (data/news/gl/posts.json, as the API sends it) is about: a scout banner, an in-game event (and which
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
// Global's post ids come in series: 1… in-game news, 100001… notices (issues, maintenance, store), 200001… community
// posts (X giveaways, letters, guidelines), never in-game events. The title rules are the lexicon's
// (scripts/lib/news-lang/).

import type { NewsPost } from '../../shared/schemas/news.ts';
import { bannerPost } from './banner-posts.ts';
import { en } from './news-lang/en.ts';
import type { Lexicon } from './news-lang/index.ts';
import { decodeEntities } from './news-text.ts';

export type Categorized = {
  id: number;
  category: 'banner' | 'event' | 'other';
  kind: string | null;
  phase: string | null;
  name: string | null;
  banners: { gachaId: number; type: 'character' | 'support' | null }[];
};

// Plain text: tags dropped, entities decoded, whitespace collapsed.
export function plain(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// `lang`: the posts' wording (scripts/lib/news-lang/), English by default.
export function categorize(post: NewsPost, lang: Lexicon = en): Categorized {
  const id = Number(post.announce_id);
  const title = plain(post.title);
  const phase = lang.phases.find(([re]) => re.test(title))?.[1] ?? null;
  const result: Categorized = { id, category: 'other', kind: 'misc', phase, name: null, banners: [] };

  if (lang.community(post)) return { ...result, kind: 'community' };
  const banners = bannerPost(post, lang)?.banners.map(({ gachaId, type }) => ({ gachaId, type }));
  if (banners?.length) return { ...result, category: 'banner', kind: null, banners };

  for (const [re, category, kind, name] of lang.rules) {
    const m = re.exec(title);
    if (!m) continue;
    const named = typeof name === 'function' ? name(m) : name ? m[name] : null;
    // A kind can depend on the post (JP: a campaign showing several parts' art is a celebration).
    return { ...result, category, kind: typeof kind === 'function' ? kind(post) : kind, name: named };
  }
  return result;
}
