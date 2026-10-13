// @ts-nocheck
// The main colour of an image, for the scenario strip (data/scenarios.json `colors`). Node only, no
// dependencies: decodes 8-bit, non-interlaced PNGs (greyscale, RGB, palette, with or without alpha),
// which is what GameTora's and the official site's art are.
//
// "Main colour": among clearly coloured pixels (opaque, not near-white/grey/black), the most common
// hue (24 bins, weighted by saturation²), averaged over that bin's pixels. Skin and hair hues
// (reds/oranges/browns, < 45° or ≥ 345°) are left out first: the art is mostly characters, and with them
// every cover comes out brown. Only if nothing else is coloured are they counted.

import { inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

// PNG bytes → { width, height, rgba: Uint8Array }.
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let offset = 8;
  let header: { width: number; height: number; depth: number; colorType: number; interlace: number } | undefined;
  let palette: Buffer | undefined;
  let transparency: Buffer | undefined;
  const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: chunk.readUInt32BE(0),
        height: chunk.readUInt32BE(4),
        depth: chunk[8],
        colorType: chunk[9],
        interlace: chunk[12],
      };
    } else if (type === 'PLTE') palette = chunk;
    else if (type === 'tRNS') transparency = chunk;
    else if (type === 'IDAT') data.push(chunk);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  const { width, height, depth, colorType, interlace } = header;
  const channels = CHANNELS[colorType];
  if (depth !== 8 || interlace || !channels) throw new Error(`unsupported PNG (depth ${depth}, type ${colorType})`);

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[x] = v & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    let rgb: number[];
    let alpha = 255;
    if (colorType === 3) {
      const index = pixels[s];
      rgb = [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2]];
      if (transparency && index < transparency.length) alpha = transparency[index];
    } else if (colorType === 0 || colorType === 4) {
      rgb = [pixels[s], pixels[s], pixels[s]];
      if (colorType === 4) alpha = pixels[s + 1];
    } else {
      rgb = [pixels[s], pixels[s + 1], pixels[s + 2]];
      if (colorType === 6) alpha = pixels[s + 3];
    }
    rgba.set([...rgb, alpha], i * 4);
  }
  return { width, height, rgba };
}

const hex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

const isSkinOrHair = (hue) => hue < 45 || hue >= 345;

// rgba → "#rrggbb", or null if nothing in it is clearly coloured.
export function mainColor(image) {
  return dominantHue(image, (hue) => !isSkinOrHair(hue)) ?? dominantHue(image, () => true);
}

function dominantHue({ rgba }, keep) {
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
export async function imageColor(url, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return mainColor(decodePng(Buffer.from(await res.arrayBuffer())));
  } catch (err) {
    console.warn(`no colour for ${url}: ${err.message}`);
    return null;
  }
}
