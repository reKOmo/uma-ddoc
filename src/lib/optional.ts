import { memoAsync } from './memo.ts';

// A generated/ file the app runs without: its glob is empty until a script has written it, and the loader gives null.
export const optionalJson = <T>(glob: Record<string, () => Promise<T>>): (() => Promise<T | null>) =>
  memoAsync(() => Object.values(glob)[0]?.() ?? Promise.resolve(null));
