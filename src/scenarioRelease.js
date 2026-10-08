// Career scenarios from data/scenarios.json (scripts/lib/scenarios.js), for the app: lookups, and
// whether one has launched on a server. Launched: a known start date (not a prediction) that has
// passed. Scenario pickers set unlaunched ones in italics. Keys the file doesn't know count as launched
// (nothing to say otherwise).

import scenarioData from '../data/scenarios.json' with { type: 'json' };

// In JP launch order.
export const SCENARIOS = scenarioData.scenarios;
export const DATE_FIELD = { gl: 'en_start_date', jp: 'jp_start_date' };
const BY_KEY = new Map(SCENARIOS.map((s) => [s.key, s]));

export const scenarioByKey = (key) => BY_KEY.get(key) ?? null;

export function isReleased(key, server, now = Date.now()) {
  const scenario = BY_KEY.get(key);
  if (!scenario) return true;
  const start = scenario[DATE_FIELD[server]];
  return !!start && start.tag !== 'predicted' && Date.parse(start.date) <= now;
}

// Whether the scenario is the one running on the server at `now`: launched, and the next one
// (by that server's launch dates) hasn't.
export function isCurrent(key, server, now = Date.now()) {
  if (!BY_KEY.has(key) || !isReleased(key, server, now)) return false;
  const field = DATE_FIELD[server];
  const start = Date.parse(BY_KEY.get(key)[field].date);
  return !SCENARIOS.some((s) => s[field] && isReleased(s.key, server, now) && Date.parse(s[field].date) > start);
}
