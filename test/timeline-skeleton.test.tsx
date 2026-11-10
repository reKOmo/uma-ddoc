// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '../src/i18n/index.ts';
import TimelineSkeleton from '../src/timeline/TimelineSkeleton.tsx';

afterEach(cleanup);

describe('TimelineSkeleton', () => {
  it('says the calendar is loading, its shapes hidden from screen readers', () => {
    const { container } = render(<TimelineSkeleton />);
    expect(screen.getByRole('status').textContent).toBe(i18n.t('timeline.loading'));
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });
});
