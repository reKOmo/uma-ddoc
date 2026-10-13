import { deflateSync } from 'node:zlib';
import { describe, it, expect } from 'vitest';
import { decodePng, mainColor } from '../scripts/lib/colors.ts';

// Filter 0 and "Sub" alternate, so both row filters are decoded.
type Pixel = [number, number, number, number];
function png(rows: Pixel[][]) {
  const chunk = (type: string, data: Buffer) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'latin1');
    data.copy(out, 8);
    return out; // CRC isn't checked by the decoder
  };
  const [width, height] = [rows[0].length, rows.length];
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.concat(
    rows.map((row, y) => {
      const bytes = row.flat();
      if (y % 2 === 0) return Buffer.from([0, ...bytes]);
      return Buffer.from([1, ...bytes.map((v, i) => (i >= 4 ? (v - bytes[i - 4] + 256) % 256 : v))]);
    })
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const SKIN: Pixel = [235, 180, 150, 255];
const BLUE: Pixel = [40, 90, 220, 255];
const CLEAR: Pixel = [0, 200, 0, 0];

describe('decodePng', () => {
  it('reads RGBA pixels through the row filters', () => {
    const { width, height, rgba } = decodePng(
      png([
        [SKIN, BLUE],
        [BLUE, CLEAR],
      ])
    );
    expect([width, height]).toEqual([2, 2]);
    expect([...rgba]).toEqual([...SKIN, ...BLUE, ...BLUE, ...CLEAR]);
  });
});

describe('mainColor', () => {
  it("prefers the art's colour over skin and hair, ignoring transparent pixels", () => {
    const rows: Pixel[][] = [
      [SKIN, SKIN, SKIN, BLUE],
      [SKIN, SKIN, CLEAR, CLEAR],
    ];
    expect(mainColor(decodePng(png(rows)))).toBe('#285adc');
  });

  it('falls back to skin tones when nothing else is coloured, null when nothing is', () => {
    expect(mainColor(decodePng(png([[SKIN, [255, 255, 255, 255]]])))).toBe('#ebb496');
    expect(mainColor(decodePng(png([[[128, 128, 128, 255]]])))).toBeNull();
  });
});
