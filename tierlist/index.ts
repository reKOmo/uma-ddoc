import { processCards } from './tierlist-calc.ts';
import { getScenario, getScenarios, getServerConfig } from './scenarios.ts';
import { type Server, loadCards, loadCardsWithUpcoming } from './cards.ts';
import type { JoinedCard } from './join-cards.ts';
import type { CalcWeights } from './tierlist-calc.ts';

// Display names live in src/i18n.
export const STATS = ['speed', 'stamina', 'power', 'guts', 'wisdom', 'friend'] as const;
export type Stat = (typeof STATS)[number];

export type Ranked = { id: number; lb: number; char_name: string; score: number };

// "upcoming" averages the server's current scenario and every newer one (availableScenarios is newest first).
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

// availableScenarios can name one the server has no weights for (Global's DYI); getScenario would silently use the
// default's, counting it twice in an average.
function definedScenarios(server: Server): string[] {
  const defined = getScenarios(server);
  return getServerConfig(server).availableScenarios.filter((key: string) => key in defined);
}

export function scenarioOptions(server: Server): string[] {
  return [...getServerConfig(server).availableScenarios, ...Object.keys(COMBINED)];
}

export const scenariosOf = (server: Server, key: string): string[] =>
  COMBINED[key] ? COMBINED[key].scenarios(server) : [key];

export function presetDecks(server: Server): { key: string; cards: number[] }[] {
  const config = getServerConfig(server);
  return [{ key: 'default', cards: config.defaultPresetCards }, ...config.deckPresets];
}

async function setup(
  server: Server,
  scenario: string,
  stat: Stat,
  upcoming?: boolean
): Promise<{ weights: CalcWeights; candidates: JoinedCard[]; toDeck: (ids: number[]) => JoinedCard[] }> {
  const cards = await (upcoming ? loadCardsWithUpcoming(server) : loadCards(server));
  const preset = getScenario(server, scenario);
  const weights: CalcWeights = { ...preset[stat], ...preset.general };
  const candidates = cards.filter((c) => c.type === weights.type);
  // TODO(ts): a preset deck's card is always in the server's cards (the calculation fails on a missing one, as before).
  const toDeck = (ids: number[]) =>
    ids.map((id) => cards.find((c) => c.id === id && c.limit_break === 4) as JoinedCard);
  return { weights, candidates, toDeck };
}

// Each card's value when added to one deck (deckIds, default: the site's preset deck).
export async function rankCards(server: Server, scenario: string, stat: Stat, deckIds?: number[]): Promise<Ranked[]> {
  const { weights, candidates, toDeck } = await setup(server, scenario, stat);
  const ids = deckIds ?? getServerConfig(server).defaultPresetCards;
  return processCards(candidates, weights, toDeck(ids));
}

// A card's score is its average value across the site's default deck and all its presets. The game forbids two cards
// of one character, so a deck holding the candidate's character scores it against the other 4 cards.
// { upcoming: true } adds JP's cards the server lacks (loadCardsWithUpcoming); other cards keep their scores.
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

// Scores aren't comparable across scenarios, so each is rescaled to 0 (its lowest card) – 1000 (its top card) and
// those are averaged. Upcoming cards don't move the scale (so they can score above 1000).
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
