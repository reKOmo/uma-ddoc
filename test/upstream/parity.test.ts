// Ours is a copy of upstream's calculation, maintained here now: these fail when upstream changes and ours should follow.
// Run with `pnpm test:upstream` (not part of `pnpm test`).

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { UPSTREAM_DIR } from '../../scripts/lib/upstream.ts';
import sources from '../../generated/sources.json' with { type: 'json' };
import { STATS, presetDecks, rankCards } from '../../tierlist/index.ts';
import { getServerConfig } from '../../tierlist/scenarios.ts';
import type { Server } from '../../tierlist/cards.ts';
import type { Stat } from '../../tierlist/index.ts';
import type { CalcCard } from '../../tierlist/tierlist-calc.ts';
import type { SourcesFile } from '../../shared/schemas/sources.ts';

if (!existsSync(`${UPSTREAM_DIR}src/components/tierlist-calc.js`)) {
  throw new Error('No upstream clone in upstream/ — run `pnpm clone-upstream` first');
}

const { processCards } = await import('../../upstream/src/components/tierlist-calc.js');
const upstreamScenarios = await import('../../upstream/src/scenarios.js');
const UPSTREAM_CARDS = {
  gl: (await import('../../upstream/src/cards/gl.js')).default,
  jp: (await import('../../upstream/src/cards/jp.js')).default,
};

// Upstream's UI glue: merges weights, filters cards by type, as its UI does.
function upstreamRanking(server: Server, scenario: string, stat: Stat, deckIds: number[]) {
  const cards = UPSTREAM_CARDS[server];
  const preset = upstreamScenarios.getScenario(server, scenario);
  const weights = { ...preset[stat], ...preset.general };
  // (a preset deck's card is always in the list: a missing one fails in the calculation, as in upstream)
  const deck = deckIds.map((id) => cards.find((c) => c.id === id && c.limit_break === 4) as CalcCard);
  // Upstream also returns a per-card breakdown (`info`) for its UI; we don't keep it.
  return processCards(cards.filter((c) => c.type === weights.type) as CalcCard[], weights, deck).map(
    ({ info, ...r }) => r
  );
}

it('the clone and generated/ card data are the same upstream commit', () => {
  const head = execFileSync('git', ['-C', UPSTREAM_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const generated = (sources as SourcesFile)['raw/upstream/gl.js'];
  expect(head, 'run `pnpm clone-upstream && pnpm update-cards` to line them up').toBe(
    generated && 'ref' in generated ? generated.ref : undefined
  );
});

for (const server of ['gl', 'jp'] as const) {
  describe(`${server}`, () => {
    it('offers the same scenarios, default and deck presets', () => {
      const ours = getServerConfig(server);
      const theirs = upstreamScenarios.getServerConfig(server);
      for (const key of ['availableScenarios', 'defaultScenario', 'defaultPresetCards', 'deckPresets'] as const) {
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
