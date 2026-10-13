// @vitest-environment jsdom
// The app's dropdown (src/Dropdown.tsx) and the scenario one built on it (src/ScenarioPicker.tsx),
// closed (opening and choosing: dropdown.test.tsx).

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '../src/i18n/index.ts';
import Dropdown from '../src/Dropdown.tsx';
import ScenarioPicker, { scenarioPickerOptions } from '../src/ScenarioPicker.tsx';
import i18n from '../src/i18n/index.ts';
import { isCurrent } from '../src/scenarioRelease.ts';
import { isReleased } from '../src/scenarioRelease.ts';

afterEach(cleanup);

describe('Dropdown', () => {
  it('is a labelled combobox showing the selected option', () => {
    render(
      <Dropdown
        label="Stat"
        value="power"
        options={[
          { value: 'speed', label: 'Speed' },
          { value: 'power', label: 'Power' },
        ]}
        onChange={() => {}}
      />
    );
    const button = screen.getByRole('combobox', { name: /Stat/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toContain('Power');
  });
});

describe('ScenarioPicker', () => {
  const show = (value: string, server: 'gl' | 'jp') =>
    render(
      <ScenarioPicker
        label="Scenario"
        value={value}
        scenarios={['GM', 'GL']}
        combined={['overall']}
        server={server}
        onChange={() => {}}
      />
    );

  it('sets a scenario the server hasn\'t launched in italics, with a "Not released yet" hint', () => {
    // Whatever the data says today: GM is out on JP, and on Global once it launches there.
    for (const server of ['gl', 'jp'] as const) {
      const { unmount } = show('GM', server);
      const button = screen.getByRole('combobox', { name: /Scenario/ });
      if (isReleased('GM', server)) {
        expect(button.hasAttribute('title')).toBe(false);
      } else {
        expect(button.getAttribute('title')).toBe('Not released yet');
      }
      unmount();
    }
    expect(isReleased('GM', 'jp')).toBe(true);
    show('GL', 'gl');
    expect(screen.getByRole('combobox').hasAttribute('title')).toBe(false);
  });
});

describe('scenarioPickerOptions', () => {
  it('badges the scenario running now on the server, and only it', () => {
    const scenarios = ['DYI', 'GM', 'GL', 'MANT', 'Aoharu', 'URA'];
    for (const server of ['gl', 'jp'] as const) {
      const options = scenarioPickerOptions({ scenarios, combined: ['overall'], server, t: i18n.t });
      const badged = options.filter((o) => o.badge === 'Current').map((o) => o.value);
      expect(badged).toEqual(scenarios.filter((key) => isCurrent(key, server)));
      expect(badged.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('scenarioPickerOptions: scenarios the tier list lacks', () => {
  it('lists every scenario newest first, the unranked ones disabled with a note', () => {
    const scenarios = ['DYI', 'GM', 'GL', 'MANT', 'Aoharu', 'URA'];
    const options = scenarioPickerOptions({ scenarios, combined: [], server: 'gl', t: i18n.t });
    expect(options.map((o) => o.value)).toEqual([
      'TracenKen',
      'BD',
      'Onsen',
      'DYI',
      'TL',
      'Mecha',
      'GFF',
      'UAF',
      'LArc',
      'GM',
      'GL',
      'MANT',
      'Aoharu',
      'URA',
    ]);
    const disabled = options.filter((o) => o.disabled);
    expect(disabled.map((o) => o.value).sort()).toEqual([
      'BD',
      'GFF',
      'LArc',
      'Mecha',
      'Onsen',
      'TL',
      'TracenKen',
      'UAF',
    ]);
    expect(disabled.every((o) => o.note === 'Not in the tier list yet' && !o.badge)).toBe(true);
    expect(options.filter((o) => !o.disabled).map((o) => o.value)).toEqual(scenarios);
  });
});
