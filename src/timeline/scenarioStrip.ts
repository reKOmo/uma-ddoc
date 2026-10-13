// Which Career scenario runs when, for the strip at the top of the banner calendar. Pure.
//
// scenarioSegments(scenarios, server, now) → [{ key, name, start, end, tag, current, color, ink }]
//   scenarios  data/scenarios.json's list (scripts/lib/scenarios.js)
//   server     'gl' (en_start_date) | 'jp' (jp_start_date)
// Each scenario runs from its launch to the next one's (end null for the newest); times in ms.
// tag is the start date's ('out' | 'confirmed' | 'predicted'); current: running at `now`; color: its
// cover's main colour or null; ink: 'dark' | 'light',
// the text that reads on it.
import type { Scenario, StartDate } from '../../shared/schemas/scenario.ts';

const DATE_FIELD = { gl: 'en_start_date', jp: 'jp_start_date' } as const;

export type Ink = 'dark' | 'light';

export type ScenarioSegment = {
  key: string;
  name: string;
  start: number;
  end: number | null;
  tag: StartDate['tag'];
  color: string | null;
  current: boolean;
  ink: Ink | null;
};

// The text that reads on a scenario colour ("#rrggbb"): 'dark' | 'light' (null without a colour), by
// its relative luminance (WCAG), dark above ~0.4. Pair with the --ink-dark / --ink-light tokens.
export function ink(color: string | null): Ink | null {
  if (!color) return null;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? 'dark' : 'light';
}

export function scenarioSegments(
  scenarios: Scenario[],
  server: 'gl' | 'jp',
  now: number = Date.now()
): ScenarioSegment[] {
  const field = DATE_FIELD[server];
  const dated = scenarios
    .flatMap((s) => {
      const launch = s[field];
      return launch
        ? [
            {
              key: s.key,
              name: s.full_en ?? s.full_jp ?? s.key,
              start: Date.parse(launch.date),
              tag: launch.tag,
              color: s.color ?? null,
            },
          ]
        : [];
    })
    .sort((a, b) => a.start - b.start);
  return dated.map((s, i) => {
    const end = dated[i + 1]?.start ?? null;
    return { ...s, end, current: s.start <= now && (end === null || now < end), ink: ink(s.color) };
  });
}
