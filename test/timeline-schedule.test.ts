import { describe, expect, it } from 'vitest';
import type { Phase } from '../shared/schemas/event.ts';
import { currentPhase, phaseEnd } from '../src/timeline/sheet/schedule.ts';
import { at } from './helpers.ts';

const phase = (key: string, start: string, end: string | null = null): Phase => ({
  key,
  start: at(start),
  end: end ? at(end) : null,
});
const now = Date.parse('2026-10-13T12:00:00Z');

describe('phaseEnd', () => {
  it('is its own end, else the next later start, else the event end', () => {
    const phases = [
      phase('a', '2026-10-10T00:00:00Z', '2026-10-11T00:00:00Z'),
      phase('b', '2026-10-11T00:00:00Z'),
      phase('c', '2026-10-11T00:00:00Z'),
      phase('d', '2026-10-14T00:00:00Z'),
    ];
    expect(phaseEnd(phases, 0, null)).toBe('2026-10-11T00:00:00Z');
    // (c starts with b, so b runs until d)
    expect(phaseEnd(phases, 1, null)).toBe('2026-10-14T00:00:00Z');
    expect(phaseEnd(phases, 3, '2026-10-20T00:00:00Z')).toBe('2026-10-20T00:00:00Z');
  });
});

describe('currentPhase', () => {
  it('finds the running phase and marks the ended ones', () => {
    const phases = [
      phase('a', '2026-10-10T00:00:00Z'),
      phase('b', '2026-10-12T00:00:00Z'),
      phase('c', '2026-10-15T00:00:00Z'),
    ];
    expect(currentPhase(phases, '2026-10-20T00:00:00Z', now)).toEqual({
      current: 1,
      end: '2026-10-15T00:00:00Z',
      ended: [true, false, false],
    });
  });

  it('prefers the overlapping phase that started last', () => {
    const phases = [phase('a', '2026-10-10T00:00:00Z', '2026-10-18T00:00:00Z'), phase('b', '2026-10-12T00:00:00Z')];
    expect(currentPhase(phases, '2026-10-20T00:00:00Z', now).current).toBe(1);
  });

  it('has none before the first phase or after the last one ends', () => {
    expect(currentPhase([phase('a', '2026-10-14T00:00:00Z')], null, now)).toEqual({
      current: -1,
      end: null,
      ended: [false],
    });
    expect(currentPhase([phase('a', '2026-10-10T00:00:00Z')], '2026-10-12T00:00:00Z', now)).toEqual({
      current: -1,
      end: null,
      ended: [true],
    });
  });
});
