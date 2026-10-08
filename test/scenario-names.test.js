// Scenario short names (scenarioName() in src/i18n) under the "Scenario names" setting.

import { afterEach, describe, it, expect } from 'vitest';
import { scenarioName } from '../src/i18n/index.js';
import { setSetting } from '../src/settingsStore.js';

afterEach(() => setSetting('scenarioNames', 'global'));

describe('scenarioName', () => {
  it("uses Global's short names, JP's where Global has none yet", () => {
    setSetting('scenarioNames', 'global');
    expect(['URA', 'Aoharu', 'MANT', 'GL', 'GM', 'Onsen'].map(scenarioName)).toEqual([
      'URA',
      'Unity',
      'TB',
      'GC',
      'GM',
      'YHS',
    ]);
  });

  it("uses JP's short names when set to JP", () => {
    setSetting('scenarioNames', 'jp');
    expect(['Aoharu', 'MANT', 'GL', 'LArc', 'TracenKen'].map(scenarioName)).toEqual([
      'Aoharu',
      'MANT',
      'GL',
      "L'Arc",
      'Tracen-ken',
    ]);
  });

  it('names the averaged rankings, and falls back to the key', () => {
    expect(scenarioName('overall')).toBe('Overall');
    expect(scenarioName('NOPE')).toBe('NOPE');
  });

  it('ignores values that are not an option', () => {
    setSetting('scenarioNames', 'nonsense');
    expect(scenarioName('Aoharu')).toBe('Unity');
  });
});
