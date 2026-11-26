import { existsSync, readFileSync } from 'node:fs';

// TODO(ts): JSON.parse gives any; the caller names the file's type (its schema in shared/schemas/).
// With a fallback, a missing file reads as it (a file not fetched or built yet).
export function readJson<T>(path: string | URL, fallback?: T): T {
  if (fallback !== undefined && !existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

// The data files hold one record per line, so a commit's diff shows the records that changed (they're excluded from
// Biome). `indent` is the records'; the closing bracket sits one level (2 spaces) out. Empty, they read `[\n\n]` /
// `{\n\n}`, as the files always have; no trailing newline (the writer adds it).
const block = (open: string, close: string, lines: string[], indent: string): string =>
  `${open}\n${lines.map((line) => indent + line).join(',\n')}\n${indent.slice(2)}${close}`;

type Entries<T> = Record<string, T> | [string, T][];
const pairs = <T>(entries: Entries<T>): [string, T][] => (Array.isArray(entries) ? entries : Object.entries(entries));

// A list, one item per line.
export const jsonLines = (items: readonly unknown[], indent = ''): string =>
  block(
    '[',
    ']',
    items.map((item) => JSON.stringify(item)),
    indent
  );

// An object, one entry per line.
export const jsonEntries = (entries: Entries<unknown>, indent = ''): string =>
  jsonEnvelope(
    pairs(entries).map(([key, value]) => [key, JSON.stringify(value)]),
    indent
  );

// An object whose values are JSON text already (a file's own lists, each one record per line).
export const jsonEnvelope = (fields: Entries<string>, indent = ''): string =>
  block(
    '{',
    '}',
    pairs(fields).map(([key, text]) => `${JSON.stringify(key)}: ${text}`),
    indent
  );

// Whether the two would be written the same (key order counts).
export const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// The records in `next` that are new or would be written differently from `old`'s with the same id.
export function changedSince<T extends { id: string }>(old: T[], next: T[]): T[] {
  const before = new Map(old.map((r) => [r.id, JSON.stringify(r)]));
  return next.filter((r) => before.get(r.id) !== JSON.stringify(r));
}
