// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import StatusBadge from '../../../src/ui/StatusBadge.tsx';

afterEach(cleanup);

describe('StatusBadge', () => {
  it('is a status pill with the translated status', () => {
    render(<StatusBadge status="predicted" />);
    // i18n isn't set up in this test, so react-i18next returns the key.
    expect(screen.getByText('timeline.status.predicted')).toBeTruthy();
  });
});
