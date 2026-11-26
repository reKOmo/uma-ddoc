// The scenarios hidden from the card page's "Tier by scenario" table, a zustand store: kept across cards, and in this
// browser's storage across reloads (the stored JSON is `{ hidden }`, never changed). A list of the hidden ones, so a
// scenario added later shows. Storage can be missing or throw: then it's kept only while the page is open.

import * as z from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rawStorage } from './rawStorage.ts';

const KEY = 'uma-ddoc.hiddenScenarios';

const schema = z.looseObject({ hidden: z.catch(z.array(z.string()), []) });

type State = { hidden: string[]; setHidden: (hidden: string[]) => void };

export const useHiddenScenarios = create<State>()(
  persist(
    (set) => ({
      hidden: [],
      setHidden: (hidden) => set({ hidden }),
    }),
    {
      name: KEY,
      storage: rawStorage<Pick<State, 'hidden'>>(
        (raw) => {
          const parsed = schema.safeParse(JSON.parse(raw));
          return parsed.success ? { hidden: parsed.data.hidden } : null;
        },
        ({ hidden }) => JSON.stringify({ hidden })
      ),
      partialize: ({ hidden }) => ({ hidden }),
    }
  )
);

export const getHiddenScenarios = (): string[] => useHiddenScenarios.getState().hidden;
