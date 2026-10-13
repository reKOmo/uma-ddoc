// Shared by both servers: a kind one server lacks is ignored there.
import * as z from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rawStorage } from '../rawStorage.ts';

const KEY = 'uma-ddoc.timelineHidden';

type State = { hidden: Set<string>; setHidden: (hidden: Set<string>) => void };

export const useHiddenStore = create<State>()(
  persist(
    (set) => ({
      hidden: new Set<string>(),
      setHidden: (hidden) => set({ hidden }),
    }),
    {
      name: KEY,
      storage: rawStorage<Pick<State, 'hidden'>>(
        (raw) => {
          const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
          if (!parsed.success) return null;
          return { hidden: new Set(parsed.data.filter((k): k is string => typeof k === 'string')) };
        },
        ({ hidden }) => JSON.stringify([...hidden])
      ),
      partialize: ({ hidden }) => ({ hidden }),
    }
  )
);

export const getHidden = (): Set<string> => useHiddenStore.getState().hidden;
export const saveHidden = (hidden: Set<string>) => useHiddenStore.getState().setHidden(hidden);
