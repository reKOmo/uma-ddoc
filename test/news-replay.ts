import { beforeAll, describe, expect, it } from 'vitest';
import type { Server } from '../scripts/lib/news-text.ts';
import { canClassify, heldOutCategories, readCategories } from '../scripts/lib/categories.ts';
import { type Merge, buildEvents, readAnswers } from '../scripts/lib/events.ts';
import { readGold } from '../scripts/lib/gold.ts';
import { loadPosts } from '../scripts/lib/news-api.ts';
import { lexicon } from '../scripts/lib/news-lang/index.ts';

// The stored news replayed post by post, as the news workflow meets it: a new post never wipes or changes the kind of
// an event the older posts made, and an event post the gold set knows always makes (or joins) one. (Global's 1122,
// "New Beginnings Part 1", was misread when it came: the celebration vanished and its free scout showed up alone.)
// Once with the stored categories (every post gold), once with the newest posts categorized by the models as if new.
const REPLAYED = 15;
// (Posts the models categorize as if new: more than are replayed, so they learn from less, as they did when 1093 came.)
const HELD_OUT = 40;

// (One file per server, so they run in parallel: news-replay-gl / -jp.test.ts.)
export function replayNews(server: Server): void {
  describe(`a new post (${server})`, { tags: ['data'] }, () => {
    const lang = lexicon(server);
    const answers = readAnswers(server);
    const gold = new Map(readGold(server).map((l) => [String(l.id), l]));
    const posts = [...loadPosts(server).values()].sort((a, b) => a.post_at.localeCompare(b.post_at));
    const newest = posts.slice(-REPLAYED).map((post) => [post.announce_id, posts.indexOf(post)] as const);
    const stored = readCategories(server);
    // (Each build is the next post's "before": kept, with the merges it made.)
    const builds = new Map<typeof stored, Map<number, { events: ReturnType<typeof buildEvents>; merges: Merge[] }>>();
    const build = (categories: typeof stored, upTo: number) => {
      if (!builds.has(categories)) builds.set(categories, new Map());
      const cached = builds.get(categories)?.get(upTo);
      if (cached) return cached;
      const merges: Merge[] = [];
      const built = { events: buildEvents(posts.slice(0, upTo), { lang, categories, answers, merges }), merges };
      builds.get(categories)?.set(upTo, built);
      return built;
    };

    function replay(categories: typeof stored, id: number, at: number) {
      const before = build(categories, at).events;
      const { events, merges } = build(categories, at + 1);
      const after = new Map(events.map((e) => [e.id, e]));

      // Kept as it was, or joined into an event of its kind (1124, the Daily Free 10x Scout's own post, becomes the
      // part of 1122's celebration it is).
      const kept = (e: (typeof before)[number]) => {
        const same = after.get(e.id);
        if (same) return same.kind === e.kind && same.parent === e.parent;
        const into = merges.find((m) => m.from === e.id && m.how !== 'dropped');
        return after.get(into?.into ?? '')?.kind === e.kind;
      };
      expect(before.filter((e) => !kept(e)).map((e) => `${e.id} ${e.kind} "${e.name}"`)).toEqual([]);

      const label = gold.get(String(id));
      if (label?.category !== 'event' || label.phase === 'ending' || label.phase === 'ended') return;
      const own = (fragment: string) => fragment === String(id) || fragment.startsWith(`${id}-`);
      const made =
        [...after.keys()].some(own) || merges.some((m) => own(m.from) && m.how !== 'dropped' && after.has(m.into));
      expect(made, `post ${id} (${label.kind}) makes no event`).toBe(true);
    }

    it.each(newest)('post %s keeps every older event and makes its own', (id, at) => replay(stored, id, at));

    // (Needs ml/'s venv, `pnpm setup-ml`; deploy.yml sets it up before the tests.)
    describe.skipIf(!canClassify())('categorized by the models, without its gold label', () => {
      let held = stored;
      beforeAll(() => {
        held = heldOutCategories(
          server,
          posts.slice(-HELD_OUT).map((post) => post.announce_id)
        );
      }, 120_000);

      it.each(newest)('post %s keeps every older event and makes its own', (id, at) => replay(held, id, at));

      // (A part of the wrong kind stays apart from its event's own post: 1093's Sparkly Magic Show read as a login bonus
      // was two bars.)
      it('makes the events its gold label makes', () => {
        const shape = (categories: typeof stored) =>
          build(categories, posts.length).events.map((e) => `${e.id} ${e.kind} ${e.parent ?? ''}`);
        expect(shape(held)).toEqual(shape(stored));
      });
    });
  });
}
