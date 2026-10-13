// The main colour of an image, for the scenario strip (data/scenarios.json `colors`). Node only. The decoder is pngjs
// (greyscale, RGB, palette, with or without alpha: GameTora's and the official site's art).
//
// "Main colour": among clearly coloured pixels (opaque, not near-white/grey/black), the most common
// hue (24 bins, weighted by saturation²), averaged over that bin's pixels. Skin and hair hues
// (reds/oranges/browns, < 45° or ≥ 345°) are left out first: the art is mostly characters, and with them
// every cover comes out brown. Only if nothing else is coloured are they counted.

import { PNG } from 'pngjs';

// An image's pixels, RGBA, row by row.
export type Image = { width: number; height: number; rgba: Uint8Array };

// PNG bytes → { width, height, rgba: Uint8Array } (chunk checksums aren't checked, as before).
export function decodePng(buffer: Buffer): Image {
  const { width, height, data } = PNG.sync.read(buffer, { checkCRC: false });
  return { width, height, rgba: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

const hex = (rgb: number[]): string => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

const isSkinOrHair = (hue: number): boolean => hue < 45 || hue >= 345;

// rgba → "#rrggbb", or null if nothing in it is clearly coloured.
export function mainColor(image: Image): string | null {
  return dominantHue(image, (hue) => !isSkinOrHair(hue)) ?? dominantHue(image, () => true);
}

function dominantHue({ rgba }: Image, keep: (hue: number) => boolean): string | null {
  const BINS = 24;
  const weight = new Float64Array(BINS);
  const sums = Array.from({ length: BINS }, () => [0, 0, 0, 0]);
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 200) continue;
    const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max ? (max - min) / max : 0;
    if (saturation < 0.3 || max < 70 || min > 225) continue; // grey, black, white
    const d = max - min;
    const hue = ((max === r ? (g - b) / d : max === g ? 2 + (b - r) / d : 4 + (r - g) / d) * 60 + 360) % 360;
    if (!keep(hue)) continue;
    const bin = Math.min(BINS - 1, Math.floor((hue / 360) * BINS));
    weight[bin] += saturation * saturation;
    const sum = sums[bin];
    sum[0] += r;
    sum[1] += g;
    sum[2] += b;
    sum[3] += 1;
  }
  let best = -1;
  for (let i = 0; i < BINS; i++) if (weight[i] > 0 && (best < 0 || weight[i] > weight[best])) best = i;
  if (best < 0) return null;
  const [r, g, b, n] = sums[best];
  return hex([r / n, g / n, b / n]);
}

// An image URL → its main colour (null if it can't be fetched or decoded; logged).
export async function imageColor(url: string, headers: Record<string, string> = {}): Promise<string | null> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return mainColor(decodePng(Buffer.from(await res.arrayBuffer())));
  } catch (err) {
    console.warn(`no colour for ${url}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
