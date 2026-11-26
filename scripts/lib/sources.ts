import { mkdirSync, writeFileSync } from 'node:fs';
import type { SourcesFile } from '../../shared/schemas/sources.ts';
import { readJson } from './json.ts';
import { GENERATED_DIR } from './paths.ts';

export const SOURCES_FILE: string = `${GENERATED_DIR}sources.json`;

export const readSources = (): SourcesFile => readJson<SourcesFile>(SOURCES_FILE, {});

// Several scripts write this file: each sets only its own files' entries.
export function writeSources(entries: SourcesFile): void {
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(SOURCES_FILE, `${JSON.stringify({ ...readSources(), ...entries }, null, 2)}\n`);
}
