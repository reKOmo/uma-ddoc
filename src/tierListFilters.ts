// The Cards tab's filters (stat, limit breaks shown per rarity, search) as a zustand store, so they survive leaving
// the page, and in this browser's storage (the stored JSON is `{ stat, shown, query, size }`, as it always was) so
// they survive a reload. Storage can be missing or throw (private windows, blocked site data); then they're only
// kept until the page is closed. The scenario is App's (shared
// with the other pages).
//   stat    a key of STATS
//   shown   { [rarity]: [limit breaks] }, rarity SSR / SR / R (as in cards.json)
//   query   the search box's text
//   size    the cards' display size, 1–4 (SIZES; 3 the default): a display preference, not a filter, so isDefault()
//           and "Reset filters" leave it alone

import * as z from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STATS } from '../tierlist/index.ts';
import type { Stat } from '../tierlist/index.ts';
import { rawStorage } from './settingsStore.ts';

export type Rarity = 'SSR' | 'SR' | 'R';
export type Shown = Record<Rarity, number[]>;
export type Filters = { stat: Stat; shown: Shown; query: string; size: number };

// MLB for all, plus LB0 and LB3 for SSR and SR.
export const DEFAULTS: Filters = {
  stat: 'speed',
  shown: { SSR: [0, 3, 4], SR: [0, 3, 4], R: [4] },
  query: '',
  size: 3,
};
export const SIZES = [1, 2, 3, 4];
const KEY = 'uma-ddoc.tierListFilters';

const validShown = (shown: unknown): shown is Shown =>
  (Object.keys(DEFAULTS.shown) as Rarity[]).every((rarity) => {
    const lbs = (shown as Partial<Record<Rarity, unknown>> | null | undefined)?.[rarity];
    return Array.isArray(lbs) && lbs.every((lb) => Number.isInteger(lb) && lb >= 0 && lb <= 4);
  });

// Each field on its own: an invalid or missing one falls back to its default.
const schema = z.looseObject({
  stat: z.catch(z.enum(STATS), DEFAULTS.stat),
  shown: z.catch(z.custom<Shown>(validShown), DEFAULTS.shown),
  query: z.catch(z.string(), DEFAULTS.query),
  size: z.catch(
    z.custom<number>((size) => SIZES.includes(size as number)),
    DEFAULTS.size
  ),
});

type State = { filters: Filters; setFilters: (filters: Filters) => void };

export const useFiltersStore = create<State>()(
  persist(
    (set) => ({
      filters: DEFAULTS,
      setFilters: (filters) => set({ filters }),
    }),
    {
      name: KEY,
      storage: rawStorage<Pick<State, 'filters'>>(
        (raw) => {
          const parsed = schema.safeParse(JSON.parse(raw));
          if (!parsed.success) return null;
          const { stat, shown, query, size } = parsed.data;
          return { filters: { stat, shown, query, size } };
        },
        ({ filters }) => JSON.stringify(filters)
      ),
      partialize: ({ filters }) => ({ filters }),
    }
  )
);

export const getFilters = (): Filters => useFiltersStore.getState().filters;
export const saveFilters = (filters: Filters) => useFiltersStore.getState().setFilters(filters);

// Whether the filters are the defaults (the page checks the scenario itself).
export const isDefault = ({ stat, shown, query }: Pick<Filters, 'stat' | 'shown' | 'query'>) =>
  stat === DEFAULTS.stat &&
  query === DEFAULTS.query &&
  (Object.keys(DEFAULTS.shown) as Rarity[]).every(
    (rarity) =>
      shown[rarity].length === DEFAULTS.shown[rarity].length &&
      DEFAULTS.shown[rarity].every((lb) => shown[rarity].includes(lb))
  );
