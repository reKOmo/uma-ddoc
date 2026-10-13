// @vitest-environment jsdom
// The app's dropdown (src/Dropdown.tsx, on Radix Select), opened: groups in order, disabled options, choosing,
// and the italic / note / badge / icon / pill features.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import Dropdown, { type DropdownOption } from '../src/Dropdown.tsx';

// jsdom lacks some APIs Radix Select uses.
beforeAll(() => {
  const proto = window.HTMLElement.prototype;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0) as unknown as number;
});
afterEach(cleanup);

const OPTIONS: DropdownOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'g1', label: 'Grouped one', group: 'Averaged' },
  { value: 'b', label: 'Beta', italic: true, note: 'Not released yet' },
  { value: 'c', label: 'Gamma', badge: 'Current', icon: 'icon.png' },
  { value: 'd', label: 'Delta', disabled: true, note: 'Not ranked' },
  { value: 'e', label: 'Epsilon', pill: { color: '#ff0000', ink: 'light' } },
];

// Opens the dropdown the way the keyboard does (jsdom has no PointerEvent for Radix's mouse path).
function open(props: { value?: string; onChange?: (v: string) => void } = {}) {
  const onChange = props.onChange ?? vi.fn();
  render(<Dropdown label="Pick" value={props.value ?? 'a'} options={OPTIONS} onChange={onChange} />);
  fireEvent.keyDown(screen.getByRole('combobox', { name: /Pick/ }), { key: 'Enter' });
  return onChange;
}

const choose = (option: HTMLElement) => fireEvent.keyDown(option, { key: 'Enter' });

describe('Dropdown opened', () => {
  it('opens and lists ungrouped options first, then each group under its heading', async () => {
    render(<Dropdown label="Pick" value="a" options={OPTIONS} onChange={() => {}} />);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(screen.getByRole('combobox', { name: /Pick/ }), { key: 'Enter' });
    const list = await screen.findByRole('listbox');
    const names = within(list)
      .getAllByRole('option')
      .map((o) => o.textContent?.replace(/(Not released yet|Current|Not ranked)$/, ''));
    expect(names).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Grouped one']);
    const group = within(list).getByRole('group', { name: 'Averaged' });
    expect(within(group).getAllByRole('option')).toHaveLength(1);
    expect(within(list).getByRole('option', { name: /Alpha/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('calls onChange with the chosen value', async () => {
    const onChange = open();
    choose(await screen.findByRole('option', { name: /Grouped one/ }));
    expect(onChange).toHaveBeenCalledWith('g1');
  });

  it("can't choose a disabled option", async () => {
    const onChange = open();
    const delta = await screen.findByRole('option', { name: /Delta/ });
    expect(delta.getAttribute('aria-disabled')).toBe('true');
    choose(delta);
    fireEvent.pointerUp(delta);
    fireEvent.click(delta);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('shows the note, badge, italic label, icon and pill', async () => {
    open();
    const beta = await screen.findByRole('option', { name: /Beta/ });
    expect(within(beta).getByText('Not released yet')).toBeTruthy();
    expect(within(beta).getByText('Beta').closest('[role="option"]')?.className).toMatch(/italic/);
    expect(within(screen.getByRole('option', { name: /Gamma/ })).getByText('Current')).toBeTruthy();
    expect(screen.getByRole('option', { name: /Gamma/ }).querySelector('img')?.getAttribute('src')).toBe('icon.png');
    const pill = within(screen.getByRole('option', { name: /Epsilon/ })).getByText('Epsilon');
    expect(pill.style.getPropertyValue('--pill-color')).toBe('#ff0000');
  });

  it('shows the selected option (icon, tooltip note) on the button', () => {
    render(<Dropdown label="Pick" value="c" options={OPTIONS} onChange={() => {}} />);
    const button = screen.getByRole('combobox');
    expect(button.textContent).toContain('Gamma');
    expect(button.querySelector('img')?.getAttribute('src')).toBe('icon.png');
    cleanup();
    render(<Dropdown label="Pick" value="b" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByRole('combobox').getAttribute('title')).toBe('Not released yet');
  });
});
