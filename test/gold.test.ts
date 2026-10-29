import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { goldFile, readGold, ruleLabel, stale, units } from '../scripts/lib/gold.ts';
import { loadPosts } from '../scripts/lib/news-api.ts';

describe('the gold set', () => {
  const posts = loadPosts('gl');

  it.each(['gl', 'jp'] as const)(
    'labels stored posts, an event post unit by unit (%s)',
    { tags: ['data'] },
    (server) => {
      if (!existsSync(goldFile(server))) return;
      const stored = loadPosts(server);
      const labels = readGold(server);
      expect(labels.filter((l) => !stored.has(String(l.id))).map((l) => l.id)).toEqual([]);
      const wrongUnits = labels.filter((l) => {
        const post = stored.get(String(l.id));
        // (A post edited since may cut otherwise: it's labelled again, gold.ts' stale().)
        if (!post || stale(l, post)) return false;
        return l.category === 'event' ? l.units.length !== units(post, server).length : l.units.length > 0;
      });
      expect(wrongUnits.map((l) => l.id)).toEqual([]);
    }
  );

  it("pre-fills a celebration's intro and the part its first art opens as two units", () => {
    const post = posts.get('1122');
    if (!post) return;
    const label = ruleLabel(post);
    expect(label).toMatchObject({ category: 'event', kind: 'celebration', name: 'New Beginnings Part 1' });
    expect(label.units[0].role).toBe('event');
    expect(units(post)[1].intro[0]).toMatch(/Countdown Login Bonus/);
    expect(label.units[2]).toEqual({ role: 'part', kind: 'campaign', name: 'Daily Free 10x Scout' });
  });
});
