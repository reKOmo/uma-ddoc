// Shared by the tests' typing.
//   fixture<T>(value)  a test object with only the fields the code under test reads, typed as the whole shape it
//                      stands in for (writing every field of a banner or an event would bury what a test is about)
//   present(value)     a value fixed test data must have (a card, a scenario, a parse result): fails the test with a
//                      message instead of TypeScript's possibly-undefined

export const fixture = <T>(value: unknown): T => value as T;

export function present<T>(value: T | null | undefined, what = 'value'): T {
  if (value == null) throw new Error(`expected a ${what}, got ${value}`);
  return value;
}
