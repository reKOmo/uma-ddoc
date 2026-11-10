// Read outside React too (getSetting(); React uses src/settings.tsx). Remembered in this browser as the stored JSON
// `{ timeZone, scenarioNames, jpNewsLanguage, clock, fanTlGlobal, jpNames, theme }` (keys are only ever added, never changed). Storage can be missing or
// throw: the defaults apply then.
//   timeZone       'utc' (the game's own times, default) | 'local' (the viewer's timezone)
//   clock          '12h' | '24h' (default: the browser's own, from its locale)
//   scenarioNames  'global' (Global's short names, JP's where Global has none; default) | 'jp'
//   jpNewsLanguage umapyoi.net's copy of a JP post: 'jp' (the Japanese original, default) | 'en' (its translation)
//   fanTlGlobal    Global's names: 'jp' (as JP writes them, where JP has them) | 'official' (Global's official English,
//                  else Japanese) | 'all' (Global's, else GameTora's, else UmaTL's; default)
//   jpNames        JP's names, the same options; default 'jp'
//   theme          'system' (the device's light or dark, default) | 'light' | 'dark' (src/theme.ts applies it)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as z from 'zod/mini';
import { rawStorage } from './rawStorage.ts';

export type Settings = {
  timeZone: 'utc' | 'local';
  scenarioNames: 'global' | 'jp';
  jpNewsLanguage: 'jp' | 'en';
  clock: '12h' | '24h';
  fanTlGlobal: 'jp' | 'official' | 'all';
  jpNames: 'jp' | 'official' | 'all';
  theme: 'system' | 'light' | 'dark';
};
export type SettingName = keyof Settings;

// The browser's clock: 24-hour where its locale counts hours 0–23.
const browserClock = (): Settings['clock'] => {
  const { hourCycle } = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
  return hourCycle === 'h23' || hourCycle === 'h24' ? '24h' : '12h';
};

export const DEFAULTS: Settings = {
  timeZone: 'utc',
  scenarioNames: 'global',
  jpNewsLanguage: 'jp',
  clock: browserClock(),
  fanTlGlobal: 'all',
  jpNames: 'jp',
  theme: 'system',
};
export const OPTIONS = {
  timeZone: ['utc', 'local'],
  scenarioNames: ['global', 'jp'],
  jpNewsLanguage: ['jp', 'en'],
  clock: ['12h', '24h'],
  fanTlGlobal: ['jp', 'official', 'all'],
  jpNames: ['jp', 'official', 'all'],
  theme: ['system', 'light', 'dark'],
} as const;
const KEY = 'uma-ddoc.settings';

// Each field on its own: an unknown or missing value falls back to its default.
const schema = z.looseObject({
  timeZone: z.catch(z.enum(OPTIONS.timeZone), DEFAULTS.timeZone),
  scenarioNames: z.catch(z.enum(OPTIONS.scenarioNames), DEFAULTS.scenarioNames),
  jpNewsLanguage: z.catch(z.enum(OPTIONS.jpNewsLanguage), DEFAULTS.jpNewsLanguage),
  // (Older versions stored no clock: the browser's then.)
  clock: z.catch(z.enum(OPTIONS.clock), DEFAULTS.clock),
  fanTlGlobal: z.catch(z.enum(OPTIONS.fanTlGlobal), DEFAULTS.fanTlGlobal),
  jpNames: z.catch(z.enum(OPTIONS.jpNames), DEFAULTS.jpNames),
  theme: z.catch(z.enum(OPTIONS.theme), DEFAULTS.theme),
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
          const { timeZone, scenarioNames, jpNewsLanguage, clock, fanTlGlobal, jpNames, theme } = parsed.data;
          return { settings: { timeZone, scenarioNames, jpNewsLanguage, clock, fanTlGlobal, jpNames, theme } };
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
