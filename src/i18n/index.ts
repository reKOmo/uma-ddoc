// Catalogs: src/i18n/<lang>.json, registered in RESOURCES (same keys as en.json: test/i18n.test.tsx checks).
// Components get `t` from useTranslation() and re-render on a language change; the helpers below read the shared
// instance and are meant to be called during such a render.

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './en.json' with { type: 'json' };
import { COMBINED } from '../../tierlist/index.ts';
import { scenarioByKey } from '../scenarioRelease.ts';
import { getSetting } from '../settingsStore.ts';

const RESOURCES = { en: { translation: en } };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: RESOURCES,
    supportedLngs: Object.keys(RESOURCES),
    // "en-GB" uses the "en" catalog, while dates still format as en-GB.
    nonExplicitSupportedLngs: true,
    fallbackLng: 'en',
    detection: { order: ['querystring', 'navigator'], caches: [] },
    // React escapes values itself.
    interpolation: { escapeValue: false },
    // Resources are bundled, so init finishes synchronously.
    initAsync: false,
  });

export default i18n;

// The detected locale (e.g. "en-GB"), for Intl formatting.
const locale = (): string => i18n.language || 'en';

export const statName = (stat: string): string => i18n.t(`stat.${stat}`);
export const serverName = (server: string): string => i18n.t(`server.${server}`);
// A real scenario's short name follows the Scenario names setting: Global's (JP's where Global has none yet) or JP's;
// the key if data/scenarios.json lacks it.
export function scenarioName(key: string): string {
  if (key in COMBINED) return i18n.t(`scenario.${key}`);
  const short = scenarioByKey(key)?.short;
  if (!short) return key;
  return (getSetting('scenarioNames') === 'global' && short.en) || short.jp;
}
// A limit break's label: LB0–LB3, and MLB (max limit break) for LB4.
export const lbName = (lb: number): string => (lb === 4 ? i18n.t('lb.max') : i18n.t('lb.level', { lb }));

// Kept: making a formatter is slow (toLocaleDateString makes one per call), and the Timeline formats thousands of dates.
const formatters = new Map<string, Intl.DateTimeFormat>();
function dateTimeFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale()} ${JSON.stringify(options)}`;
  const formatter = formatters.get(key) ?? new Intl.DateTimeFormat(locale(), options);
  formatters.set(key, formatter);
  return formatter;
}

export const formatDate = (date: Date | string | number, options: Intl.DateTimeFormatOptions = {}): string =>
  dateTimeFormat(options).format(new Date(date));
export const formatDateTime = (date: Date | string | number, options: Intl.DateTimeFormatOptions): string =>
  dateTimeFormat(options).format(new Date(date));
export const formatNumber = (value: number): string => new Intl.NumberFormat(locale()).format(value);

// How long from one "YYYY-MM-DD" date to a later one, in the UI's locale: "1 year, 2 months",
// "5 months", or days when it's under a month.
export function formatDuration(from: string, to: string): string {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  const unit = (value: number, name: string): string =>
    new Intl.NumberFormat(locale(), { style: 'unit', unit: name, unitDisplay: 'long' }).format(value);
  if (months < 1) return unit(Math.round((Date.parse(to) - Date.parse(from)) / 86400000), 'day');
  const parts = [];
  if (months >= 12) parts.push(unit(Math.floor(months / 12), 'year'));
  if (months % 12) parts.push(unit(months % 12, 'month'));
  return new Intl.ListFormat(locale(), { style: 'narrow', type: 'unit' }).format(parts);
}
