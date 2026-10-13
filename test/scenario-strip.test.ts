// The Career scenario strip on the banner calendar (src/timeline/scenarioStrip.js).

import { describe, it, expect } from 'vitest';
import { scenarioSegments } from '../src/timeline/scenarioStrip.ts';
import type { Scenario, StartDate } from '../shared/schemas/scenario.ts';
import { fixture } from './helpers.ts';

const date = (iso: string, tag: StartDate['tag']) => ({ date: iso, tag });
// (only the fields the strip reads)
const SCENARIOS = fixture<Scenario[]>([
  {
    key: 'GL',
    full_en: 'Brighter Together! Our Grand Concert',
    full_jp: 'グランドライブ',
    en_start_date: date('2026-07-22T22:00:00.000Z', 'out'),
    jp_start_date: date('2022-08-24T03:00:00.000Z', 'out'),
    color: '#8c4f75',
  },
  {
    key: 'GM',
    full_en: null,
    full_jp: 'グランドマスターズ',
    en_start_date: date('2026-11-25T22:00:00.000Z', 'predicted'),
    jp_start_date: date('2023-02-24T03:00:00.000Z', 'out'),
    color: '#fae15a',
  },
  {
    key: 'LArc',
    full_en: null,
    full_jp: 'L’Arc',
    en_start_date: null,
    jp_start_date: date('2023-08-24T03:00:00.000Z', 'out'),
  },
]);

describe('scenarioSegments', () => {
  it("runs each scenario to the next one's launch on Global, marking the current one", () => {
    const now = Date.parse('2026-10-08T00:00:00Z');
    expect(scenarioSegments(SCENARIOS, 'gl', now)).toEqual([
      {
        key: 'GL',
        name: 'Brighter Together! Our Grand Concert',
        start: Date.parse('2026-07-22T22:00:00.000Z'),
        end: Date.parse('2026-11-25T22:00:00.000Z'),
        tag: 'out',
        current: true,
        color: '#8c4f75',
        ink: 'light',
      },
      // No English name yet: the Japanese one.
      {
        key: 'GM',
        name: 'グランドマスターズ',
        start: Date.parse('2026-11-25T22:00:00.000Z'),
        end: null,
        tag: 'predicted',
        current: false,
        color: '#fae15a',
        ink: 'dark',
      },
    ]);
  });

  it("uses JP's launches on JP", () => {
    const segments = scenarioSegments(SCENARIOS, 'jp', Date.parse('2026-10-08T00:00:00Z'));
    expect(segments.map((s) => [s.key, s.current, s.color])).toEqual([
      ['GL', false, '#8c4f75'],
      ['GM', false, '#fae15a'],
      ['LArc', true, null],
    ]);
  });
});
