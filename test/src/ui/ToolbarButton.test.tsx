// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Bookmark, Filter, Search as SearchIcon } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolbarButton } from '../../../src/ui/ToolbarButton.tsx';

afterEach(cleanup);

describe('ToolbarButton', () => {
  it('shows its icon and label', () => {
    const onClick = vi.fn();
    render(<ToolbarButton icon={Filter} label="Filter" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Filter' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-pressed')).toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is an icon-only button with the label as aria-label, and a pressed toggle', () => {
    const onClick = vi.fn();
    render(<ToolbarButton icon={SearchIcon} label="Compact" onClick={onClick} iconOnly pressed title="Compact mode" />);
    const button = screen.getByRole('button', { name: 'Compact' });
    expect(button.textContent).toBe('');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('title')).toBe('Compact mode');
  });

  it('can be disabled', () => {
    const onClick = vi.fn();
    render(<ToolbarButton icon={Bookmark} label="Save" onClick={onClick} disabled />);
    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('counts by its label (none at 0), the count with its tooltip', () => {
    const { rerender } = render(<ToolbarButton label="Options" onClick={() => {}} badge={0} />);
    expect(screen.getByRole('button').textContent).toBe('Options');
    rerender(<ToolbarButton label="Options" onClick={() => {}} badge={2} badgeTitle="2 hidden" />);
    expect(screen.getByRole('button').textContent).toBe('Options2');
    expect(screen.getByTitle('2 hidden').textContent).toBe('2');
  });
});
