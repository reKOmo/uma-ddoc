// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Section } from '../../../src/ui/Section.tsx';

afterEach(cleanup);

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
