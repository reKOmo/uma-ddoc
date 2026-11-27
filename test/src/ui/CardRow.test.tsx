// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CardRow } from '../../../src/ui/CardRow.tsx';

afterEach(cleanup);

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

  it('is no link without an href, with a badge on its icon and something at its end', () => {
    render(
      <CardRow icon="i.png" name="Trainee" badge={<span>New</span>}>
        <span>end</span>
      </CardRow>
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('New').closest('span:has(> img)')).toBeTruthy();
    expect(screen.getByText('end')).toBeTruthy();
  });
});
