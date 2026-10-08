// The Settings page's About section (src/pages/SettingsPage.jsx), rendered to markup.

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import '../src/i18n/index.js';
import SettingsPage from '../src/pages/SettingsPage.jsx';
import pkg from '../package.json' with { type: 'json' };

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
});
