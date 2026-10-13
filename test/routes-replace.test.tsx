// @vitest-environment jsdom
// The Timeline replaces the address while it opens a link's sheet (history.replaceState, no hashchange): the app must
// keep routing by the link it arrived at, or the link's entry is lost (a direct link, "See banner", back from a card).

import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

vi.mock('../src/pages/TimelinePage.tsx', () => ({
  default: ({ linkId }: { linkId?: string }) => {
    // As the real page does on mount (no sheet open yet): the address becomes the plain Timeline's.
    useEffect(() => window.history.replaceState(window.history.state, '', '#/timeline'), []);
    return <div data-testid="page">{`timeline ${linkId ?? 'none'}`}</div>;
  },
}));
for (const page of ['TierListPage', 'CardPage', 'SettingsPage', 'ScenarioPage', 'ScenariosPage'])
  vi.doMock(`../src/pages/${page}.tsx`, () => ({ default: () => <div data-testid="page">{page}</div> }));

const { default: App } = await import('../src/App.tsx');

describe('a Timeline link', () => {
  it('keeps its entry when the page replaces the address on mount', async () => {
    // (arriving at the link: its hashchange has fired, as on a page load or a click)
    const changed = new Promise((resolve) => window.addEventListener('hashchange', resolve, { once: true }));
    window.location.hash = '#/timeline/gl/30003';
    await changed;
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('timeline 30003'));
    // a render later (the effects have run): still the link's entry
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId('page').textContent).toBe('timeline 30003');
  });
});
