// `pnpm build-schemas`: schemas/*.json from the zod schemas (shared/schemas/files.ts' JSON_SCHEMAS), so they're never
// edited by hand (then Biome formats them). test/schemas.test.ts fails when they're out of date.
//   jsonSchema(schema, name) → the JSON Schema object written for it

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { JSON_SCHEMAS } from '../shared/schemas/files.ts';
import { ROOT } from './lib/paths.ts';

export function jsonSchema(schema: z.ZodType, name: string): Record<string, unknown> {
  const { $schema, title, description, ...rest } = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return { $schema, $id: name, title, description, ...rest };
}

export const schemaText = (schema: z.ZodType, name: string) => `${JSON.stringify(jsonSchema(schema, name), null, 2)}\n`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = Object.entries(JSON_SCHEMAS).map(([name, schema]) => {
    writeFileSync(`${ROOT}schemas/${name}`, schemaText(schema, name));
    return `schemas/${name}`;
  });
  execFileSync('pnpm', ['exec', 'biome', 'format', '--write', ...files], { cwd: ROOT, stdio: 'ignore' });
  console.log(files.join('\n'));
}
