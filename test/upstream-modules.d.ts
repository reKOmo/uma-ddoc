// Typed with our own types: test/data.test.ts and test/upstream/parity.test.ts check they rebuild upstream's modules exactly.

declare module '*/raw/upstream/gl.js' {
  const cards: import('../scripts/lib/cards.ts').UpstreamCard[];
  export default cards;
}
declare module '*/raw/upstream/jp.js' {
  const cards: import('../scripts/lib/cards.ts').UpstreamCard[];
  export default cards;
}
declare module '*/raw/upstream/card-events.js' {
  const events: Record<string, number[]>;
  export default events;
}

declare module '*/upstream/src/cards/gl.js' {
  const cards: import('../scripts/lib/cards.ts').UpstreamCard[];
  export default cards;
}
declare module '*/upstream/src/cards/jp.js' {
  const cards: import('../scripts/lib/cards.ts').UpstreamCard[];
  export default cards;
}
declare module '*/upstream/src/components/tierlist-calc.js' {
  type Card = import('../tierlist/tierlist-calc.ts').CalcCard;
  // Upstream also returns a per-card breakdown (`info`) for its UI.
  export function processCards(
    cards: Card[],
    weights: import('../tierlist/tierlist-calc.ts').CalcWeights,
    deck: Card[]
  ): (import('../tierlist/tierlist-calc.ts').ProcessedCard & { info: unknown })[];
}
declare module '*/upstream/src/scenarios.js' {
  export function getScenario(server: string, scenario: string): import('../tierlist/scenarios.ts').ScenarioWeights;
  export function getServerConfig(server: string): import('../tierlist/scenarios.ts').ServerConfig;
}
