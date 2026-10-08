// The banner calendar's days, in UTC (default) or the viewer's timezone (Settings).

import { describe, it, expect } from 'vitest';
import { buildTimeline } from '../src/timeline.js';

process.env.TZ = 'Europe/Warsaw'; // UTC+2 in October: a 22:00 UTC start is the next local day

const sections = [{ key: 'cards', banners: [{ start: '2026-10-14T22:00:00.000Z', end: '2026-10-23T21:59:59.000Z' }] }];
const now = Date.parse('2026-10-08T12:00:00Z');

// The calendar date the bar starts in, and how far into that day (hours).
function barStart(timeline) {
  const { from } = timeline.sections[0].rows[0][0];
  const day = timeline.dayDates.findLast((d) => d.day <= from + 1e-9);
  return [day.date, Math.round((from - day.day) * 24)];
}

describe('buildTimeline', () => {
  it('lays days out in UTC by default, like the game announces them', () => {
    expect(barStart(buildTimeline(sections, { now }))).toEqual([14, 22]);
  });

  it("uses the viewer's days with utc: false", () => {
    expect(barStart(buildTimeline(sections, { now, utc: false }))).toEqual([15, 0]);
  });
});
