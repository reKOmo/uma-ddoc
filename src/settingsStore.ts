// Read outside React too (getSetting(); React uses src/settings.tsx). Remembered in this browser as the stored JSON
// `{ timeZone, scenarioNames, jpNewsLanguage }` (that format never changes). Storage can be missing or throw: the defaults apply then.
//   timeZone       'utc' (the game's own times, default) | 'local' (the viewer's timezone)
//   scenarioNames  'global' (Global's short names, JP's where Global has none; default) | 'jp'
//   jpNewsLanguage umapyoi.net's copy of a JP post: 'jp' (the Japanese original, default) | 'en' (its translation)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as z from 'zod/mini';
import { rawStorage } from './rawStorage.ts';

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
