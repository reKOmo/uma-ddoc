// @ts-nocheck
// User settings (the Settings tab) for React: useSettings() re-renders on change. The values and their
// storage live in src/settingsStore.js (plain JS, readable outside React too).

import { useSyncExternalStore } from 'react';
import { OPTIONS, getSettings, setSetting, subscribe } from './settingsStore.ts';

export const useSettings = () => ({ settings: useSyncExternalStore(subscribe, getSettings, getSettings), setSetting });
export const SETTING_OPTIONS = OPTIONS;

// Intl options for the chosen timezone: UTC, or none (the viewer's own).
export const timeZoneOptions = (timeZone) => (timeZone === 'utc' ? { timeZone: 'UTC' } : {});
// The viewer's timezone, e.g. "Europe/Warsaw".
export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
