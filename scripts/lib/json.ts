import { existsSync, readFileSync } from 'node:fs';

// TODO(ts): JSON.parse gives any; the caller names the file's type (its schema in shared/schemas/).
// With a fallback, a missing file reads as it (a file not fetched or built yet).
export function readJson<T>(path: string, fallback?: T): T {
  if (fallback !== undefined && !existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
