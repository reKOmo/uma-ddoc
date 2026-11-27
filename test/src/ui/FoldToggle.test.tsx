// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FoldToggle from '../../../src/ui/FoldToggle.tsx';

afterEach(cleanup);

describe('FoldToggle', () => {
  it('shows the more label while folded and calls onToggle', () => {
    const onToggle = vi.fn();
    render(<FoldToggle expanded={false} onToggle={onToggle} moreLabel="2 more" lessLabel="Show less" />);
    const button = screen.getByRole('button', { name: '2 more' });
    expect(button.getAttribute('type')).toBe('button');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the less label once expanded', () => {
    render(<FoldToggle expanded onToggle={() => {}} moreLabel="2 more" lessLabel="Show less" />);
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '2 more' })).toBeNull();
  });
});
