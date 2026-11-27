// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/i18n/index.ts';
import ScenariosPage from '../../../src/pages/ScenariosPage.tsx';
import { SCENARIOS, isCurrent } from '../../../shared/scenarioRelease.ts';

afterEach(cleanup);

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

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
