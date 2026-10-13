// A cast, not a check: a fixture carries only the fields the code under test reads.
export const fixture = <T>(value: unknown): T => value as T;

export function present<T>(value: T | null | undefined, what = 'value'): T {
  if (value == null) throw new Error(`expected a ${what}, got ${value}`);
  return value;
}
