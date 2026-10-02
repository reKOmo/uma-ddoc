// The generated card data must be complete, consistent with upstream's card
// lists, and usable for every scenario and stat the UI offers.

import { describe, it, expect } from "vitest"
import { isDeepStrictEqual } from "node:util"
import { loadCards, metadata } from "../tierlist/cards.js"
import { STATS, presetDecks, rankByUsefulness } from "../tierlist/index.js"
import { NAME_FIELD } from "../tierlist/join-cards.js"
import { getServerConfig } from "../tierlist/scenarios.js"
import gl from "../generated/raw/gl.js"
import jp from "../generated/raw/jp.js"

const SOURCE = { gl, jp }

for (const server of ["gl", "jp"]) {
  describe(`${server} data`, () => {
    it(`loadCards rebuilds upstream's ${server} card list exactly`, async () => {
      expect(isDeepStrictEqual(await loadCards(server), SOURCE[server])).toBe(true)
    })

    it("every card has metadata with a name in this server's language", async () => {
      const missing = (await loadCards(server)).filter((c) => !metadata[c.id]?.[NAME_FIELD[server]])
      expect(missing.map((c) => c.id)).toEqual([])
    })

    it("every preset deck card exists at LB4", async () => {
      const cards = await loadCards(server)
      const ids = presetDecks(server).flatMap((d) => d.cards)
      const missing = ids.filter((id) => !cards.some((c) => c.id === id && c.limit_break === 4))
      expect(missing).toEqual([])
    })

    for (const scenario of getServerConfig(server).availableScenarios) {
      it(`${scenario}: usefulness ranking is non-empty, finite and sorted for every stat`, async () => {
        for (const stat of Object.keys(STATS)) {
          const ranking = await rankByUsefulness(server, scenario, stat)
          expect(ranking.length, stat).toBeGreaterThan(0)
          expect(ranking.every((r) => Number.isFinite(r.score)), stat).toBe(true)
          expect(ranking.every((r, i) => i === 0 || ranking[i - 1].score >= r.score), stat).toBe(true)
        }
      })
    }
  })
}
