import { type DependencyList, useEffect, useRef, useState } from 'react';
import { useAsync } from './useAsync.ts';

const SUPERSEDED = new Error('superseded');
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A ranking blocks the main thread for ~100-300 ms: `compute` starts after `delay` ms (a task at least) so loading
// text paints first, and `next()` yields again between rankings. A superseded run stops at its next yield rather than
// ranking for nothing (useAsync would only drop its result). `show` publishes a partial result. null until done.
export function useRanking<T>(
  compute: (next: () => Promise<void>, show: (partial: T) => void) => Promise<T>,
  deps: DependencyList,
  delay = 0
): T | null {
  const run = useRef(0);
  const [partial, setPartial] = useState<T | null>(null);
  useEffect(
    () => () => {
      run.current++;
    },
    []
  );
  const { data, pending } = useAsync(async () => {
    const id = ++run.current;
    const pause = async (ms: number) => {
      await wait(ms);
      if (id !== run.current) throw SUPERSEDED;
    };
    setPartial(null);
    await pause(delay);
    return compute(
      () => pause(0),
      (value) => {
        if (id === run.current) setPartial(value);
      }
    );
  }, deps);
  return pending ? partial : (data ?? null);
}
