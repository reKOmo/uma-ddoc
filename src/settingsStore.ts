// The user's settings as a zustand store, so code outside React (scenarioName() in src/i18n) can read
// them too (getSetting()); React reads it through src/settings.tsx. Remembered in this browser (the stored
// JSON is `{ timeZone, scenarioNames, jpNewsLanguage }`, as it always was); storage can be missing or throw
// (private windows, blocked site data), then the defaults apply.
//   timeZone       'utc' (the game's own times, default) | 'local' (the viewer's timezone)
//   scenarioNames  'global' (Global's short names, JP's where Global has none; default) | 'jp'
//   jpNewsLanguage umapyoi.net's copy of a JP post: 'jp' (the Japanese original, default) | 'en' (its translation)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersistStorage } from 'zustand/middleware';
import * as z from 'zod/mini';

export type Settings = {
  timeZone: 'utc' | 'local';
  scenarioNames: 'global' | 'jp';
  jpNewsLanguage: 'jp' | 'en';
};
export type SettingName = keyof Settings;

export const DEFAULTS: Settings = { timeZone: 'utc', scenarioNames: 'global', jpNewsLanguage: 'jp' };
export const OPTIONS = {
  timeZone: ['utc', 'local'],
  scenarioNames: ['global', 'jp'],
  jpNewsLanguage: ['jp', 'en'],
} as const;
const KEY = 'uma-ddoc.settings';

// The stores' storage, shared by the other persisted stores (src/tierListFilters.ts, src/timeline/*): persist would
// wrap the state as `{ state, version }`; this keeps each store's own plain format. `parse(raw)` → the state, or null
// for anything invalid (then the defaults stay); `serialize(state)` → the string stored. Every access to
// localStorage is guarded: it can be missing or throw, and then nothing is remembered across reloads.
export function rawStorage<S>(parse: (raw: string) => S | null, serialize: (state: S) => string): PersistStorage<S> {
  return {
    getItem: (name) => {
      try {
        const raw = globalThis.localStorage?.getItem(name);
        const state = raw == null ? null : parse(raw);
        return state ? { state, version: 0 } : null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        globalThis.localStorage?.setItem(name, serialize(value.state));
      } catch {
        // Not remembered across reloads; still kept while the page is open.
      }
    },
    removeItem: (name) => {
      try {
        globalThis.localStorage?.removeItem(name);
      } catch {
        // Nothing to remove.
      }
    },
  };
}

// Each field on its own: an unknown or missing value falls back to its default.
const schema = z.looseObject({
  timeZone: z.catch(z.enum(OPTIONS.timeZone), DEFAULTS.timeZone),
  scenarioNames: z.catch(z.enum(OPTIONS.scenarioNames), DEFAULTS.scenarioNames),
  jpNewsLanguage: z.catch(z.enum(OPTIONS.jpNewsLanguage), DEFAULTS.jpNewsLanguage),
});

type State = {
  settings: Settings;
  setSetting: <K extends SettingName>(name: K, value: Settings[K]) => void;
};
type Persisted = Pick<State, 'settings'>;

export const useSettingsStore = create<State>()(
  persist(
    (set) => ({
      settings: { ...DEFAULTS },
      setSetting: (name, value) => {
        if (!(OPTIONS[name] as readonly string[]).includes(value)) return;
        set((state) => ({ settings: { ...state.settings, [name]: value } }));
      },
    }),
    {
      name: KEY,
      storage: rawStorage<Persisted>(
        (raw) => {
          const parsed = schema.safeParse(JSON.parse(raw));
          if (!parsed.success) return null;
          const { timeZone, scenarioNames, jpNewsLanguage } = parsed.data;
          return { settings: { timeZone, scenarioNames, jpNewsLanguage } };
        },
        ({ settings }) => JSON.stringify(settings)
      ),
      partialize: ({ settings }) => ({ settings }),
    }
  )
);

export const getSettings = (): Settings => useSettingsStore.getState().settings;
export const getSetting = <K extends SettingName>(name: K): Settings[K] => getSettings()[name];
export const setSetting = <K extends SettingName>(name: K, value: Settings[K]) =>
  useSettingsStore.getState().setSetting(name, value);

export function subscribe(listener: () => void) {
  return useSettingsStore.subscribe(listener);
}
