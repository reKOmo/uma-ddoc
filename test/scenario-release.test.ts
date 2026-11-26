import { describe, it, expect } from 'vitest';
import { isReleased } from '../shared/scenarioRelease.ts';
import { getCurrentScenario, scenarioAt } from '../tierlist/scenarios.ts';
import scenarioData from '../data/scenarios.json' with { type: 'json' };
import { present } from './helpers.ts';

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

describe('getCurrentScenario', () => {
  const at = (date: string) => Date.parse(`${date}T00:00:00Z`);

  it("is the ranked scenario running, by each server's launch dates", () => {
    expect(getCurrentScenario('gl', at('2026-03-01'))).toBe('Aoharu');
    expect(getCurrentScenario('gl', at('2026-08-01'))).toBe('GL');
  });

  it('is the newest launched ranked one while the one running is not ranked', () => {
    // JP runs a newer scenario than any the tier list ranks.
    expect(getCurrentScenario('jp', at('2026-11-01'))).toBe('DYI');
  });
});

describe('scenarioAt', () => {
  it('counts predicted launches for a date still to come', () => {
    const gm = present(scenarioData.scenarios.find((s) => s.key === 'GM')?.en_start_date, 'GM launch');
    expect(scenarioAt(Date.parse(gm.date) + 1, 'gl')).toBe('GM');
    expect(scenarioAt(Date.parse(gm.date) - 1, 'gl')).toBe('GL');
  });
});
