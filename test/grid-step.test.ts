import { describe, expect, it } from 'vitest';
import { type Box, stepRow } from '../src/timeline/gridStep.ts';

// Pills wrapping into rows:   [0 wide····] [1]
//                              [2] [3] [4···]
//                              [5]
const boxes: Box[] = [
  { top: 0, left: 0, width: 200 },
  { top: 0, left: 210, width: 60 },
  { top: 40, left: 0, width: 60 },
  { top: 40, left: 70, width: 60 },
  { top: 40, left: 140, width: 160 },
  { top: 80.4, left: 0, width: 60 },
];

describe('stepRow', () => {
  it('starts at the first going down, and never going up', () => {
    expect(stepRow(boxes, -1, 1)).toBe(0);
    expect(stepRow(boxes, -1, -1)).toBe(-1);
    expect(stepRow([], -1, 1)).toBe(-1);
  });

  it("goes to the next row's pill nearest below or above", () => {
    expect(stepRow(boxes, 1, 1)).toBe(4);
    expect(stepRow(boxes, 0, 1)).toBe(3);
    expect(stepRow(boxes, 4, -1)).toBe(1);
    // (a row's tops differing by a fraction of a pixel are one row)
    expect(stepRow(boxes, 3, 1)).toBe(5);
  });

  it('leaves the suggestions going up from the first row, and stays on the last going down', () => {
    expect(stepRow(boxes, 1, -1)).toBe(-1);
    expect(stepRow(boxes, 5, 1)).toBe(5);
  });
});
