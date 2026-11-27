// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '../../../src/i18n/index.ts';
import StatIcon from '../../../src/ui/StatIcon.tsx';

afterEach(cleanup);

describe('StatIcon', () => {
  it('names itself when it stands alone', () => {
    render(<StatIcon stat="power" label="Power" />);
    expect(screen.getByRole('img', { name: 'Power' })).toBeTruthy();
  });
});
