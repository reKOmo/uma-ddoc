// Whether a scenario has launched on a server (src/scenarioRelease.js), on the real data/scenarios.json.

import { describe, it, expect } from 'vitest';
import { isReleased } from '../src/scenarioRelease.js';
import scenarioData from '../data/scenarios.json' with { type: 'json' };

describe('isReleased', () => {
  const now = Date.parse('2026-10-08T00:00:00Z');

  it('follows each server: out means launched, a prediction never does', () => {
    const gm = scenarioData.scenarios.find((s) => s.key === 'GM');
    expect(isReleased('GL', 'gl', now)).toBe(true);
    expect(isReleased('GM', 'jp', now)).toBe(true);
    expect(isReleased('GM', 'gl', now)).toBe(
      gm.en_start_date?.tag !== 'predicted' && Date.parse(gm.en_start_date.date) <= now
    );
    expect(isReleased('GM', 'gl', Date.parse('2030-01-01T00:00:00Z'))).toBe(gm.en_start_date?.tag !== 'predicted');
  });

  it("counts keys it doesn't know as launched", () => {
    expect(isReleased('NOPE', 'gl', now)).toBe(true);
  });
});
