import { describe, it, expect } from 'vitest';
import { bannerVerdicts, currentAdvice, sheetLink, upcomingBanner, verdictOf } from '../../../src/lib/pullGuide.ts';
import type { Banner } from '../../../shared/schemas/banner.ts';
import type { Advice, PullGuide } from '../../../shared/schemas/pullGuide.ts';
import { at, fixture, present } from '../../helpers.ts';

describe('the advice shown', () => {
  const banner = (id: number, start: string, end: string, isNew: boolean) =>
    fixture<Banner>({ id, start: at(start), end: at(end), featured: [{ id: 30078, new: isNew }] });
  const banners = [
    banner(3, '2026-11-24T22:00:00Z', '2026-12-03T21:59:59Z', false),
    banner(1, '2026-01-28T22:00:00Z', '2026-02-06T21:59:59Z', true),
  ];
  const guide = fixture<PullGuide>({
    banners: { 1: { 30078: { shouldPull: 'yes' } }, 3: { 30078: { shouldPull: 'no' } } },
    noBanner: { 30087: { shouldPull: 'free', release: { month: '2026-11', part: 'late' } } },
  });

  it("is for the card's banner running now or the next one", () => {
    expect(present(upcomingBanner(banners, 30078, Date.parse('2026-02-01T00:00:00Z')), 'banner').id).toBe(1);
    expect(present(upcomingBanner(banners, 30078, Date.parse('2026-10-08T00:00:00Z')), 'banner').id).toBe(3);
    expect(upcomingBanner(banners, 30078, Date.parse('2026-12-05T00:00:00Z'))).toBeNull();
    expect(currentAdvice(guide, 30078, banners[0], '2026-10-08')).toEqual({ shouldPull: 'no' });
    expect(currentAdvice(guide, 30078, fixture<Banner>({ id: 9 }), '2026-10-08')).toBeNull();
  });

  it('is for a card on no banner while its release is ahead', () => {
    expect(present(currentAdvice(guide, 30087, null, '2026-11-30'), 'advice').shouldPull).toBe('free');
    expect(currentAdvice(guide, 30087, null, '2026-12-01')).toBeNull();
  });

  it("links to the entry's row in the sheet", () => {
    expect(sheetLink(fixture<Advice>({ googleSheetsSrc: { gid: '5', row: 12 } }), 'https://s')).toBe(
      'https://s/edit#gid=5&range=B12'
    );
    expect(sheetLink(null, 'https://s')).toBe('https://s');
  });
});

describe('verdicts (the Timeline filter)', () => {
  it("reads an advice's pill without its +s, else none", () => {
    const advice = (shouldPull: string | null) => fixture<Advice>({ shouldPull });
    expect(verdictOf(advice('whale++'))).toBe('whale');
    expect(verdictOf(advice('yes'))).toBe('yes');
    expect(verdictOf(advice(null))).toBe('none');
    expect(verdictOf(undefined)).toBe('none');
  });

  it("gives a banner's cards' verdicts, none for cards or banners without advice", () => {
    const guide = fixture<PullGuide>({
      banners: { 30001: { 1: { shouldPull: 'yes' }, 2: { shouldPull: 'dolphin+' } } },
      noBanner: {},
    });
    expect([...bannerVerdicts(guide, 30001, [1, 2, 3])]).toEqual(['yes', 'dolphin', 'none']);
    expect([...bannerVerdicts(guide, 30002, [1])]).toEqual(['none']);
    expect([...bannerVerdicts(guide, 30001, [])]).toEqual(['none']);
  });
});
