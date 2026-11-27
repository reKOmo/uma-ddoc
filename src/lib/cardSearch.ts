import type { CardsFile } from '../../shared/schemas/card.ts';
import type { Ranked } from '../../tierlist/index.ts';
import { normalizeSearch } from './search.ts';

export const searchWords = (query: string): string[] => normalizeSearch(query).split(' ').filter(Boolean);

// Kept across rankings and keystrokes (by id and the ranking's name, which comes from each server's stats).
const searchTexts = new Map<string, string>();
const searchText = (card: Ranked, cards: CardsFile): string => {
  const key = `${card.id}/${card.char_name}`;
  let text = searchTexts.get(key);
  if (text === undefined) {
    const { name, title } = cards[card.id];
    text = normalizeSearch([card.char_name, name.en, name.jp, title.en, title.jp].join(' '));
    searchTexts.set(key, text);
  }
  return text;
};

// Every word of the query must appear somewhere in the card's names.
export function matchesSearch(card: Ranked, words: string[], cards: CardsFile): boolean {
  if (words.length === 0) return true;
  const text = searchText(card, cards);
  return words.every((word) => text.includes(word));
}
