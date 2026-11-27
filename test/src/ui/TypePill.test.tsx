// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '../../../src/i18n/index.ts';
import TypePill, { isStat } from '../../../src/ui/TypePill.tsx';

afterEach(cleanup);

describe('TypePill', () => {
  it("shows the type's icon and name, in the type's colour", () => {
    const { container } = render(<TypePill stat="wisdom" />);
    const pill = container.firstElementChild;
    expect(pill?.getAttribute('data-tone')).toBe('type-wisdom');
    expect(pill?.textContent).toBe('Wit');
    // (the name says it: the icon is decoration)
    expect(pill?.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('knows the card types from other search terms', () => {
    expect(isStat('speed')).toBe(true);
    expect(isStat('carats')).toBe(false);
  });
});
