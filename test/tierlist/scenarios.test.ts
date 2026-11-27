import { describe, it, expect } from 'vitest';
import { getCurrentScenario, scenarioAt } from '../../tierlist/scenarios.ts';
import scenarioData from '../../data/scenarios.json' with { type: 'json' };
import { present } from '../helpers.ts';

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
