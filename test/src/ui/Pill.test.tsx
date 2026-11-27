// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Pill from '../../../src/ui/Pill.tsx';

afterEach(cleanup);

describe('Pill', () => {
  it('renders a tag with its text and title', () => {
    render(
      <Pill variant="tag" title="Rarity">
        SSR
      </Pill>
    );
    const pill = screen.getByText('SSR');
    expect(pill.tagName).toBe('SPAN');
    expect(pill.getAttribute('title')).toBe('Rarity');
    expect(pill.hasAttribute('data-tone')).toBe(false);
  });

  it('renders the tone as data-tone', () => {
    render(
      <Pill variant="kind" tone="kind-story">
        Story
      </Pill>
    );
    expect(screen.getByText('Story').getAttribute('data-tone')).toBe('kind-story');
  });

  it('renders a verdict and a label', () => {
    render(
      <>
        <Pill variant="verdict" tone="whale">
          If Whale
        </Pill>
        <Pill variant="label">Rerun</Pill>
      </>
    );
    expect(screen.getByText('If Whale').getAttribute('data-tone')).toBe('whale');
    expect(screen.getByText('Rerun').tagName).toBe('SPAN');
  });

  it('renders a status pill', () => {
    render(
      <Pill variant="status" status="confirmed">
        Confirmed
      </Pill>
    );
    expect(screen.getByText('Confirmed').tagName).toBe('SPAN');
  });

  it('renders a toned status badge with no status, and sizes', () => {
    render(
      <>
        <Pill variant="status" tone="kind-champions_meeting">
          Paid
        </Pill>
        <Pill variant="tinted" tone="type-speed" size="lg">
          Speed
        </Pill>
      </>
    );
    expect(screen.getByText('Paid').getAttribute('data-tone')).toBe('kind-champions_meeting');
    expect(screen.getByText('Speed').className).toMatch(/lg/);
  });
});
