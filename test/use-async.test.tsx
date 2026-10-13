// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsync } from '../src/useAsync.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsync', () => {
  it('resolves to the loaded data', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []));
    expect(result.current).toEqual({ data: undefined, error: undefined, pending: true });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current).toEqual({ data: 42, error: undefined, pending: false });
  });

  it('ignores the result of a run that deps have superseded', async () => {
    const runs = { a: deferred<string>(), b: deferred<string>() };
    const { result, rerender } = renderHook(
      ({ key }: { key: keyof typeof runs }) => useAsync(() => runs[key].promise, [key]),
      { initialProps: { key: 'a' as keyof typeof runs } }
    );
    rerender({ key: 'b' });
    await act(async () => runs.b.resolve('B'));
    await waitFor(() => expect(result.current.data).toBe('B'));
    await act(async () => runs.a.resolve('A'));
    expect(result.current).toEqual({ data: 'B', error: undefined, pending: false });
  });

  it('resets data and pending when deps change', async () => {
    const runs = { a: Promise.resolve('A'), b: new Promise<string>(() => {}) };
    const { result, rerender } = renderHook(({ key }: { key: keyof typeof runs }) => useAsync(() => runs[key], [key]), {
      initialProps: { key: 'a' as keyof typeof runs },
    });
    await waitFor(() => expect(result.current.data).toBe('A'));
    rerender({ key: 'b' });
    expect(result.current).toEqual({ data: undefined, error: undefined, pending: true });
  });

  it('sets error when the load rejects', async () => {
    const failure = new Error('no data');
    const { result } = renderHook(() => useAsync(() => Promise.reject(failure), []));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current).toEqual({ data: undefined, error: failure, pending: false });
  });
});
