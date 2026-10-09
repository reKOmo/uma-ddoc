// The Cards tab's filters (stat, limit breaks shown per rarity, search), kept here so they survive leaving the
// page, and in this browser's storage so they survive a reload. Storage can be missing or throw (private
// windows, blocked site data); then they're only kept until the page is closed. The scenario is App's (shared
// with the other pages).
//   stat    a key of STATS
//   shown   { [rarity]: [limit breaks] }, rarity SSR / SR / R (as in cards.json)
//   query   the search box's text

import { STATS } from '../tierlist/index.js';

// MLB for all, plus LB0 and LB3 for SSR and SR.
export const DEFAULTS = { stat: 'speed', shown: { SSR: [0, 3, 4], SR: [0, 3, 4], R: [4] }, query: '' };
const KEY = 'uma-ddoc.tierListFilters';

const validShown = (shown) =>
  Object.keys(DEFAULTS.shown).every(
    (rarity) =>
      Array.isArray(shown?.[rarity]) && shown[rarity].every((lb) => Number.isInteger(lb) && lb >= 0 && lb <= 4)
  );

function load() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}');
    return {
      stat: STATS.includes(saved.stat) ? saved.stat : DEFAULTS.stat,
      shown: validShown(saved.shown) ? saved.shown : DEFAULTS.shown,
      query: typeof saved.query === 'string' ? saved.query : DEFAULTS.query,
    };
  } catch {
    return DEFAULTS;
  }
}

let current = load();

export const getFilters = () => current;

export function saveFilters(filters) {
  current = filters;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(filters));
  } catch {
    // Not remembered across reloads; still kept while the page is open.
  }
}

// Whether the filters are the defaults (the page checks the scenario itself).
export const isDefault = ({ stat, shown, query }) =>
  stat === DEFAULTS.stat &&
  query === DEFAULTS.query &&
  Object.keys(DEFAULTS.shown).every(
    (rarity) =>
      shown[rarity].length === DEFAULTS.shown[rarity].length &&
      DEFAULTS.shown[rarity].every((lb) => shown[rarity].includes(lb))
  );
