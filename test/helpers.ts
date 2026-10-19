import type { DateStatus } from '../shared/schemas/common.ts';

// A cast, not a check: a fixture carries only the fields the code under test reads.
export const fixture = <T>(value: unknown): T => value as T;

export function present<T>(value: T | null | undefined, what = 'value'): T {
  if (value == null) throw new Error(`expected a ${what}, got ${value}`);
  return value;
}

// A date as the files store it (Dated): the news' unless said otherwise.
export const at = (
  date: string,
  status: DateStatus = 'news',
  more: { lo?: string; hi?: string; source?: string } = {}
) => ({
  date,
  status,
  ...more,
});
