export function toggled<T>(set: ReadonlySet<T>, key: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}

// `set` with every key of `keys` added (on) or removed.
export function withAll<T>(set: ReadonlySet<T>, keys: readonly T[], on: boolean): Set<T> {
  const next = new Set(set);
  for (const key of keys) on ? next.add(key) : next.delete(key);
  return next;
}
