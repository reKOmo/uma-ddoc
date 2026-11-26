import type { Server } from './news/text.ts';

export const ROOT: string = new URL('../../', import.meta.url).pathname;
export const GENERATED_DIR: string = `${ROOT}generated/`;
// Committed: nothing can regenerate it (generated/ is rebuilt by every deploy).
export const DATA_DIR: string = `${ROOT}data/`;
// build-cards' output: every card, both servers (shared/schemas/card.ts CardsFile).
export const CARDS_JSON: string = `${GENERATED_DIR}cards.json`;
export const newsDir = (server: Server = 'gl'): string => `${DATA_DIR}news/${server}/`;
