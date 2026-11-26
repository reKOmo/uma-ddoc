import { setSetting, useSettingsStore } from './settingsStore.ts';

export const useSettings = () => ({
  settings: useSettingsStore((state) => state.settings),
  setSetting,
});
