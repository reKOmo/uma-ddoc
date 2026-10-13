// Ranks every support card of one stat type for a scenario. Usage:
//   import { rankByUsefulness } from './tierlist/index.ts'
//   const ranking = await rankByUsefulness('gl', 'GL', 'speed')
// or from the shell:  node tierlist/cli.js gl GL speed
//
// server: 'gl' | 'jp'
// scenario: getServerConfig(server).availableScenarios, or a COMBINED key
// stat: one of STATS

import { processCards } from './tierlist-calc.ts';
import { getScenario, getScenarios, getServerConfig } from './scenarios.ts';
import { type Server, loadCards, loadCardsWithUpcoming } from './cards.ts';
import type { JoinedCard } from './join-cards.ts';

// The stat tabs every scenario defines (display names live in src/i18n).
export const STATS = ['speed', 'stamina', 'power', 'guts', 'wisdom', 'friend'] as const;
export type Stat = (typeof STATS)[number];

// A ranked card: processCards' output, sorted by score.
export type Ranked = { id: number; lb: number; char_name: string; score: number };

// A scenario's weights (scenarios.ts' per-stat and general weights, merged).
type Weights = Record<string, unknown>;

// Rankings that average several scenarios, offered next to the real ones.
// availableScenarios lists scenarios newest first and defaultScenario is the
// server's current one, so "upcoming" is the current scenario plus every newer
// one the server doesn't have yet.
export const COMBINED: Record<string, { scenarios: (server: Server) => string[] }> = {
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
function definedScenarios(server: Server): string[] {
  const defined = getScenarios(server);
  return getServerConfig(server).availableScenarios.filter((key: string) => key in defined);
}

// Every scenario key the UI offers: the real ones, then the combined ones.
export function scenarioOptions(server: Server): string[] {
  return [...getServerConfig(server).availableScenarios, ...Object.keys(COMBINED)];
}

// The scenarios a combined ranking averages; a real scenario is just itself.
export const scenariosOf = (server: Server, key: string): string[] =>
  COMBINED[key] ? COMBINED[key].scenarios(server) : [key];

// The site's default deck plus its named presets, as card ids.
export function presetDecks(server: Server): { key: string; cards: number[] }[] {
  const config = getServerConfig(server);
  return [{ key: 'default', cards: config.defaultPresetCards }, ...config.deckPresets];
}

async function setup(
  server: Server,
  scenario: string,
  stat: Stat,
  upcoming?: boolean
): Promise<{ weights: Weights; candidates: JoinedCard[]; toDeck: (ids: number[]) => JoinedCard[] }> {
  const cards = await (upcoming ? loadCardsWithUpcoming(server) : loadCards(server));
  const preset = getScenario(server, scenario);
  const weights: Weights = { ...preset[stat], ...preset.general };
  const candidates = cards.filter((c) => c.type === weights.type);
  // TODO(ts): a preset deck's card is always in the server's cards (the calculation fails on a missing one, as before).
  const toDeck = (ids: number[]) =>
    ids.map((id) => cards.find((c) => c.id === id && c.limit_break === 4) as JoinedCard);
  return { weights, candidates, toDeck };
}

// The upstream tier list: each card's value when added to one deck of 5 MLB
// cards (deckIds), defaulting to the site's preset deck.
export async function rankCards(server: Server, scenario: string, stat: Stat, deckIds?: number[]): Promise<Ranked[]> {
  const { weights, candidates, toDeck } = await setup(server, scenario, stat);
  const ids = deckIds ?? getServerConfig(server).defaultPresetCards;
  return processCards(candidates, weights, toDeck(ids));
}

// Deck-independent ranking: a card's score is its average value across the
// site's default deck and all its deck presets. The game forbids two cards of
// the same character, so when a deck already holds the candidate's character
// the candidate is scored against the remaining 4 cards instead.
// A COMBINED key ranks by the average over its scenarios (see computeCombined).
// { upcoming: true } also ranks JP's cards the server doesn't have yet (see
// loadCardsWithUpcoming); every other card keeps exactly the score it has without them.
// Results are cached per server/scenario/stat/upcoming.
const usefulnessCache = new Map<string, Promise<Ranked[]>>();

export function rankByUsefulness(
  server: Server,
  scenario: string,
  stat: Stat,
  { upcoming = false }: { upcoming?: boolean } = {}
): Promise<Ranked[]> {
  const key = `${server}/${scenario}/${stat}${upcoming ? '/upcoming' : ''}`;
  const cached = usefulnessCache.get(key);
  if (cached) return cached;
  const compute = COMBINED[scenario] ? computeCombined : computeUsefulness;
  const ranking = compute(server, scenario, stat, upcoming);
  usefulnessCache.set(key, ranking);
  return ranking;
}

// Scores aren't comparable across scenarios, so each scenario's ranking is
// rescaled to 0 (its lowest card) – 1000 (its top card) and those are averaged.
// Every scenario ranks the same candidates, so each card gets one per scenario.
// With upcoming cards the scale still comes from the server's own cards, so theirs
// don't move (an upcoming card can score above 1000).
async function computeCombined(server: Server, key: string, stat: Stat, upcoming: boolean): Promise<Ranked[]> {
  const scenarios = COMBINED[key].scenarios(server);
  const totals = new Map<string, Ranked>();
  for (const scenario of scenarios) {
    // Yield between scenarios (each blocks for ~100-300 ms) so the UI can paint.
    await new Promise((resolve) => setTimeout(resolve));
    const ranking = await rankByUsefulness(server, scenario, stat, { upcoming });
    const own = upcoming ? await rankByUsefulness(server, scenario, stat) : ranking;
    const top = own[0].score;
    const range = top - own[own.length - 1].score || 1;
    for (const r of ranking) {
      const id = `${r.id}/${r.lb}`;
      const t = totals.get(id) ?? { id: r.id, lb: r.lb, char_name: r.char_name, score: 0 };
      t.score += (1000 * (1 - (top - r.score) / range)) / scenarios.length;
      totals.set(id, t);
    }
  }
  return [...totals.values()].sort((a, b) => b.score - a.score);
}

async function computeUsefulness(server: Server, scenario: string, stat: Stat, upcoming: boolean): Promise<Ranked[]> {
  const { weights, candidates, toDeck } = await setup(server, scenario, stat, upcoming);
  const decks = presetDecks(server).map((d) => toDeck(d.cards));

  const totals = new Map<string, Ranked>();
  for (const deck of decks) {
    // Group candidates by the deck they'll actually be scored against.
    const groups = new Map<string, { deck: JoinedCard[]; cards: JoinedCard[] }>();
    for (const card of candidates) {
      const own = deck.filter((c) => c.char_name !== card.char_name);
      const key = own.map((c) => c.id).join();
      const group = groups.get(key) ?? { deck: own, cards: [] };
      groups.set(key, group);
      group.cards.push(card);
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
