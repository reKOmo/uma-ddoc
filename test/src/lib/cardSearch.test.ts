import { describe, expect, it } from 'vitest';
import type { CardsFile } from '../../../shared/schemas/card.ts';
import { matchesSearch, searchWords } from '../../../src/lib/cardSearch.ts';
import { fixture } from '../../helpers.ts';

const cards = fixture<CardsFile>({
  '990001': { name: { en: 'Example Runner', jp: 'エグザンプル' }, title: { en: '[Café Morning]', jp: '朝のカフェ' } },
});
const card = { id: 990001, lb: 4, char_name: 'Example Runner', score: 1 };
const matches = (query: string) => matchesSearch(card, searchWords(query), cards);

describe('card search', () => {
  it('splits the query into normalized words', () => {
    expect(searchWords('  Café,  MORNING! ')).toEqual(['cafe', 'morning']);
    expect(searchWords('')).toEqual([]);
  });

  it('matches every card on an empty query', () => {
    expect(matches('')).toBe(true);
  });

  it('needs every word somewhere in the names or titles, either language', () => {
    expect(matches('runner cafe')).toBe(true);
    expect(matches('exam morn')).toBe(true);
    expect(matches('カフェ')).toBe(true);
    expect(matches('runner evening')).toBe(false);
  });
});
