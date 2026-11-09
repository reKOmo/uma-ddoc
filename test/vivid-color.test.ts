import { describe, expect, it } from 'vitest';
import { ink } from '../src/timeline/scenarioStrip.ts';
import { vividColor } from '../src/vividColor.ts';

const saturation = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
};

describe('vividColor', () => {
  it('makes a muted colour more saturated, keeping its hue family', () => {
    const muted = '#9c4f6e';
    const vivid = vividColor(muted);
    expect(saturation(vivid)).toBeGreaterThan(saturation(muted) + 0.15);
    // (still a pink: red the strongest channel)
    expect(Number.parseInt(vivid.slice(1, 3), 16)).toBeGreaterThan(Number.parseInt(vivid.slice(5, 7), 16));
  });

  it('leaves greys grey', () => {
    expect(vividColor('#808080')).toBe('#808080');
  });
});

describe('ink', () => {
  it('picks whichever text reads better on the colour', () => {
    expect(ink('#ffffff')).toBe('dark');
    expect(ink('#1c1f24')).toBe('light');
    // A mid blue: white contrasts more than near-black here.
    expect(ink('#1558c1')).toBe('light');
    expect(ink(null)).toBeNull();
  });
});
