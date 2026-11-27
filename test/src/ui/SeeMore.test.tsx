// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SeeMore from '../../../src/ui/SeeMore.tsx';

afterEach(cleanup);

describe('SeeMore', () => {
  it('is a link with an href', () => {
    render(<SeeMore href="#/card/2">See card</SeeMore>);
    const link = screen.getByRole('link', { name: 'See card' });
    expect(link.getAttribute('href')).toBe('#/card/2');
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('is a button without one, calling onClick', () => {
    const onClick = vi.fn();
    render(<SeeMore onClick={onClick}>See more</SeeMore>);
    const button = screen.getByRole('button', { name: 'See more' });
    expect(button.getAttribute('type')).toBe('button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
