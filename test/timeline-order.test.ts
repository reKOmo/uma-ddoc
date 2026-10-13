import { describe, it, expect } from 'vitest';
import { DEFAULT_ORDER, isDefaultOrder, orderedGroups, reorderGroups } from '../src/timeline/order.ts';
import { LANE_GROUPS } from '../src/timeline/layout.ts';

describe('timeline order', () => {
  it('starts with support cards, then trainees, every lane group once', () => {
    expect(DEFAULT_ORDER.slice(0, 2)).toEqual(['cards', 'characters']);
    expect(orderedGroups(DEFAULT_ORDER)).toEqual(LANE_GROUPS);
    expect(isDefaultOrder(DEFAULT_ORDER)).toBe(true);
  });

  it('drops a group at another place among the shown ones, the others keeping their places', () => {
    const keys = ['a', 'b', 'c', 'd'];
    expect(reorderGroups(keys, ['a', 'c', 'd'], 0, 2)).toEqual(['c', 'b', 'd', 'a']);
    expect(reorderGroups(keys, keys, 2, 1)).toEqual(['a', 'c', 'b', 'd']);
    expect(reorderGroups(keys, keys, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(reorderGroups(keys, keys, 1, 1)).toBe(keys);
    expect(reorderGroups(keys, keys, 0, 9)).toBe(keys);
  });

  it('puts a group a saved order lacks after its default neighbour, and drops unknown keys', () => {
    const saved = DEFAULT_ORDER.filter((key) => key !== 'characters').toReversed();
    const keys = orderedGroups([...saved, 'nope']).map((group) => group.key);
    expect(keys).toHaveLength(DEFAULT_ORDER.length);
    expect(keys.indexOf('characters')).toBe(keys.indexOf('cards') + 1);
    expect(keys).not.toContain('nope');
    expect(isDefaultOrder(keys)).toBe(false);
  });
});
