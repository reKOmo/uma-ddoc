// @vitest-environment jsdom
// The scenario page (src/pages/ScenarioPage.tsx) and the Scenarios tab, rendered, and isCurrent().

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '../src/i18n/index.ts';
import ScenarioPage from '../src/pages/ScenarioPage.tsx';
import ScenariosPage from '../src/pages/ScenariosPage.tsx';
import { SCENARIOS, isCurrent, isReleased, scenarioByKey } from '../src/scenarioRelease.ts';

afterEach(cleanup);

const renderScenario = (key: string | undefined) =>
  render(<ScenarioPage scenarioKey={key} onScenarioChange={() => {}} />);

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

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

describe('ScenarioPage', () => {
  it('shows names, both launches, GameTora and the tier list link', () => {
    renderScenario('GL');
    expect(screen.getByRole('heading', { level: 1, name: 'Brighter Together! Our Grand Concert' })).toBeTruthy();
    // One launch card: Japan on the left, then Global on the right, with the gap between them.
    const launch = screen.getByRole('heading', { name: 'Launch' }).closest('section') as HTMLElement;
    expect(launch.textContent).toMatch(/Japan.*Launched after .*Global/);
    // GameTora under Links, after the launches.
    const links = screen.getByRole('heading', { name: 'Links' });
    expect(launch.compareDocumentPosition(links) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: /gametora\.com/ }).getAttribute('href')).toContain(
      'https://gametora.com/umamusume/our-grand-concert'
    );
    expect(screen.getByRole('button', { name: 'Open its tier list' })).toBeTruthy();
  });

  it('shows a predicted launch with its range, and links to the scenarios around it', () => {
    const gm = scenarioByKey('GM');
    renderScenario('GM');
    if (gm?.en_start_date?.tag === 'predicted') {
      expect(screen.getByText('Predicted')).toBeTruthy();
      expect(screen.getByText(/Could be /)).toBeTruthy();
      expect(screen.getByText(/Expected after /)).toBeTruthy();
    }
    expect(hrefs()).toContain('#/scenario/GL');
  });

  it("hides the tier list link for scenarios the tier list doesn't rank, and handles unknown keys", () => {
    const { unmount } = renderScenario('TracenKen');
    expect(screen.queryByRole('button', { name: 'Open its tier list' })).toBeNull();
    unmount();
    renderScenario('NOPE');
    expect(screen.getByText(/no scenario NOPE\./)).toBeTruthy();
  });
});

describe('ScenarioPage short names', () => {
  it("shows both short names, labelled, when Global's differs; one when it doesn't", () => {
    // GL: JP's short name labelled "Japan", Global's "GC" labelled "Global" (the pills' text, label included).
    const { unmount } = renderScenario('GL');
    expect(screen.getByText('GL').textContent).toBe('JapanGL');
    expect(screen.getByText('GC').textContent).toBe('GlobalGC');
    unmount();
    // URA: the same name on both servers, shown once, unlabelled.
    const { unmount: unmountUra } = renderScenario('URA');
    expect(screen.getByText('URA').textContent).toBe('URA');
    unmountUra();
    // GM: Global has no name yet.
    renderScenario('GM');
    const gm = scenarioByKey('GM');
    expect(screen.getByText(gm?.short.jp ?? '').textContent).toBe(gm?.short.jp);
  });
});

describe('ScenariosPage', () => {
  it('lists every scenario linking to its page, the running one marked', () => {
    render(<ScenariosPage server="gl" />);
    for (const s of SCENARIOS) expect(hrefs()).toContain(`#/scenario/${s.key}`);
    // Both servers' newest get their pill; the one on Global is the link that is marked so.
    const newestOnGlobal = SCENARIOS.find((s) => isCurrent(s.key, 'gl'))?.key;
    const pill = screen.getByText('Newest on Global');
    expect(pill.closest('a')?.getAttribute('href')).toBe(`#/scenario/${newestOnGlobal}`);
    expect(screen.getByText('Newest on Japan')).toBeTruthy();
    expect(screen.getAllByText(/Japan: Launched/).length).toBeGreaterThan(0);
    const first = screen.getAllByRole('link')[0];
    expect(within(first).getByText(/Global: /)).toBeTruthy();
  });
});
