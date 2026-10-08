// User settings (the Settings tab), shared through context and remembered in this browser.
// Storage can be missing or throw (private windows, blocked site data); the defaults apply then.
//   timeZone  'utc' (the game's own times, default) | 'local' (the viewer's timezone)

import { createContext, useContext, useMemo, useState } from 'react';

const DEFAULTS = { timeZone: 'utc' };
const OPTIONS = { timeZone: ['utc', 'local'] };
const KEY = 'uma-puller.settings';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
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

function save(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not remembered; it still applies until the page is closed.
  }
}

const SettingsContext = createContext({ settings: DEFAULTS, setSetting: () => {} });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load);
  const value = useMemo(
    () => ({
      settings,
      setSetting(name, next) {
        setSettings((current) => {
          const updated = { ...current, [name]: next };
          save(updated);
          return updated;
        });
      },
    }),
    [settings]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
export const SETTING_OPTIONS = OPTIONS;

// Intl options for the chosen timezone: UTC, or none (the viewer's own).
export const timeZoneOptions = (timeZone) => (timeZone === 'utc' ? { timeZone: 'UTC' } : {});
// The viewer's timezone, e.g. "Europe/Warsaw".
export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
