// Each scenario runs from its launch to the next one's (end null for the newest); times in ms.
import type { Scenario } from '../../shared/schemas/scenario.ts';
import { type LaunchTag, launchTag } from '../scenarioRelease.ts';

const DATE_FIELD = { gl: 'en_start_date', jp: 'jp_start_date' } as const;

export type Ink = 'dark' | 'light';

export type ScenarioSegment = {
  key: string;
  name: string;
  start: number;
  end: number | null;
  tag: LaunchTag;
  color: string | null;
  current: boolean;
  ink: Ink | null;
};

// WCAG relative luminance: dark text above ~0.4.
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
              tag: launchTag(launch, now),
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
