// @vitest-environment jsdom
// The Settings page: its settings as toggle groups, and its About section (src/pages/SettingsPage.tsx).

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../src/i18n/index.ts';
import SettingsPage from '../src/pages/SettingsPage.tsx';
import { DEFAULTS, getSettings, setSetting } from '../src/settingsStore.ts';
import pkg from '../package.json' with { type: 'json' };

beforeEach(() => {
  setSetting('timeZone', DEFAULTS.timeZone);
  setSetting('scenarioNames', DEFAULTS.scenarioNames);
  setSetting('jpNewsLanguage', DEFAULTS.jpNewsLanguage);
});
afterEach(cleanup);

describe('SettingsPage', () => {
  const html = renderToStaticMarkup(<SettingsPage />);

  it('shows the version and the disclaimer', () => {
    expect(html).toContain(`Umaddoc ${pkg.version}`);
    expect(html).toContain('Umaddoc is not affiliated with the developers of Umamusume: Pretty Derby.');
    expect(html).toContain('copyrights of Cygames, Inc.');
  });

  it('credits GameTora and the original tier list', () => {
    expect(html).toContain('href="https://gametora.com/umamusume"');
    expect(html).toContain('href="https://euophrys.github.io/uma-tiers/"');
  });

  it('names each setting group by its heading, one button pressed in each', () => {
    render(<SettingsPage />);
    const times = screen.getByRole('group', { name: 'Banner times' });
    const pressed = within(times).getByRole('button', { pressed: true });
    expect(pressed.textContent).toContain('UTC');
    expect(within(times).getByRole('button', { name: /Local/ }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('group', { name: 'Scenario names' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'JP news on umapyoi.net' })).toBeTruthy();
  });

  it('stores the chosen option when its button is clicked', () => {
    render(<SettingsPage />);
    const times = () => screen.getByRole('group', { name: 'Banner times' });
    fireEvent.click(within(times()).getByRole('button', { name: /Local/ }));
    expect(getSettings().timeZone).toBe('local');
    expect(within(times()).getByRole('button', { name: /Local/ }).getAttribute('aria-pressed')).toBe('true');
  });
});
