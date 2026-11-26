import { appendFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Server } from '../../shared/schemas/common.ts';

export const ROOT: string = new URL('../../', import.meta.url).pathname;
export const GENERATED_DIR: string = `${ROOT}generated/`;
// Committed: nothing can regenerate it (generated/ is rebuilt by every deploy).
export const DATA_DIR: string = `${ROOT}data/`;
// build-cards' output: every card, both servers (shared/schemas/card.ts CardsFile).
export const CARDS_JSON: string = `${GENERATED_DIR}cards.json`;
export const newsDir = (server: Server = 'gl'): string => `${DATA_DIR}news/${server}/`;

// data/'s record of a server: Global's files are global_*, JP's jp_*.
export const dataFile = (server: Server, kind: 'banners' | 'cards' | 'events'): string =>
  `${DATA_DIR}${server === 'gl' ? 'global' : server}_${kind}.json`;
// A per-server name: Global's has no suffix (news_features.json, news_features_jp.json; gold:review, gold:review:jp).
export const serverSuffix = (server: Server, separator = '_'): string =>
  server === 'gl' ? '' : `${separator}${server}`;

// Whether the module is the command node was started with (not imported).
export const isMain = (moduleUrl: string): boolean => moduleUrl === pathToFileURL(process.argv[1]).href;

export const summaryFile = (server: Server): string => `${newsDir(server)}summary.md`;
// `toFile`: onto the news run's commit message (summary.md, started by news:latest --summary; left alone when that
// didn't run). `toJob`: onto the GitHub Actions job summary, in a workflow.
export function appendSummary(server: Server, text: string, { toFile = false, toJob = false } = {}): void {
  if (toFile && existsSync(summaryFile(server))) appendFileSync(summaryFile(server), text);
  if (toJob && process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
}
