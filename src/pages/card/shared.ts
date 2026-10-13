import { cards } from '../../../tierlist/cards.ts';
import type { Server } from '../../../tierlist/cards.ts';

export const LIMIT_BREAKS = [0, 1, 2, 3, 4];

const LANGUAGE = { gl: 'en', jp: 'jp' } as const;

export const nameOf = (id: number, server: Server): string | undefined =>
  cards[id]?.name[LANGUAGE[server]] ?? cards[id]?.name.jp ?? undefined;

export const titleOf = (id: number, server: Server): string | null =>
  cards[id]?.title[LANGUAGE[server]] ?? cards[id]?.title.jp ?? null;
