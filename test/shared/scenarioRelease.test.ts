import { describe, it, expect } from 'vitest';
import { SCENARIOS, isCurrent, isReleased } from '../../shared/scenarioRelease.ts';
import scenarioData from '../../data/scenarios.json' with { type: 'json' };
import { present } from '../helpers.ts';

describe('isReleased', () => {
  const now = Date.parse('2026-10-08T00:00:00Z');

  it('follows each server: out means launched, a prediction never does', () => {
    const gm = present(
      scenarioData.scenarios.find((s) => s.key === 'GM'),
      'GM'
    );
    expect(isReleased('GL', 'gl', now)).toBe(true);
    expect(isReleased('GM', 'jp', now)).toBe(true);
    expect(isReleased('GM', 'gl', now)).toBe(
      gm.en_start_date?.status !== 'predicted' && Date.parse(present(gm.en_start_date, 'GM launch').date) <= now
    );
    expect(isReleased('GM', 'gl', Date.parse('2030-01-01T00:00:00Z'))).toBe(gm.en_start_date?.status !== 'predicted');
  });

  it("counts keys it doesn't know as launched", () => {
    expect(isReleased('NOPE', 'gl', now)).toBe(true);
  });
});

describe('isCurrent', () => {
  it('is the newest launched scenario on each server, exactly one', () => {
    for (const server of ['gl', 'jp'] as const) {
      const current = SCENARIOS.filter((s) => isCurrent(s.key, server));
      expect(current).toHaveLength(1);
      expect(isReleased(current[0].key, server)).toBe(true);
    }
    expect(isCurrent('NOPE', 'gl')).toBe(false);
  });
});
