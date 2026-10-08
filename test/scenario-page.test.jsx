// The scenario page (src/pages/ScenarioPage.jsx) rendered to markup, and isCurrent().

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import '../src/i18n/index.js';
import ScenarioPage from '../src/pages/ScenarioPage.jsx';
import { SCENARIOS, isCurrent, isReleased } from '../src/scenarioRelease.js';

const render = (key) => renderToStaticMarkup(<ScenarioPage scenarioKey={key} onScenarioChange={() => {}} />);

describe('isCurrent', () => {
  it('is the newest launched scenario on each server, exactly one', () => {
    for (const server of ['gl', 'jp']) {
      const current = SCENARIOS.filter((s) => isCurrent(s.key, server));
      expect(current).toHaveLength(1);
      expect(isReleased(current[0].key, server)).toBe(true);
    }
    expect(isCurrent('NOPE', 'gl')).toBe(false);
  });
});

describe('ScenarioPage', () => {
  it('shows names, both launches, GameTora and the tier list link', () => {
    const html = render('GL');
    expect(html).toContain('Brighter Together! Our Grand Concert');
    expect(html).toContain('lang="ja"');
    // One launch card: Japan on the left, the gap, Global on the right.
    expect(html).toMatch(
      /scenario-launch-side jp"><span[^>]*>Japan<.*scenario-launch-gap.*scenario-launch-side gl"><span[^>]*>Global</
    );
    expect(html).toMatch(/scenario-launch-gap">.*Launched after /);
    // GameTora under Links, after the launches.
    expect(html).toMatch(
      />Links<\/h2><ul class="scenario-links">.*https:\/\/gametora\.com\/umamusume\/our-grand-concert/
    );
    expect(html).toContain('Open its tier list');
  });

  it('shows a predicted launch with its range, and links to the scenarios around it', () => {
    const gm = SCENARIOS.find((s) => s.key === 'GM');
    const html = render('GM');
    if (gm.en_start_date?.tag === 'predicted') {
      expect(html).toContain('scenario-status predicted');
      expect(html).toContain('Could be');
      expect(html).toContain('Expected after');
    }
    expect(html).toContain('href="#/scenario/GL"');
  });

  it("hides the tier list link for scenarios the tier list doesn't rank, and handles unknown keys", () => {
    expect(render('TracenKen')).not.toContain('Open its tier list');
    expect(render('NOPE')).toContain('no scenario NOPE.');
  });
});

describe('ScenariosPage', () => {
  it('lists every scenario linking to its page, the running one marked', async () => {
    const { default: ScenariosPage } = await import('../src/pages/ScenariosPage.jsx');
    const html = renderToStaticMarkup(<ScenariosPage server="gl" />);
    for (const s of SCENARIOS) expect(html).toContain(`href="#/scenario/${s.key}"`);
    // Only the newest on the selected server is highlighted; both servers' newest get their pill.
    const newestOnGlobal = SCENARIOS.find((s) => isCurrent(s.key, 'gl')).key;
    expect(html.match(/scenario-item current/g)).toHaveLength(1);
    expect(html).toContain(`href="#/scenario/${newestOnGlobal}" class="scenario-item current"`);
    expect(html).toContain('Newest on Global');
    expect(html).toContain('Newest on Japan');
    expect(html).toContain('Japan: Launched');
    expect(html).toContain('Global: ');
  });
});

describe('ScenarioPage short names', () => {
  it("shows both short names, labelled, when Global's differs; one when it doesn't", () => {
    expect(render('GL')).toMatch(/>Japan<\/span>GL<\/span>.*>Global<\/span>GC<\/span>/);
    const ura = render('URA');
    expect(ura).toContain('>URA</span>');
    expect(ura).not.toContain('scenario-key-server');
    expect(render('GM')).not.toContain('scenario-key-server'); // no Global name yet
  });
});
