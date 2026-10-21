// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ArrowLeftRight } from 'lucide-react';
import LinkButton from '../src/ui/LinkButton.tsx';
import SeeMore from '../src/ui/SeeMore.tsx';
import FoldToggle from '../src/ui/FoldToggle.tsx';
import Pill from '../src/ui/Pill.tsx';
import TierChip from '../src/ui/TierChip.tsx';
import Status from '../src/ui/Status.tsx';
import StatusBadge from '../src/timeline/StatusBadge.tsx';

afterEach(cleanup);

describe('LinkButton', () => {
  it('renders a plain link without a new tab or icon', () => {
    render(<LinkButton href="#/card/1">Card</LinkButton>);
    const link = screen.getByRole('link', { name: 'Card' });
    expect(link.getAttribute('href')).toBe('#/card/1');
    expect(link.hasAttribute('target')).toBe(false);
    expect(link.querySelector('svg')).toBeNull();
  });

  it('opens an external link in a new tab with a trailing icon', () => {
    render(
      <LinkButton href="https://example.com" external>
        GameTora
      </LinkButton>
    );
    const link = screen.getByRole('link', { name: 'GameTora' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
    const icon = link.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(link.lastElementChild).toBe(icon);
  });

  it('shows the given icon instead of the external one', () => {
    render(
      <LinkButton href="#/timeline/gl/1" external icon={ArrowLeftRight}>
        Global
      </LinkButton>
    );
    const link = screen.getByRole('link', { name: 'Global' });
    const icons = link.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    expect(link.firstElementChild).toBe(icons[0]);
  });
});

describe('SeeMore', () => {
  it('is a link with an href', () => {
    render(<SeeMore href="#/card/2">See card</SeeMore>);
    const link = screen.getByRole('link', { name: 'See card' });
    expect(link.getAttribute('href')).toBe('#/card/2');
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('is a button without one, calling onClick', () => {
    const onClick = vi.fn();
    render(<SeeMore onClick={onClick}>See more</SeeMore>);
    const button = screen.getByRole('button', { name: 'See more' });
    expect(button.getAttribute('type')).toBe('button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

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
});

describe('StatusBadge', () => {
  it('is a status pill with the translated status', () => {
    render(<StatusBadge status="predicted" />);
    // i18n isn't set up in this test, so react-i18next returns the key.
    expect(screen.getByText('timeline.status.predicted')).toBeTruthy();
  });
});

describe('TierChip', () => {
  it('shows the tier letter on its global tier class', () => {
    render(<TierChip tier={2} title="Rank 3" />);
    const chip = screen.getByTitle('Rank 3');
    expect(chip.textContent).toBe('B');
    expect(chip.classList.contains('tier-2')).toBe(true);
  });

  it('shows … while pending', () => {
    render(<TierChip pending />);
    expect(screen.getByText('…')).toBeTruthy();
  });

  it('shows – with no tier and not pending', () => {
    render(<TierChip />);
    expect(screen.getByText('–')).toBeTruthy();
  });
});

describe('Status', () => {
  it('is a paragraph of text', () => {
    render(<Status>Loading</Status>);
    expect(screen.getByText('Loading').tagName).toBe('P');
  });
});
