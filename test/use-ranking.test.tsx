// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRanking } from '../src/hooks/useRanking.ts';

describe('useRanking', () => {
  it('is null until computed, showing partial results on the way', async () => {
    const seen: (number[] | null)[] = [];
    const { result } = renderHook(() => {
      const value = useRanking<number[]>(async (next, show) => {
        show([1]);
        await next();
        return [1, 2];
      }, []);
      seen.push(value);
      return value;
    });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual([1, 2]));
    expect(seen).toContainEqual([1]);
  });

  it('stops a superseded run at its next yield', async () => {
    const after = vi.fn();
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useRanking(
          async (next) => {
            await next();
            after(key);
            return key;
          },
          [key]
        ),
      { initialProps: { key: 'a' } }
    );
    rerender({ key: 'b' });
    await waitFor(() => expect(result.current).toBe('b'));
    expect(after.mock.calls).toEqual([['b']]);
  });
});
