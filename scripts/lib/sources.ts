// generated/sources.json: where each generated file's data came from, { [file name]: source }. Several
// scripts write it, each only its own files' entries.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { SourcesFile } from '../../shared/schemas/sources.ts';
import { GENERATED_DIR } from './paths.ts';

export const SOURCES_FILE: string = `${GENERATED_DIR}sources.json`;

export const readSources = (): SourcesFile =>
  existsSync(SOURCES_FILE) ? JSON.parse(readFileSync(SOURCES_FILE, 'utf8')) : {};

// Sets the given files' entries, keeping the others.
export function writeSources(entries: SourcesFile): void {
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(SOURCES_FILE, `${JSON.stringify({ ...readSources(), ...entries }, null, 2)}\n`);
}
