// @ts-nocheck
// Our tier list calculation started as a copy of upstream's and is maintained
// here now. These tests run upstream's current code (from the clone in
// upstream/, see scripts/clone-upstream.js) next to ours and fail when they
// disagree, which is how we hear about upstream changes worth porting.
//
// Run with `pnpm test:upstream` (not part of `pnpm test`).

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { UPSTREAM_DIR } from '../../scripts/lib/upstream.ts';
import sources from '../../generated/sources.json';
import { STATS, presetDecks, rankCards } from '../../tierlist/index.ts';
import { getServerConfig } from '../../tierlist/scenarios.ts';

if (!existsSync(`${UPSTREAM_DIR}src/components/tierlist-calc.js`)) {
  throw new Error('No upstream clone in upstream/ — run `pnpm clone-upstream` first');
}

// Upstream's own modules, imported as-is (Vite resolves their extensionless imports).
const { processCards } = await import('../../upstream/src/components/tierlist-calc.js');
const upstreamScenarios = await import('../../upstream/src/scenarios.js');
const UPSTREAM_CARDS = {
  gl: (await import('../../upstream/src/cards/gl.js')).default,
  jp: (await import('../../upstream/src/cards/jp.js')).default,
};

// Upstream's UI glue (Main.jsx merges weights, TierList.jsx filters by type),
// on upstream's own card lists, scenarios and card events.
function upstreamRanking(server, scenario, stat, deckIds) {
  const cards = UPSTREAM_CARDS[server];
  const preset = upstreamScenarios.getScenario(server, scenario);
  const weights = { ...preset[stat], ...preset.general };
  const deck = deckIds.map((id) => cards.find((c) => c.id === id && c.limit_break === 4));
  // Upstream also returns a per-card breakdown (`info`) for its UI; we don't keep it.
  return processCards(
    cards.filter((c) => c.type === weights.type),
    weights,
    deck
  ).map(({ info, ...r }) => r);
}

it('the clone and generated/ card data are the same upstream commit', () => {
  const head = execFileSync('git', ['-C', UPSTREAM_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  expect(head, 'run `pnpm clone-upstream && pnpm update-cards` to line them up').toBe(
    sources['raw/upstream/gl.js'].ref
  );
});

for (const server of ['gl', 'jp']) {
  describe(`${server}`, () => {
    it('offers the same scenarios, default and deck presets', () => {
      const ours = getServerConfig(server);
      const theirs = upstreamScenarios.getServerConfig(server);
      for (const key of ['availableScenarios', 'defaultScenario', 'defaultPresetCards', 'deckPresets']) {
        expect(ours[key], key).toStrictEqual(theirs[key]);
      }
    });

    // Every scenario × stat, against each preset deck: covers all the weights.
    for (const scenario of getServerConfig(server).availableScenarios) {
      it.each(STATS)(`${scenario} %s ranks exactly like upstream`, async (stat) => {
        for (const { cards: deck } of presetDecks(server)) {
          expect(await rankCards(server, scenario, stat, deck)).toStrictEqual(
            upstreamRanking(server, scenario, stat, deck)
          );
        }
      });
    }
  });
}
