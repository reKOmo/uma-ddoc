// Each scenario runs from its launch to the next one's (end null for the newest); times in ms.
import type { Scenario } from '../../shared/schemas/scenario.ts';
import { DATE_FIELD, type LaunchTag, launchTag } from '../../shared/scenarioRelease.ts';
import type { Server } from './servers.ts';
import { type Ink, ink } from './vividColor.ts';

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

export function scenarioSegments(scenarios: Scenario[], server: Server, now: number = Date.now()): ScenarioSegment[] {
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
