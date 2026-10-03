// Regression check on one known score (taken from upstream's own test,
// src/components/tierlist-calc.test.js).

import { describe, it, expect } from 'vitest';
import { processCards } from '../tierlist/tierlist-calc.js';
import allCards from '../generated/raw/gl.js';
import { SCENARIOS_BY_SERVER } from '../tierlist/scenarios.js';

const scenario = SCENARIOS_BY_SERVER.gl.MANT;
const weights = { ...scenario.speed, ...scenario.general };

const selectedCardIds = [30078, 20027, 20041, 20012, 20015];
const selectedCards = selectedCardIds.map((id) => allCards.find((c) => c.id === id && c.limit_break === 4));

const kitasan = allCards.find((c) => c.id === 30028 && c.limit_break === 4);

describe('processCards', () => {
  it('scores Kitasan Black at ~372 in gl.MANT speed with the default GL deck', () => {
    const result = processCards([kitasan], weights, selectedCards);
    expect(result).toHaveLength(1);
    expect(Math.round(result[0].score)).toBe(372);
  });
});
