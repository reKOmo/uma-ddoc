// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TierChip from '../../../src/ui/TierChip.tsx';

afterEach(cleanup);

describe('TierChip', () => {
  it('shows the tier letter on its global tier class', () => {
    render(<TierChip tier={2} title="Rank 3" />);
    const chip = screen.getByTitle('Rank 3');
    expect(chip.textContent).toBe('B');
    expect(chip.classList.contains('tier-2')).toBe(true);
  });

  it('shows … while pending', () => {
    render(<TierChip pending />);
    expect(screen.getByText('…')).toBeTruthy();
  });

  it('shows – with no tier and not pending', () => {
    render(<TierChip />);
    expect(screen.getByText('–')).toBeTruthy();
  });
});
