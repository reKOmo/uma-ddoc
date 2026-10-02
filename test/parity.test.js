// Behavioural check on a sample: rankCards (split card data + loader + glue)
// must rank exactly like upstream's UI does with upstream's raw card lists.
// data.test.js proves the loaded cards equal the raw lists, so one scenario
// per server with a couple of decks is enough to cover the glue.

import { it, expect } from "vitest"
import { STATS, presetDecks, rankCards } from "../tierlist/index.js"
import { processCards } from "../tierlist/tierlist-calc.js"
import { getScenario, getServerConfig } from "../tierlist/scenarios.js"
import gl from "../generated/raw/gl.js"
import jp from "../generated/raw/jp.js"

const RAW = { gl, jp }

// Upstream's UI glue (Main.jsx merges weights, TierList.jsx filters by type).
function upstreamRanking(server, scenario, stat, deckIds) {
  const cards = RAW[server]
  const preset = getScenario(server, scenario)
  const weights = { ...preset[stat], ...preset.general }
  const deck = deckIds.map((id) => cards.find((c) => c.id === id && c.limit_break === 4))
  return processCards(cards.filter((c) => c.type === weights.type), weights, deck)
}

for (const server of ["gl", "jp"]) {
  const scenario = getServerConfig(server).defaultScenario
  const [defaultDeck, firstPreset] = presetDecks(server)
  it.each(Object.keys(STATS))(`${server} ${scenario} %s matches upstream`, async (stat) => {
    for (const deck of [[], defaultDeck.cards, firstPreset.cards]) {
      expect(await rankCards(server, scenario, stat, deck)).toStrictEqual(
        upstreamRanking(server, scenario, stat, deck)
      )
    }
  })
}
