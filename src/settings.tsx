import { OPTIONS, useSettingsStore } from './settingsStore.ts';

export const useSettings = () => ({
  settings: useSettingsStore((state) => state.settings),
  setSetting: useSettingsStore.getState().setSetting,
});
export const SETTING_OPTIONS = OPTIONS;

// Intl options for the chosen timezone: UTC, or none (the viewer's own).
export const timeZoneOptions = (timeZone: string) => (timeZone === 'utc' ? { timeZone: 'UTC' } : {});
// Intl options for the chosen clock.
export const clockOptions = (clock: string): Intl.DateTimeFormatOptions => ({
  hourCycle: clock === '24h' ? 'h23' : 'h12',
});
// The viewer's timezone, e.g. "Europe/Warsaw".
export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
