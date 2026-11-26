import { describe, expect, it, vi } from 'vitest';
import { memoAsync } from '../src/lib/memo.ts';
import { optionalJson } from '../src/lib/optional.ts';

describe('memoAsync', () => {
  it('loads once per key', async () => {
    const load = vi.fn(async (a: string, b: number) => `${a}${b}`);
    const cached = memoAsync(load);
    expect(cached('x', 1)).toBe(cached('x', 1));
    expect(await cached('x', 2)).toBe('x2');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keys by the given function', async () => {
    const load = vi.fn(async (o: { a: number }) => o.a);
    const cached = memoAsync(load, (o) => String(o.a));
    expect(cached({ a: 1 })).toBe(cached({ a: 1 }));
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('optionalJson', () => {
  it('gives null without the file', async () => {
    expect(await optionalJson<number>({})()).toBeNull();
  });

  it('loads the file once', async () => {
    const load = vi.fn(async () => 7);
    const loader = optionalJson({ 'file.json': load });
    expect(await loader()).toBe(7);
    expect(await loader()).toBe(7);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
