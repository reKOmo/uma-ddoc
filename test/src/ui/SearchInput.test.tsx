// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchInput } from '../../../src/ui/SearchInput.tsx';

afterEach(cleanup);

describe('SearchInput', () => {
  it('is a labelled search field with its value', () => {
    render(
      <SearchInput value="kita" onChange={() => {}} placeholder="Search cards" label="Search" clearLabel="Clear" />
    );
    const input = screen.getByRole('searchbox', { name: 'Search' }) as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('search');
    expect(input.placeholder).toBe('Search cards');
    expect(input.value).toBe('kita');
  });

  it('reports typing and clears to an empty string', () => {
    const onChange = vi.fn();
    render(<SearchInput value="kita" onChange={onChange} placeholder="p" label="Search" clearLabel="Clear search" />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'kitasan' } });
    expect(onChange).toHaveBeenLastCalledWith('kitasan');
    const clear = screen.getByRole('button', { name: 'Clear search' });
    expect(clear.getAttribute('type')).toBe('button');
    fireEvent.click(clear);
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('shows the clear button only when there is text', () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="p" label="Search" clearLabel="Clear search" />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });
});
