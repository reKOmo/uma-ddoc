// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Bookmark, Filter, Search as SearchIcon } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardRow } from '../src/ui/CardRow.tsx';
import { Section } from '../src/ui/Section.tsx';
import { Segmented } from '../src/ui/Segmented.tsx';
import { SearchInput } from '../src/ui/SearchInput.tsx';
import { ToolbarButton } from '../src/ui/ToolbarButton.tsx';

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

describe('Section', () => {
  it('renders a section with a heading and the action beside it', () => {
    const { container } = render(
      <Section title="Tier by scenario" id="tiers" action={<button type="button">Sort</button>}>
        <p>body</p>
      </Section>
    );
    const section = container.querySelector('section');
    expect(section?.id).toBe('tiers');
    expect(screen.getByRole('heading', { level: 2, name: 'Tier by scenario' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sort' }).getAttribute('type')).toBe('button');
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('uses an h3 at level 3 and defaults to h2', () => {
    render(
      <Section title="Sub" level={3}>
        x
      </Section>
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Sub' })).toBeTruthy();
    cleanup();
    render(<Section title="Main">x</Section>);
    expect(screen.getByRole('heading', { level: 2, name: 'Main' })).toBeTruthy();
  });
});

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
});

describe('CardRow', () => {
  it('is a link with the icon, name, title and meta', () => {
    render(
      <CardRow
        href="#/card/30001"
        icon="https://example.com/icon.png"
        name="Kitasan Black"
        title="Dreams"
        meta={<span>Rerun</span>}
        className="extra"
      />
    );
    const link = screen.getByRole('link', { name: /Kitasan Black/ });
    expect(link.getAttribute('href')).toBe('#/card/30001');
    expect(link.className).toContain('extra');
    expect(screen.getByText('Dreams').tagName).toBe('SMALL');
    expect(screen.getByText('Rerun')).toBeTruthy();
    const img = link.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/icon.png');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('leaves out the title when there is none', () => {
    const { container } = render(<CardRow href="#/card/1" icon="i.png" name="Only" title={null} />);
    expect(container.querySelector('small')).toBeNull();
    expect(screen.getByText('Only').tagName).toBe('STRONG');
  });
});
