// The gold sets (data/news/<server>/gold.json): every post labelled by hand, starting from what today's rules make of
// it. What the classifiers are trained and checked on (docs/data/classifier.md).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { GoldLabel, GoldUnit, NewsPost } from '../../shared/schemas/news.ts';
import { eventBlocks } from './event-blocks.ts';
import { postEvents } from './events.ts';
import { lexicon } from './news-lang/index.ts';
import type { Block } from './news-lang/index.ts';
import { loadPosts } from './news-api.ts';
import type { Server } from './news-text.ts';
import { newsDir } from './paths.ts';
import { categorize, plain } from './post-categories.ts';

export const goldFile = (server: Server = 'gl'): string => `${newsDir(server)}gold.json`;

// A post cut at its header art, the intro a unit of its own (so a celebration's intro and the part after it, "…the
// New Year's Countdown Login Bonus has begun!", are two; JP's parser cuts them so already).
export const units = (post: NewsPost, server: Server = 'gl'): Block[] =>
  eventBlocks(post, { ...lexicon(server), introBlock: true });

// What today's rules make of a post: its category, and for an event post each unit's role from the events
// postEvents() cuts it into (a celebration's sub-event `<post>-<block>` is that block's unit; a block no sub-event
// came from is more of the one before, or nothing when the lexicon says it's no part: JP's scouts and summaries; the
// first art's block is the celebration's own unless it opened a part, -0).
export function ruleLabel(post: NewsPost, server: Server = 'gl'): GoldLabel {
  const lang = lexicon(server);
  const c = categorize(post, lang);
  const label: GoldLabel = {
    id: post.announce_id,
    category: c.category,
    // TODO(ts): categorize()'s kinds are the lexicons' rule kinds, the same lists as the schema's
    kind: c.kind as GoldLabel['kind'],
    // TODO(ts): categorize()'s phases are the lexicons' `phases`, POST_PHASES
    phase: c.phase as GoldLabel['phase'],
    name: null,
    units: [],
    note: null,
    reviewed: false,
    post_updated: post.update_at,
  };
  if (c.category !== 'event') return label;
  const fragments = new Map(postEvents(post, undefined, lang).map((f) => [f.id, f]));
  const id = String(post.announce_id);
  const all = units(post, server);
  const intro = all.length - eventBlocks(post, lang).length;
  const part = (n: number): GoldUnit | null => {
    const f = fragments.get(`${id}-${n}`);
    // TODO(ts): a sub-event's kind is one of EVENT_KINDS (subEventKind())
    return f ? { role: 'part', kind: f.kind as GoldUnit['kind'], name: f.name } : null;
  };
  const own: GoldUnit = { role: 'event', kind: null, name: null };
  const nothing: GoldUnit = { role: 'none', kind: null, name: null };
  return {
    ...label,
    name: fragments.get(id)?.name ?? c.name,
    units: all.map((block, u) => {
      if (c.kind !== 'celebration' || u < intro) return own;
      const n = u - intro;
      if (n > 0 && lang.blockRole?.(block)) return nothing;
      return part(n) ?? (n === 0 ? own : { role: 'continues', kind: null, name: null });
    }),
  };
}

// The other server's post with the same id, as a hint: for a Global post JP's (by JP's rules), for a JP post Global's
// gold label (Global's in-game posts reuse JP's ids; Global's own series, 100001…, never match).
export type Twin = { title: string; category: GoldLabel['category']; kind: string | null; labelled: boolean };
export function twins(server: Server): Map<number, Twin> {
  if (server === 'gl')
    return new Map(
      [...loadPosts('jp').values()].map((p) => {
        const c = categorize(p, lexicon('jp'));
        return [p.announce_id, { title: plain(p.title), category: c.category, kind: c.kind, labelled: false }];
      })
    );
  const titles = new Map([...loadPosts('gl').values()].map((p) => [p.announce_id, plain(p.title)]));
  return new Map(
    readGold('gl')
      .filter((l) => l.id < 100000)
      .map((l) => [l.id, { title: titles.get(l.id) ?? '', category: l.category, kind: l.kind, labelled: true }])
  );
}

export const readGold = (server: Server = 'gl'): GoldLabel[] =>
  // TODO(ts): JSON.parse's any: gold.json is written by writeGold() (its schema: GoldFileSchema, test/schemas.test.ts)
  existsSync(goldFile(server)) ? (JSON.parse(readFileSync(goldFile(server), 'utf8')) as GoldLabel[]) : [];

// One post per line, newest (highest id) first, so commits diff per post.
export function writeGold(labels: GoldLabel[], server: Server = 'gl'): void {
  const sorted = [...labels].sort((a, b) => b.id - a.id);
  writeFileSync(goldFile(server), `[\n${sorted.map((l) => JSON.stringify(l)).join(',\n')}\n]\n`);
}

// A label of an earlier version of its post (edited since: a note added).
export const stale = (label: GoldLabel, post: NewsPost): boolean => label.post_updated !== post.update_at;

// The posts edited since they were labelled.
export function staleLabels(server: Server = 'gl'): GoldLabel[] {
  const posts = loadPosts(server);
  return readGold(server).filter((l) => {
    const post = posts.get(String(l.id));
    return post !== undefined && stale(l, post);
  });
}

// Every post labelled: the stored labels (one of an edited post's to review again), and today's rules' for posts
// without one.
export function withRuleLabels(posts: Iterable<NewsPost>, gold: GoldLabel[], server: Server = 'gl'): GoldLabel[] {
  const byId = new Map(gold.map((l) => [l.id, l]));
  return [...posts].map((p) => {
    const label = byId.get(p.announce_id);
    if (!label) return ruleLabel(p, server);
    return stale(label, p) ? { ...label, reviewed: false } : label;
  });
}
