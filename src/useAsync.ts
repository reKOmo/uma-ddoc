// Loads data for a component: runs `load()` when `deps` change. The result of a run that a newer one has
// superseded is ignored (what each effect's `cancelled` flag did). No caching: the loaders cache themselves.
//   useAsync(load, deps) → { data, error, pending }: `data` and `error` reset when deps change, `pending` is true
//   until the run settles.

import { type DependencyList, useEffect, useState } from 'react';

type AsyncState<T> = { data: T | undefined; error: unknown; pending: boolean };

const LOADING: AsyncState<never> = { data: undefined, error: undefined, pending: true };

export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>(LOADING);
  useEffect(() => {
    let cancelled = false;
    // (Keeps the same object when already reset, so the first run doesn't render twice.)
    setState((prev) => (prev === LOADING ? prev : LOADING));
    load().then(
      (data) => {
        if (!cancelled) setState({ data, error: undefined, pending: false });
      },
      (error: unknown) => {
        if (!cancelled) setState({ data: undefined, error, pending: false });
      }
    );
    return () => {
      cancelled = true;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: the caller's deps decide when to load
  }, deps);
  return state;
}
