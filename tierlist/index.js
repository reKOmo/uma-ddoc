// Ranks every support card of one stat type for a scenario. Usage:
//   import { rankByUsefulness } from "./tierlist/index.js"
//   const ranking = await rankByUsefulness("gl", "GL", "speed")
// or from the shell:  node tierlist/cli.js gl GL speed
//
// server: "gl" | "jp"
// scenario: getServerConfig(server).availableScenarios
// stat: a key of STATS

import { processCards } from "./tierlist-calc.js"
import { getScenario, getServerConfig } from "./scenarios.js"
import { loadCards } from "./cards.js"

// The stat tabs every scenario defines, with their display names.
export const STATS = {
  speed: "Speed",
  stamina: "Stamina",
  power: "Power",
  guts: "Guts",
  wisdom: "Wit",
  friend: "Friend",
}

// The site's default deck plus its named presets, as card ids.
export function presetDecks(server) {
  const config = getServerConfig(server)
  return [
    { key: "default", cards: config.defaultPresetCards },
    ...config.deckPresets,
  ]
}

async function setup(server, scenario, stat) {
  const cards = await loadCards(server)
  const preset = getScenario(server, scenario)
  const weights = { ...preset[stat], ...preset.general }
  const candidates = cards.filter((c) => c.type === weights.type)
  const toDeck = (ids) =>
    ids.map((id) => cards.find((c) => c.id === id && c.limit_break === 4))
  return { weights, candidates, toDeck }
}

// The upstream tier list: each card's value when added to one deck of 5 MLB
// cards (deckIds), defaulting to the site's preset deck.
export async function rankCards(server, scenario, stat, deckIds) {
  const { weights, candidates, toDeck } = await setup(server, scenario, stat)
  const ids = deckIds ?? getServerConfig(server).defaultPresetCards
  return processCards(candidates, weights, toDeck(ids))
}

// Deck-independent ranking: a card's score is its average value across the
// site's default deck and all its deck presets. The game forbids two cards of
// the same character, so when a deck already holds the candidate's character
// the candidate is scored against the remaining 4 cards instead.
// Results are cached per server/scenario/stat.
const usefulnessCache = new Map()

export function rankByUsefulness(server, scenario, stat) {
  const key = `${server}/${scenario}/${stat}`
  if (!usefulnessCache.has(key)) {
    usefulnessCache.set(key, computeUsefulness(server, scenario, stat))
  }
  return usefulnessCache.get(key)
}

async function computeUsefulness(server, scenario, stat) {
  const { weights, candidates, toDeck } = await setup(server, scenario, stat)
  const decks = presetDecks(server).map((d) => toDeck(d.cards))

  const totals = new Map()
  for (const deck of decks) {
    // Group candidates by the deck they'll actually be scored against.
    const groups = new Map()
    for (const card of candidates) {
      const own = deck.filter((c) => c.char_name !== card.char_name)
      const key = own.map((c) => c.id).join()
      if (!groups.has(key)) groups.set(key, { deck: own, cards: [] })
      groups.get(key).cards.push(card)
    }
    for (const group of groups.values()) {
      for (const r of processCards(group.cards, weights, group.deck)) {
        const key = `${r.id}/${r.lb}`
        const t = totals.get(key) ?? { id: r.id, lb: r.lb, char_name: r.char_name, score: 0 }
        t.score += r.score / decks.length
        totals.set(key, t)
      }
    }
  }

  return [...totals.values()].sort((a, b) => b.score - a.score)
}
