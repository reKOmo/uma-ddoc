// A colour taken from art (a scenario's cover) made vivid for display: more saturated (near-greys stay grey) and in a
// middle lightness, so a muted or very dark or pale cover still reads as its colour.
// A scenario's colour for CSS: vivid in the light theme, the cover's own in dark (where muted colours sit well).
export const scenarioCssColor = (hex: string): string => `light-dark(${vividColor(hex)}, ${hex})`;

export function vividColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const saturation = s < 0.1 ? s : Math.min(0.85, Math.max(s, s * 1.6));
  const lightness = Math.min(0.6, Math.max(0.4, l));
  // HSL back to RGB.
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = lightness - c / 2;
  const [r1, g1, b1] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][Math.floor(h) % 6];
  return `#${[r1, g1, b1]
    .map((v) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}
