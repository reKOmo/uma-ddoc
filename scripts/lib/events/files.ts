// The events, answers and Champions Meeting rewards files: where they are, and how they are read and written.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DATA_DIR, newsDir } from '../paths.ts';
import type { Server } from '../news/text.ts';
import type { AiAnswersFile } from '../../../shared/schemas/news.ts';
import type { CmRewardsFile, EventsFile, GameEvent } from '../../../shared/schemas/event.ts';

export const EVENTS_FILE = `${DATA_DIR}global_events.json`;
export const eventsFile = (server: Server = 'gl'): string =>
  server === 'gl' ? EVENTS_FILE : `${DATA_DIR}${server}_events.json`;
export const CM_REWARDS_FILE = `${DATA_DIR}champions_meeting_rewards.json`;
// A model's answers about what the rules doubted, by event aiKey.
export const answersFile = (server: Server = 'gl'): string => `${newsDir(server)}ai_answers.json`;

export const readEvents = (server: Server = 'gl'): EventsFile =>
  existsSync(eventsFile(server)) ? JSON.parse(readFileSync(eventsFile(server), 'utf8')) : [];
export const readAnswers = (server: Server = 'gl'): AiAnswersFile =>
  existsSync(answersFile(server)) ? JSON.parse(readFileSync(answersFile(server), 'utf8')) : {};
// One answer per line, sorted by key, so commits diff per answer.
export function writeAnswers(answers: AiAnswersFile, server: Server = 'gl'): void {
  const keys = Object.keys(answers).sort();
  writeFileSync(
    answersFile(server),
    `{\n${keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(answers[k])}`).join(',\n')}\n}\n`
  );
}
export const readCmTable = (): CmRewardsFile =>
  existsSync(CM_REWARDS_FILE) ? JSON.parse(readFileSync(CM_REWARDS_FILE, 'utf8')) : [];

// One event per line, so commits diff per event (excluded from Biome, see biome.json).
const lines = (events: GameEvent[]): string => `[\n${events.map((e) => JSON.stringify(e)).join(',\n')}\n]\n`;
export const writeEvents = (events: GameEvent[], server: Server = 'gl'): void =>
  writeFileSync(eventsFile(server), lines(events));
