// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Filter } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Segmented } from '../../../src/ui/Segmented.tsx';

afterEach(cleanup);

describe('Segmented', () => {
  it('renders a labelled fieldset of buttons, the chosen one pressed', () => {
    render(
      <Segmented
        label="Server"
        options={[
          { value: 'gl', label: 'Global' },
          { value: 'jp', label: 'JP', ariaLabel: 'Japan' },
        ]}
        value="jp"
        onChange={() => {}}
      />
    );
    const group = screen.getByRole('group', { name: 'Server' });
    expect(group.tagName).toBe('FIELDSET');
    const global = screen.getByRole('button', { name: 'Global' });
    const japan = screen.getByRole('button', { name: 'Japan' });
    expect(global.getAttribute('type')).toBe('button');
    expect(global.getAttribute('aria-pressed')).toBe('false');
    expect(japan.getAttribute('aria-pressed')).toBe('true');
  });

  it('is labelled by an element when labelledBy is given', () => {
    render(
      <>
        <span id="size-label">Card size</span>
        <Segmented labelledBy="size-label" options={[{ value: 1, label: 'One' }]} value={1} onChange={() => {}} />
      </>
    );
    expect(screen.getByRole('group', { name: 'Card size' })).toBeTruthy();
  });

  it('shows icons, titles and a disabled state, and calls onChange with the option value', () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <Segmented
        label="Zoom"
        options={[
          { value: 'a', label: 'A', icon: Filter },
          { value: 'b', label: 'B', title: 'Bee' },
        ]}
        value="a"
        onChange={onChange}
        disabled
        className="extra"
      />
    );
    const disabled = screen.getByRole('button', { name: 'B' }) as HTMLButtonElement;
    expect(disabled.getAttribute('title')).toBe('Bee');
    expect(disabled.disabled).toBe(true);
    expect(screen.getByRole('group', { name: 'Zoom' }).className).toContain('extra');
    fireEvent.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
    unmount();

    render(
      <Segmented
        label="Zoom"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        value="a"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('keeps numeric values', () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="LB"
        options={[
          { value: 0, label: 'LB0' },
          { value: 4, label: 'MLB' },
        ]}
        value={0}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'MLB' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
