// Each scenario runs from its launch to the next one's (end null for the newest); times in ms.
import type { Scenario } from '../../shared/schemas/scenario.ts';
import { type LaunchTag, launchTag } from '../lib/scenarioRelease.ts';
import { type Ink, ink } from '../lib/vividColor.ts';

const DATE_FIELD = { gl: 'en_start_date', jp: 'jp_start_date' } as const;

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
