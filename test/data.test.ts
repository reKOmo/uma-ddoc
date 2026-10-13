// @ts-nocheck
// The generated card data must be complete, consistent with upstream's card
// lists, and usable for every scenario and stat the UI offers.

import { describe, it, expect } from 'vitest';
import { isDeepStrictEqual } from 'node:util';
import { cards, loadCards } from '../tierlist/cards.ts';
import { COMBINED, STATS, presetDecks, rankByUsefulness, scenarioOptions, scenariosOf } from '../tierlist/index.ts';
import { withoutEvents } from '../tierlist/join-cards.ts';
import { getScenarios, getServerConfig } from '../tierlist/scenarios.ts';
import gl from '../generated/raw/upstream/gl.js';
import jp from '../generated/raw/upstream/jp.js';
import events from '../generated/raw/upstream/card-events.js';

const SOURCE = { gl, jp };

for (const server of ['gl', 'jp']) {
  describe(`${server} data`, () => {
    it(`loadCards rebuilds upstream's ${server} card list exactly`, async () => {
      expect(isDeepStrictEqual(withoutEvents(await loadCards(server)), SOURCE[server])).toBe(true);
    });

    it("carries upstream's card events", async () => {
      const wrong = (await loadCards(server)).filter((c) => !isDeepStrictEqual(c.events, events[c.id] ?? null));
      expect(wrong.map((c) => c.id)).toEqual([]);
    });

    it('every card is in cards.json, with both names', async () => {
      const missing = (await loadCards(server)).filter((c) => !cards[c.id]?.name.en || !cards[c.id]?.name.jp);
      expect(missing.map((c) => c.id)).toEqual([]);
    });

    it('every preset deck card exists at LB4', async () => {
      const cards = await loadCards(server);
      const ids = presetDecks(server).flatMap((d) => d.cards);
      const missing = ids.filter((id) => !cards.some((c) => c.id === id && c.limit_break === 4));
      expect(missing).toEqual([]);
    });

    for (const scenario of scenarioOptions(server)) {
      it(`${scenario}: usefulness ranking is non-empty, finite and sorted for every stat`, async () => {
        for (const stat of STATS) {
          const ranking = await rankByUsefulness(server, scenario, stat);
          expect(ranking.length, stat).toBeGreaterThan(0);
          expect(
            ranking.every((r) => Number.isFinite(r.score)),
            stat
          ).toBe(true);
          expect(
            ranking.every((r, i) => i === 0 || ranking[i - 1].score >= r.score),
            stat
          ).toBe(true);
        }
      });
    }

    it('averaged rankings cover real scenarios, include the current one, and score 0-1000', async () => {
      const current = getServerConfig(server).defaultScenario;
      for (const key of Object.keys(COMBINED)) {
        const scenarios = scenariosOf(server, key);
        expect(scenarios, key).toContain(current);
        expect(
          scenarios.every((s) => s in getScenarios(server)),
          key
        ).toBe(true);
        const ranking = await rankByUsefulness(server, key, 'speed');
        expect(ranking[0].score, key).toBeLessThanOrEqual(1000);
        expect(ranking.at(-1).score, key).toBeGreaterThanOrEqual(0);
      }
    });
  });
}

describe('rankings with upcoming cards', () => {
  it("add JP's cards Global doesn't have, without changing any Global card's score", async () => {
    const own = await loadCards('gl');
    const ids = new Set(own.map((c) => c.id));
    for (const scenario of [getServerConfig('gl').defaultScenario, 'overall']) {
      const base = await rankByUsefulness('gl', scenario, 'speed');
      const ranking = await rankByUsefulness('gl', scenario, 'speed', { upcoming: true });
      const scores = new Map(ranking.map((r) => [`${r.id}/${r.lb}`, r.score]));
      expect(ranking.length, scenario).toBeGreaterThan(base.length);
      expect(
        ranking.some((r) => !ids.has(r.id)),
        scenario
      ).toBe(true);
      expect(
        base.filter((r) => scores.get(`${r.id}/${r.lb}`) !== r.score),
        scenario
      ).toEqual([]);
    }
  });
});
