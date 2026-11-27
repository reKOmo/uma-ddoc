// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Status from '../../../src/ui/Status.tsx';

afterEach(cleanup);

describe('Status', () => {
  it('is a paragraph of text', () => {
    render(<Status>Loading</Status>);
    expect(screen.getByText('Loading').tagName).toBe('P');
  });
});
