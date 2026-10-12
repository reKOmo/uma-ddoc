// Which Career scenario runs when, for the strip at the top of the banner calendar. Pure.
//
// scenarioSegments(scenarios, server, now) → [{ key, name, start, end, tag, current, color, ink }]
//   scenarios  data/scenarios.json's list (scripts/lib/scenarios.js)
//   server     'gl' (en_start_date) | 'jp' (jp_start_date)
// Each scenario runs from its launch to the next one's (end null for the newest); times in ms.
// tag is the start date's ('out' | 'confirmed' | 'predicted'); current: running at `now`; color: its
// cover's main colour or null; ink: 'dark' | 'light',
// the text that reads on it.

const DATE_FIELD = { gl: 'en_start_date', jp: 'jp_start_date' };

// The text that reads on a scenario colour ("#rrggbb"): 'dark' | 'light' (null without a colour), by
// its relative luminance (WCAG), dark above ~0.4. Pair with the --ink-dark / --ink-light tokens.
export function ink(color) {
  if (!color) return null;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? 'dark' : 'light';
}

export function scenarioSegments(scenarios, server, now = Date.now()) {
  const field = DATE_FIELD[server];
  const dated = scenarios
    .filter((s) => s[field]?.date)
    .map((s) => ({
      key: s.key,
      name: s.full_en ?? s.full_jp ?? s.key,
      start: Date.parse(s[field].date),
      tag: s[field].tag,
      color: s.color ?? null,
    }))
    .sort((a, b) => a.start - b.start);
  return dated.map((s, i) => {
    const end = dated[i + 1]?.start ?? null;
    return { ...s, end, current: s.start <= now && (end === null || now < end), ink: ink(s.color) };
  });
}
