// The user's settings as a plain store, so code outside React (scenarioName() in src/i18n) can read
// them too; React reads it through src/settings.jsx. Remembered in this browser; storage can be
// missing or throw (private windows, blocked site data), then the defaults apply.
//   timeZone       'utc' (the game's own times, default) | 'local' (the viewer's timezone)
//   scenarioNames  'global' (Global's short names, JP's where Global has none; default) | 'jp'
//   jpNewsLanguage umapyoi.net's copy of a JP post: 'jp' (the Japanese original, default) | 'en' (its translation)

export const DEFAULTS = { timeZone: 'utc', scenarioNames: 'global', jpNewsLanguage: 'jp' };
export const OPTIONS = { timeZone: ['utc', 'local'], scenarioNames: ['global', 'jp'], jpNewsLanguage: ['jp', 'en'] };
const KEY = 'uma-ddoc.settings';

function load() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}');
    return Object.fromEntries(
      Object.entries(DEFAULTS).map(([name, fallback]) => [
        name,
        OPTIONS[name].includes(saved[name]) ? saved[name] : fallback,
      ])
    );
  } catch {
    return { ...DEFAULTS };
  }
}

let current = load();
const listeners = new Set();

export const getSettings = () => current;
export const getSetting = (name) => current[name];

export function setSetting(name, value) {
  if (!OPTIONS[name]?.includes(value)) return;
  current = { ...current, [name]: value };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not remembered; it still applies until the page is closed.
  }
  for (const listener of listeners) listener();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
