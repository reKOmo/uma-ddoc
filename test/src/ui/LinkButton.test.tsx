// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ArrowLeftRight } from 'lucide-react';
import LinkButton from '../../../src/ui/LinkButton.tsx';

afterEach(cleanup);

describe('LinkButton', () => {
  it('renders a plain link without a new tab or icon', () => {
    render(<LinkButton href="#/card/1">Card</LinkButton>);
    const link = screen.getByRole('link', { name: 'Card' });
    expect(link.getAttribute('href')).toBe('#/card/1');
    expect(link.hasAttribute('target')).toBe(false);
    expect(link.querySelector('svg')).toBeNull();
  });

  it('opens an external link in a new tab with a trailing icon', () => {
    render(
      <LinkButton href="https://example.com" external>
        GameTora
      </LinkButton>
    );
    const link = screen.getByRole('link', { name: 'GameTora' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
    const icon = link.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(link.lastElementChild).toBe(icon);
  });

  it('shows the given icon instead of the external one', () => {
    render(
      <LinkButton href="#/timeline/gl/1" external icon={ArrowLeftRight}>
        Global
      </LinkButton>
    );
    const link = screen.getByRole('link', { name: 'Global' });
    const icons = link.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    expect(link.firstElementChild).toBe(icons[0]);
  });

  it('is a button when it has a click handler', () => {
    const onClick = vi.fn();
    render(
      <LinkButton onClick={onClick} filled aria-label="Open the tier list">
        Tier list
      </LinkButton>
    );
    const button = screen.getByRole('button', { name: 'Open the tier list' });
    expect(button.getAttribute('type')).toBe('button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
