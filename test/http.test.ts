import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { paced, sleep } from '../scripts/lib/http.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('sleep', () => {
  it('resolves after the time', async () => {
    let done = false;
    const p = sleep(100).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });
});

describe('paced', () => {
  it('runs the first request at once and waits the pause before each later one', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const pace = paced({ pause: [1000, 3000] }); // 2000 ms with random 0.5
    const calls: number[] = [];
    const run = async () => {
      calls.push(Date.now());
    };
    const t0 = Date.now();
    const all = (async () => {
      await pace(run);
      await pace(run);
      await pace(run);
    })();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([t0]);
    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2000);
    await all;
    expect(calls.map((c) => c - t0)).toEqual([0, 2000, 4000]);
  });

  it('pauses before the first request too when asked, and returns the request’s result', async () => {
    const pace = paced({ pause: [100, 100], first: true });
    const p = pace(async () => 'ok');
    await vi.advanceTimersByTimeAsync(99);
    let result: string | undefined;
    p.then((r) => {
      result = r;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toBe('ok');
  });
});
