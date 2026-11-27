import { describe, expect, it } from 'vitest';
import type { PullGuide } from '../../../../shared/schemas/pullGuide.ts';
import type { ArtBanner } from '../../../../src/lib/gametora.ts';
import type { Entry } from '../../../../src/timeline/entries.ts';
import type { DateFormat } from '../../../../src/lib/dates.ts';
import type { UpcomingAdvice } from '../../../../src/pages/card/useUpcomingAdvice.ts';
import type { EntryOrigin } from '../../../../src/pages/card/useOrigins.ts';
import { pickShown } from '../../../../src/pages/card/NextBanner.tsx';
import { fixture } from '../../../helpers.ts';

const format: DateFormat = Object.assign((iso: string) => iso, { range: (a: string, b: string) => `${a}–${b}` });

const origin = (id: string, kind: EntryOrigin['kind'], status: Entry['status'], start: string): EntryOrigin => ({
  entry: fixture<Entry>({
    id,
    group: kind === 'banner' ? 'cards' : 'event',
    status,
    start,
    end: '2099-01-01',
    art: null,
    freePulls: null,
    prediction: null,
  }),
  server: 'gl',
  kind,
  rerun: false,
});
const ended = origin('1', 'banner', 'ended', '2025-01-01');
const coming = origin('2', 'banner', 'confirmed', '2099-01-01');
const story = origin('s', 'story', 'live', '2025-02-01');
const advice = {
  shouldPull: 'yes',
  comment: 'Pull',
  advice: null,
  freePulls: null,
  googleSheetsSrc: { gid: null, row: null },
};
const guide = fixture<PullGuide>({ banners: { '1': { '7': advice } }, noBanner: {} });
const glAdvice = (more: Partial<UpcomingAdvice>): UpcomingAdvice => ({ guide, banner: null, entry: null, ...more });

describe('pickShown', () => {
  it('waits for the origins and the advice', () => {
    expect(pickShown(7, null, null, format).kind).toBe('loading');
    expect(pickShown(7, [], undefined, format).kind).toBe('loading');
  });

  it("shows the next banner: the guide's on Global, the next to come elsewhere", () => {
    const jp = pickShown(7, [ended, coming], null, format);
    expect(jp).toMatchObject({ kind: 'banner', shown: { id: '2', dates: '2099-01-01–2099-01-01' }, advice: null });
    const banner = fixture<ArtBanner>({ id: 2 });
    const gl = pickShown(7, [ended, coming], glAdvice({ banner, entry: advice }), format);
    expect(gl).toMatchObject({ kind: 'banner', shown: { id: '2' }, advice });
  });

  it('shows the event the card comes from without a banner to come', () => {
    expect(pickShown(7, [ended, story], null, format)).toMatchObject({
      kind: 'event',
      shown: { id: 's' },
      source: story,
    });
  });

  it("shows the guide's own release date on no banner or event", () => {
    const entry = { ...advice, release: { label: 'Event', date: '2099-02-01' } };
    expect(pickShown(7, [], glAdvice({ entry }), format)).toMatchObject({
      kind: 'guideRelease',
      release: entry.release,
      advice: entry,
    });
  });

  it("falls back to the last banner, with the guide's advice on it", () => {
    expect(pickShown(7, [ended], null, format)).toMatchObject({ kind: 'last', shown: { id: '1' }, advice: null });
    expect(pickShown(7, [ended], glAdvice({}), format)).toMatchObject({ kind: 'last', advice });
  });

  it('shows nothing known', () => {
    expect(pickShown(7, [], null, format)).toEqual({ kind: 'none', advice: null });
  });
});
