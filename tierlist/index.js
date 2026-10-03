// Ranks every support card of one stat type for a scenario. Usage:
//   import { rankByUsefulness } from './tierlist/index.js'
//   const ranking = await rankByUsefulness('gl', 'GL', 'speed')
// or from the shell:  node tierlist/cli.js gl GL speed
//
// server: 'gl' | 'jp'
// scenario: getServerConfig(server).availableScenarios, or a COMBINED key
// stat: one of STATS

import { processCards } from './tierlist-calc.js';
import { getScenario, getScenarios, getServerConfig } from './scenarios.js';
import { loadCards } from './cards.js';

// The stat tabs every scenario defines (display names live in src/i18n).
export const STATS = ['speed', 'stamina', 'power', 'guts', 'wisdom', 'friend'];

// Rankings that average several scenarios, offered next to the real ones.
// availableScenarios lists scenarios newest first and defaultScenario is the
// server's current one, so "upcoming" is the current scenario plus every newer
// one the server doesn't have yet.
export const COMBINED = {
  overall: { scenarios: (server) => definedScenarios(server) },
  upcoming: {
    scenarios: (server) => {
      const all = definedScenarios(server);
      const current = all.indexOf(getServerConfig(server).defaultScenario);
      return all.slice(0, current + 1);
    },
  },
};

// Scenarios the server really defines. availableScenarios can name one the
// server has no weights for (Global's DYI); getScenario would silently use the
// default scenario's, which would count that scenario twice in an average.
function definedScenarios(server) {
  const defined = getScenarios(server);
  return getServerConfig(server).availableScenarios.filter((key) => key in defined);
}

// Every scenario key the UI offers: the real ones, then the combined ones.
export function scenarioOptions(server) {
  return [...getServerConfig(server).availableScenarios, ...Object.keys(COMBINED)];
}

// The scenarios a combined ranking averages; a real scenario is just itself.
export const scenariosOf = (server, key) => (COMBINED[key] ? COMBINED[key].scenarios(server) : [key]);

// The site's default deck plus its named presets, as card ids.
export function presetDecks(server) {
  const config = getServerConfig(server);
  return [{ key: 'default', cards: config.defaultPresetCards }, ...config.deckPresets];
}

async function setup(server, scenario, stat) {
  const cards = await loadCards(server);
  const preset = getScenario(server, scenario);
  const weights = { ...preset[stat], ...preset.general };
  const candidates = cards.filter((c) => c.type === weights.type);
  const toDeck = (ids) => ids.map((id) => cards.find((c) => c.id === id && c.limit_break === 4));
  return { weights, candidates, toDeck };
}

// The upstream tier list: each card's value when added to one deck of 5 MLB
// cards (deckIds), defaulting to the site's preset deck.
export async function rankCards(server, scenario, stat, deckIds) {
  const { weights, candidates, toDeck } = await setup(server, scenario, stat);
  const ids = deckIds ?? getServerConfig(server).defaultPresetCards;
  return processCards(candidates, weights, toDeck(ids));
}

// Deck-independent ranking: a card's score is its average value across the
// site's default deck and all its deck presets. The game forbids two cards of
// the same character, so when a deck already holds the candidate's character
// the candidate is scored against the remaining 4 cards instead.
// A COMBINED key ranks by the average over its scenarios (see computeCombined).
// Results are cached per server/scenario/stat.
const usefulnessCache = new Map();

export function rankByUsefulness(server, scenario, stat) {
  const key = `${server}/${scenario}/${stat}`;
  if (!usefulnessCache.has(key)) {
    const compute = COMBINED[scenario] ? computeCombined : computeUsefulness;
    usefulnessCache.set(key, compute(server, scenario, stat));
  }
  return usefulnessCache.get(key);
}

// Scores aren't comparable across scenarios, so each scenario's ranking is
// rescaled to 0 (its lowest card) – 1000 (its top card) and those are averaged.
// Every scenario ranks the same candidates, so each card gets one per scenario.
async function computeCombined(server, key, stat) {
  const scenarios = COMBINED[key].scenarios(server);
  const totals = new Map();
  for (const scenario of scenarios) {
    // Yield between scenarios (each blocks for ~100-300 ms) so the UI can paint.
    await new Promise((resolve) => setTimeout(resolve));
    const ranking = await rankByUsefulness(server, scenario, stat);
    const top = ranking[0].score;
    const range = top - ranking[ranking.length - 1].score || 1;
    for (const r of ranking) {
      const id = `${r.id}/${r.lb}`;
      const t = totals.get(id) ?? { id: r.id, lb: r.lb, char_name: r.char_name, score: 0 };
      t.score += (1000 * (1 - (top - r.score) / range)) / scenarios.length;
      totals.set(id, t);
    }
  }
  return [...totals.values()].sort((a, b) => b.score - a.score);
}

async function computeUsefulness(server, scenario, stat) {
  const { weights, candidates, toDeck } = await setup(server, scenario, stat);
  const decks = presetDecks(server).map((d) => toDeck(d.cards));

  const totals = new Map();
  for (const deck of decks) {
    // Group candidates by the deck they'll actually be scored against.
    const groups = new Map();
    for (const card of candidates) {
      const own = deck.filter((c) => c.char_name !== card.char_name);
      const key = own.map((c) => c.id).join();
      if (!groups.has(key)) groups.set(key, { deck: own, cards: [] });
      groups.get(key).cards.push(card);
    }
    for (const group of groups.values()) {
      for (const r of processCards(group.cards, weights, group.deck)) {
        const key = `${r.id}/${r.lb}`;
        const t = totals.get(key) ?? { id: r.id, lb: r.lb, char_name: r.char_name, score: 0 };
        t.score += r.score / decks.length;
        totals.set(key, t);
      }
    }
  }

  return [...totals.values()].sort((a, b) => b.score - a.score);
}
