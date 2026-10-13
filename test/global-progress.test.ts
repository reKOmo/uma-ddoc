import { describe, it, expect } from 'vitest';
import { globalProgress } from '../src/timeline/globalProgress.ts';
import type { Banner, BannerId } from '../shared/schemas/banner.ts';
import { fixture, present } from './helpers.ts';

const day = (d: string) => Date.parse(`${d}T00:00:00Z`);
const banner = (id: BannerId, start: string, end = start) =>
  fixture<Banner>({ id, start: `${start}T00:00:00Z`, end: `${end}T00:00:00Z` });

const jp = {
  characters: [],
  cards: [banner(1, '2022-01-01', '2022-01-10'), banner(2, '2022-01-11'), banner(3, '2022-01-21')],
};
const global = { characters: [], cards: [banner(1, '2026-01-01')] };

describe('globalProgress', () => {
  it("estimates linearly between the banner Global is running and its next one's JP start", () => {
    const predicted = {
      characters: [],
      cards: [{ ...banner(2, '2026-01-11'), jp_start: '2022-01-11T00:00:00Z', predicted: true }],
    };
    const p = globalProgress({ global, jp, predicted, now: day('2026-01-06') });
    expect(p).toEqual({ estimate: day('2022-01-06'), from: day('2022-01-01'), to: day('2022-01-11'), toKnown: false });
  });

  it('marks the window end as known for confirmed or announced banners', () => {
    const confirmed = {
      characters: [],
      cards: [{ ...banner(2, '2026-01-11'), jp_start: '2022-01-11T00:00:00Z', predicted: true, confirmed: true }],
    };
    expect(
      present(globalProgress({ global, jp, predicted: confirmed, now: day('2026-01-06') }), 'progress').toKnown
    ).toBe(true);
    const announced = { characters: [], cards: [banner(1, '2026-01-01'), banner(2, '2026-01-11')] };
    expect(present(globalProgress({ global: announced, jp, now: day('2026-01-06') }), 'progress').toKnown).toBe(true);
  });

  it("ignores JP's paid banners and our own re-run entries (Global never runs them)", () => {
    const withPaid = {
      characters: [{ ...banner(1, '2022-01-01', '2022-01-31'), paid: true }, banner('1-rerun', '2022-01-01')],
      cards: jp.cards,
    };
    const p = globalProgress({ global, jp: withPaid, now: day('2026-01-06') });
    expect(p).toMatchObject({ from: day('2022-01-01'), to: day('2022-01-10') });
  });

  it("isn't pulled back by a rerun of an older JP banner", () => {
    const withRerun = { characters: [], cards: [banner(2, '2026-01-01'), banner(1, '2026-01-05')] };
    const p = present(globalProgress({ global: withRerun, jp, now: day('2026-01-06') }), 'progress');
    expect(p.from).toBe(day('2022-01-11'));
  });

  it('without a next banner, the window is the JP banner Global is running; null before any', () => {
    expect(globalProgress({ global, jp, now: day('2026-01-06') })).toEqual({
      estimate: day('2022-01-01'),
      from: day('2022-01-01'),
      to: day('2022-01-10'),
      toKnown: false,
    });
    expect(globalProgress({ global, jp, now: day('2025-12-31') })).toBeNull();
  });
});
