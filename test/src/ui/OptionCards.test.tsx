// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OptionCards } from '../../../src/ui/OptionCards.tsx';

afterEach(cleanup);

describe('OptionCards', () => {
  const options = [
    { value: 'a', label: 'Alpha', detail: 'First' },
    { value: 'b', label: 'Beta', detail: 'Second' },
  ] as const;

  it('names the group by its label and presses the chosen card only', () => {
    render(
      <>
        <span id="pick">Pick one</span>
        <OptionCards labelledBy="pick" options={options} value="b" onChange={() => {}} />
      </>
    );
    const group = screen.getByRole('group', { name: 'Pick one' });
    expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Beta/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Alpha/ }).textContent).toContain('First');
  });

  it('calls onChange with the clicked card', () => {
    const onChange = vi.fn();
    render(
      <>
        <span id="pick">Pick one</span>
        <OptionCards labelledBy="pick" options={options} value="a" onChange={onChange} />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: /Beta/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
