// The new Career scenarios a news post (data/news/posts.json, as the API sends it) names, for Global's scenario
// launches (scripts/lib/scenarios.js applyScenarioNews()). Pure.
//
// scenarioPost(post) → { posted, scenarios: [{ full, start }] }: 'the new Career scenario "X" has been added', 'A new
// career scenario, titled "X," will be added … at 10:00 p.m., Jul 22, 2026 (UTC)', 'the new "X" Career Scenario'. Only
// these phrasings: plain "scenario" shows up all over (known issues, scout fine print). start: the time in the same
// sentence when it says the scenario is added / begins, else null.

import { apiDate, decodeEntities, parsePeriod, toLines } from './news-text.js';
import { norm } from './event-rewards.js';

const SCENARIO_RE = [
  /new career scenario,?\s*(?:titled\s*)?["“]([^"”]+?)[\s,]*["”]/i,
  /new\s*["“]([^"”]+?)[\s,]*["”]\s*career scenario/i,
];

export function scenarioPost(post) {
  const posted = apiDate(post.post_at);
  const year = posted ? new Date(posted).getUTCFullYear() : new Date().getUTCFullYear();
  const found = new Map();
  for (const line of [decodeEntities(post.title), ...toLines(post.message ?? '')]) {
    const match = SCENARIO_RE.map((re) => line.match(re)).find(Boolean);
    if (!match) continue;
    const full = match[1].trim();
    const dated = /\b(added|begins?|launch(es|ed)?)\b/i.test(line) && /\d{1,2}:\d{2}\s*[ap]\.?m/i.test(line);
    const start = dated ? parsePeriod(line, year).start : null;
    const mention = found.get(norm(full)) ?? { full, start: null };
    if (start && !mention.start) mention.start = start;
    found.set(norm(full), mention);
  }
  return { posted, scenarios: [...found.values()] };
}
