// One promise per key, shared by every later call (so callers must not mutate what it resolves to).
export function memoAsync<A extends unknown[], R>(
  load: (...args: A) => Promise<R>,
  key: (...args: A) => string = (...args) => args.join()
): (...args: A) => Promise<R> {
  const cache = new Map<string, Promise<R>>();
  return (...args) => {
    const k = key(...args);
    let hit = cache.get(k);
    if (!hit) {
      hit = load(...args);
      cache.set(k, hit);
    }
    return hit;
  };
}
