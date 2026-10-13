// @ts-nocheck
// The app's dropdown (src/Dropdown.jsx) and the scenario one built on it (src/ScenarioPicker.jsx),
// closed, rendered to markup. (No DOM in the test setup, so opening and the keyboard aren't covered.)

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import '../src/i18n/index.ts';
import Dropdown from '../src/Dropdown.tsx';
import ScenarioPicker, { scenarioPickerOptions } from '../src/ScenarioPicker.tsx';
import i18n from '../src/i18n/index.ts';
import { isCurrent } from '../src/scenarioRelease.ts';
import { isReleased } from '../src/scenarioRelease.ts';

describe('Dropdown', () => {
  it('is a labelled listbox button showing the selected option', () => {
    const html = renderToStaticMarkup(
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
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/class="dropdown-button"[^>]*>.*Power/);
  });
});

describe('ScenarioPicker', () => {
  const render = (value, server) =>
    renderToStaticMarkup(
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
    for (const server of ['gl', 'jp']) {
      const html = render('GM', server);
      if (isReleased('GM', server)) {
        expect(html).toContain('class="dropdown-button"');
      } else {
        expect(html).toContain('class="dropdown-button italic"');
        expect(html).toContain('title="Not released yet"');
      }
    }
    expect(isReleased('GM', 'jp')).toBe(true);
    expect(render('GL', 'gl')).toContain('class="dropdown-button"');
  });
});

describe('scenarioPickerOptions', () => {
  it('badges the scenario running now on the server, and only it', () => {
    const scenarios = ['DYI', 'GM', 'GL', 'MANT', 'Aoharu', 'URA'];
    for (const server of ['gl', 'jp']) {
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
