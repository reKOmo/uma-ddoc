// A news post's category (scout banner, in-game event with its kind, or other), from the title, the id series and,
// for banners, the body; Global's revised by template phrases in the body (lang.revise). Pure.
//
// Post ids come in series: 1… in-game news, 100001… notices (issues, maintenance, store), 200001… community posts
// (X giveaways, letters). Only the first is in-game events; lang.community() catches the rest.

import type { NewsPost } from '../../shared/schemas/news.ts';
import { bannerPost } from './banner-posts.ts';
import { en } from './news-lang/en.ts';
import type { Lexicon } from './news-lang/index.ts';
import { decodeEntities, toLines } from './news-text.ts';

export type Categorized = {
  id: number;
  category: 'banner' | 'event' | 'other';
  kind: string | null;
  phase: string | null;
  name: string | null;
  banners: { gachaId: number; type: 'character' | 'support' | null }[];
};

export function plain(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function categorize(post: NewsPost, lang: Lexicon = en): Categorized {
  const id = Number(post.announce_id);
  const title = plain(post.title);
  const phase = lang.phases.find(([re]) => re.test(title))?.[1] ?? null;
  const result: Categorized = { id, category: 'other', kind: 'misc', phase, name: null, banners: [] };

  if (lang.community(post)) return { ...result, kind: 'community' };
  const banners = bannerPost(post, lang)?.banners.map(({ gachaId, type }) => ({ gachaId, type }));
  if (banners?.length) return { ...result, category: 'banner', kind: null, banners };

  let rule: Categorized = result;
  for (const [re, category, kind, name] of lang.rules) {
    const m = re.exec(title);
    if (!m) continue;
    const named = typeof name === 'function' ? name(m) : name ? m[name] : null;
    // A kind can depend on the post (JP: a campaign showing several parts' art is a celebration).
    rule = { ...result, category, kind: typeof kind === 'function' ? kind(post) : kind, name: named };
    break;
  }
  if (!lang.revise) return rule;
  const has = new Set(postSignals(post, lang));
  return { ...rule, ...lang.revise(rule, (signal) => has.has(signal), title) };
}

// The template phrases (lang.signals) a post shows: in its title, its first line or anywhere in it.
export function postSignals(post: NewsPost, lang: Lexicon = en): string[] {
  const lines = toLines(lang.clean(post.message ?? ''));
  const text = { title: plain(post.title), opening: lines[0] ?? '', body: lines.join('\n') };
  return (lang.signals ?? []).filter(([, where, re]) => re.test(text[where])).map(([name]) => name);
}
