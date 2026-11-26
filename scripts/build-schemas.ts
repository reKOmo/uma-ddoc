// Usage: pnpm build-schemas   (test/schemas.test.ts fails when schemas/*.json are out of date)

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { JSON_SCHEMAS } from '../shared/schemas/files.ts';
import { ROOT, isMain } from './lib/paths.ts';
import { schemaText } from './lib/schemas.ts';

if (isMain(import.meta.url)) {
  const files = Object.entries(JSON_SCHEMAS).map(([name, schema]) => {
    writeFileSync(`${ROOT}schemas/${name}`, schemaText(schema, name));
    return `schemas/${name}`;
  });
  execFileSync('pnpm', ['exec', 'biome', 'format', '--write', ...files], { cwd: ROOT, stdio: 'ignore' });
  console.log(files.join('\n'));
}
