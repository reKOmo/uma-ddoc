// @vitest-environment jsdom
// The URL builders, and <App> routed from the address (the pages mocked to one div each).
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const stub = vi.hoisted(() => (name: string) => async () => {
  const { createElement } = await import('react');
  return {
    default: (props: Record<string, unknown>) =>
      createElement(
        'div',
        { 'data-testid': 'page' },
        `${name} ${JSON.stringify({ cardId: props.cardId, scenarioKey: props.scenarioKey, linkId: props.linkId, server: props.server })}`
      ),
  };
});
vi.mock('../src/pages/TierListPage.tsx', stub('cards'));
vi.mock('../src/pages/TimelinePage.tsx', stub('timeline'));
vi.mock('../src/pages/CardPage.tsx', stub('card'));
vi.mock('../src/pages/SettingsPage.tsx', stub('settings'));
vi.mock('../src/pages/ScenarioPage.tsx', stub('scenario'));
vi.mock('../src/pages/ScenariosPage.tsx', stub('scenarios'));

import App from '../src/App.tsx';
import { createElement } from 'react';
import { cardUrl, scenarioUrl, TAB_URLS, timelineUrl } from '../src/routes.ts';

describe('url builders', () => {
  it('build hash addresses', () => {
    expect(cardUrl(30321)).toBe('#/card/30321');
    expect(scenarioUrl('URA')).toBe('#/scenario/URA');
    expect(timelineUrl()).toBe('#/timeline');
    expect(timelineUrl('jp', 5)).toBe('#/timeline/jp/5');
    expect(timelineUrl('gl', '1076-2')).toBe('#/timeline/gl/1076-2');
    expect(Object.values(TAB_URLS)).toEqual(['#/', '#/timeline', '#/scenarios', '#/settings']);
  });
});

describe('<App> routes', () => {
  afterEach(cleanup);
  // (The app follows `hashchange`, which jsdom fires after the hash is set: wait for it, as a browser would.)
  async function at(hash: string) {
    if (window.location.hash !== hash) {
      const changed = new Promise((resolve) => window.addEventListener('hashchange', resolve, { once: true }));
      window.location.hash = hash;
      await changed;
    }
    render(createElement(App));
    const active = document.querySelector('.tabbar a.active')?.getAttribute('href');
    return { page: screen.getByTestId('page').textContent ?? '', active };
  }

  it('a card page keeps the Cards tab and shows a back button', async () => {
    const { page, active } = await at('#/card/30321');
    expect(page).toContain('card');
    expect(page).toContain('"cardId":30321');
    expect(active).toBe('#/');
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
  });

  it('a scenario page keeps the Scenarios tab', async () => {
    const { page, active } = await at('#/scenario/URA');
    expect(page).toContain('"scenarioKey":"URA"');
    expect(active).toBe('#/scenarios');
  });

  it('a Timeline link names its server and entry, and switches to it', async () => {
    const { page, active } = await at('#/timeline/jp/30120');
    expect(page).toContain('"linkId":"30120"');
    expect(page).toContain('"server":"jp"');
    expect(active).toBe('#/timeline');
  });

  it('a link to an unknown server is the plain Timeline', async () => {
    const { page } = await at('#/timeline/xx/1');
    expect(page).toContain('timeline');
    expect(page).not.toContain('linkId');
  });

  it('#/banners redirects to the Timeline', async () => {
    const { page, active } = await at('#/banners');
    expect(page).toContain('timeline');
    expect(active).toBe('#/timeline');
    expect(window.location.hash).toBe('#/timeline');
  });

  it('anything else is the Cards tab', async () => {
    const { page, active } = await at('#/nonsense');
    expect(page).toContain('cards');
    expect(active).toBe('#/');
  });

  it('the tabs', async () => {
    for (const [hash, name] of [
      ['#/scenarios', 'scenarios'],
      ['#/settings', 'settings'],
      ['#/', 'cards'],
    ]) {
      const { page, active } = await at(hash);
      expect(page.startsWith(name)).toBe(true);
      expect(active).toBe(hash);
      cleanup();
    }
  });
});
