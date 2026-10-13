// Period dates in official news posts (scripts/lib/news-text.js), on strings taken from real posts.

import { describe, it, expect } from 'vitest';
import { parsePeriod } from '../scripts/lib/news-text.ts';

describe('parsePeriod', () => {
  it.each([
    [
      '10:00 p.m., Oct 7–9:59 p.m., Oct 15, 2026 (UTC)',
      { start: '2026-10-07T22:00:00.000Z', end: '2026-10-15T21:59:00.000Z' },
    ],
    [
      '3:00 p.m., Jul 23 - 2:59 p.m., Aug 28, 2026 (UTC)',
      { start: '2026-07-23T15:00:00.000Z', end: '2026-08-28T14:59:00.000Z' },
    ],
    [
      'July 27–11:59 p.m., August 2, 2026 (UTC)',
      { start: '2026-07-27T00:00:00.000Z', end: '2026-08-02T23:59:00.000Z' },
    ],
    [
      'Apr 7, 2026 - 11:59 p.m., Apr 13, 2026 (UTC)',
      { start: '2026-04-07T00:00:00.000Z', end: '2026-04-13T23:59:00.000Z' },
    ],
    [
      'Jun 26, 2025 - Jul 10, 2025, 11:59 p.m. (UTC)',
      { start: '2025-06-26T00:00:00.000Z', end: '2025-07-10T23:59:00.000Z' },
    ],
    ['From 10:00 p.m., Sep 15, 2026 (UTC) (No time limit)', { start: '2026-09-15T22:00:00.000Z', end: null }],
    [
      '10:00 p.m., Dec 28–9:59 p.m., Jan 4, 2027 (UTC)',
      { start: '2026-12-28T22:00:00.000Z', end: '2027-01-04T21:59:00.000Z' },
    ],
    ['No time limit', { start: null, end: null }],
  ])('%s', (text, expected) => {
    expect(parsePeriod(text, 2026)).toEqual(expected);
  });
});
