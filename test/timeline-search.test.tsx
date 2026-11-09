// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../src/i18n/index.ts';
import TimelineSearch from '../src/timeline/TimelineSearch.tsx';
import type { Term } from '../src/timeline/search.ts';

afterEach(cleanup);

// Made-up terms: a character and a card type.
const character: Term = { type: 'character', value: 'Test Runner', label: 'Test Runner', aliases: [], tone: null };
const type: Term = { type: 'type', value: 'speed', label: 'Speed', aliases: [], tone: 'type-speed' };

describe('TimelineSearch', () => {
  it("removes a chip when it's clicked", () => {
    const onChange = vi.fn();
    render(<TimelineSearch terms={[character, type]} chips={[character, type]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Test Runner/ }));
    expect(onChange).toHaveBeenCalledWith([type]);
  });

  it('removes the last chip on Backspace in the empty field, after typing too', () => {
    const onChange = vi.fn();
    render(<TimelineSearch terms={[character, type]} chips={[character, type]} onChange={onChange} />);
    const field = screen.getByRole('combobox');
    // (typing opens the suggestions; clearing the text leaves them open, with nothing to suggest)
    fireEvent.change(field, { target: { value: 'Sp' } });
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.keyDown(field, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith([character]);
  });

  it('highlights nothing until ↓; then ←→ move along, ↑ from the first row back to nothing', () => {
    // (jsdom lays nothing out: every suggestion is on one row)
    const others = ['Spark', 'Spin', 'Spot'].map((name) => ({ ...character, value: name, label: name }));
    render(<TimelineSearch terms={others} chips={[]} onChange={() => {}} />);
    const field = screen.getByRole('combobox');
    fireEvent.change(field, { target: { value: 'Sp' } });
    const highlighted = () => screen.queryAllByRole('option', { selected: true }).map((o) => o.textContent);
    expect(highlighted()).toEqual([]);
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(highlighted()).toEqual(['Spark']);
    fireEvent.keyDown(field, { key: 'ArrowRight' });
    expect(highlighted()).toEqual(['Spin']);
    fireEvent.keyDown(field, { key: 'ArrowLeft' });
    expect(highlighted()).toEqual(['Spark']);
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(highlighted()).toEqual([]);
  });
});
