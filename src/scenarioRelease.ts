// Career scenarios from data/scenarios.json (scripts/lib/scenarios.js), for the app: lookups, and
// whether one has launched on a server. Launched: a known start date (not a prediction) that has
// passed. Scenario pickers set unlaunched ones in italics. Keys the file doesn't know count as launched
// (nothing to say otherwise).

import scenarioData from '../data/scenarios.json' with { type: 'json' };
import type { Scenario } from '../shared/schemas/scenario.ts';
import type { Server } from './servers.ts';

// In JP launch order.
// TODO(ts): the JSON import types the tags and servers' fields wider than the schema; test/schemas.test.ts checks the
// file against ScenariosFileSchema.
export const SCENARIOS = scenarioData.scenarios as Scenario[];
export const DATE_FIELD = { gl: 'en_start_date', jp: 'jp_start_date' } as const;
const BY_KEY = new Map(SCENARIOS.map((s) => [s.key, s]));

export const scenarioByKey = (key: string): Scenario | null => BY_KEY.get(key) ?? null;

export function isReleased(key: string, server: Server, now: number = Date.now()): boolean {
  const scenario = BY_KEY.get(key);
  if (!scenario) return true;
  const start = scenario[DATE_FIELD[server]];
  return !!start && start.tag !== 'predicted' && Date.parse(start.date) <= now;
}

// Whether the scenario is the one running on the server at `now`: launched, and the next one
// (by that server's launch dates) hasn't.
export function isCurrent(key: string, server: Server, now: number = Date.now()): boolean {
  if (!BY_KEY.has(key) || !isReleased(key, server, now)) return false;
  const field = DATE_FIELD[server];
  const launch = BY_KEY.get(key)?.[field];
  if (!launch) return false; // unreachable: isReleased() needs a launch date
  const start = Date.parse(launch.date);
  return !SCENARIOS.some((s) => {
    const next = s[field];
    return !!next && isReleased(s.key, server, now) && Date.parse(next.date) > start;
  });
}
