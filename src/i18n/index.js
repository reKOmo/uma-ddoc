// UI strings, via i18next + react-i18next. Each language is a JSON catalog in
// this folder with the same keys as en.json (test/i18n.test.jsx checks that),
// registered in RESOURCES. Catalogs use i18next's format: {{placeholders}},
// plural keys with _one/_other… suffixes, formatters like {{names, list}}, and
// <tags> rendered by <Trans components={…}>.
//
// Components get `t` from useTranslation(), so they re-render when the language
// changes; the helpers below read the shared instance and are meant to be
// called during such a render. The language is detected from the browser and
// falls back to English; dates use the same locale so they match the UI.

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './en.json' with { type: 'json' };
import { COMBINED } from '../../tierlist/index.js';

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
const locale = () => i18n.language || 'en';

// Display names for keys that live in code.
export const statName = (stat) => i18n.t(`stat.${stat}`);
export const serverName = (server) => i18n.t(`server.${server}`);
// Real scenarios go by their key (DYI, GL…); the averaged ones have names.
export const scenarioName = (key) => (key in COMBINED ? i18n.t(`scenario.${key}`) : key);
// A limit break's label: LB0–LB3, and MLB (max limit break) for LB4.
export const lbName = (lb) => (lb === 4 ? i18n.t('lb.max') : i18n.t('lb.level', { lb }));

// Dates in the UI's locale. Takes anything Date accepts.
export const formatDate = (date, options) => new Date(date).toLocaleDateString(locale(), options);
