import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import type { z } from 'zod';
import { DATA_FILES, GENERATED_FILES, JSON_SCHEMAS } from '../shared/schemas/files.ts';
import { jsonSchema } from '../scripts/build-schemas.ts';

const read = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));

function problems(schema: z.ZodType, data: unknown): string {
  const result = schema.safeParse(data);
  return result.success
    ? ''
    : result.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
}

describe('committed data', { tags: ['data'] }, () => {
  it.each(Object.entries(DATA_FILES))('%s fits its schema', (file, schema) => {
    expect(problems(schema, read(file))).toBe('');
  });
});

describe('generated data', { tags: ['data'] }, () => {
  it.each(Object.entries(GENERATED_FILES))('%s fits its schema (when built)', (file, schema) => {
    if (!existsSync(file)) return;
    expect(problems(schema, read(file))).toBe('');
  });
});

describe('schemas/', () => {
  it.each(Object.entries(JSON_SCHEMAS))('%s is up to date (pnpm build-schemas)', (name, schema) => {
    expect(read(`schemas/${name}`)).toEqual(jsonSchema(schema, name));
  });
});
